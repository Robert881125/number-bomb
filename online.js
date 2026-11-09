'use strict';

const roomCodePattern = /^[A-HJ-NP-Z2-9]{6}$/;
const peerId = code => `number-bomb-v1-${code}`;
const peerLibrary = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';
let peerLibraryLoad;

function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  peerLibraryLoad ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(fail, 10000);
    function fail() {
      clearTimeout(timer);
      script.remove();
      peerLibraryLoad = undefined;
      reject(new Error('無法載入連線功能，請檢查網路後再試。'));
    }
    script.onload = () => {
      if (!window.Peer) return fail();
      clearTimeout(timer);
      resolve(window.Peer);
    };
    script.onerror = fail;
    script.src = peerLibrary;
    document.head.append(script);
  });
  return peerLibraryLoad;
}

function generateCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...crypto.getRandomValues(new Uint8Array(6))]
    .map(byte => alphabet[byte % alphabet.length]).join('');
}

async function openPeer(id) {
  const Peer = await loadPeer();
  const peer = new Peer(id);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => fail(), 10000);
    function fail(error) {
      clearTimeout(timer);
      peer.destroy();
      reject(new Error(error?.type === 'unavailable-id'
        ? '房間碼剛好重複，請再按一次建立房間。'
        : '無法連上配對服務，請檢查網路後再試。'));
    }
    peer.once('error', fail);
    peer.once('open', () => {
      clearTimeout(timer);
      peer.off('error', fail);
      resolve(peer);
    });
  });
}

async function hostRoom(name, events) {
  const code = generateCode();
  const id = peerId(code);
  const game = createGame(id, name);
  const peer = await openPeer(id);
  const guests = new Map();
  let closed = false;

  function publish() {
    if (closed) return;
    const state = game.view();
    for (const connection of guests.values()) {
      if (connection.open) connection.send({ type: 'state', state });
    }
    events.state(state);
  }

  peer.on('error', () => {
    if (!closed) events.notice('配對服務暫時無法連線。');
  });
  peer.on('disconnected', () => {
    if (!closed && !peer.destroyed) peer.reconnect();
  });
  peer.on('connection', connection => {
    let admitted = false;
    const timer = setTimeout(() => connection.close(), 16000);
    connection.on('close', () => {
      clearTimeout(timer);
      if (!admitted) return;
      guests.delete(connection.peer);
      game.leave(connection.peer);
      publish();
    });
    connection.on('error', () => connection.close());
    connection.on('data', message => {
      if (closed || !message || typeof message !== 'object') return;
      try {
        if (!admitted && message.type === 'join') {
          game.join(connection.peer, message.name);
          clearTimeout(timer);
          admitted = true;
          guests.set(connection.peer, connection);
          publish();
        } else if (admitted && message.type === 'guess') {
          game.guess(connection.peer, message.number, message.move);
          publish();
        }
      } catch (error) {
        if (connection.open) connection.send({ type: 'notice', text: error.message });
      }
    });
  });

  return {
    id, code, initial: game.view(),
    start() { game.start(id); publish(); },
    guess(number, move) { game.guess(id, number, move); publish(); },
    close() { closed = true; peer.destroy(); },
  };
}

async function joinRoom(code, name, events) {
  const peer = await openPeer();
  const connection = peer.connect(peerId(code), { serialization: 'json' });
  if (!connection) {
    peer.destroy();
    throw new Error('連線中斷，請再試一次。');
  }

  return new Promise((resolve, reject) => {
    let joined = false;
    let closed = false;
    const timer = setTimeout(() => fail('連線逾時。請確認房主在線，或換個網路再試。'), 16000);
    function close() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      peer.destroy();
    }
    function fail(message) {
      if (closed) return;
      close();
      if (joined) events.lost(message);
      else reject(new Error(message));
    }

    peer.on('error', error => {
      if (error.type === 'peer-unavailable') fail('找不到房間，請確認房間碼和房主是否在線。');
      else if (!joined || peer.destroyed) fail('連線中斷，請再試一次。');
    });
    connection.on('error', () => fail('無法與房主連線，請換個網路再試。'));
    connection.on('close', () => fail('與房主的連線已結束，請重新加入房間。'));
    connection.on('open', () => connection.send({ type: 'join', name }));
    connection.on('data', message => {
      if (closed || !message || typeof message !== 'object') return;
      if (message.type === 'notice') {
        if (joined) events.notice(message.text);
        else fail(message.text);
      }
      if (message.type !== 'state') return;
      if (joined) {
        events.state(message.state);
      } else {
        joined = true;
        clearTimeout(timer);
        resolve({
          id: peer.id, code, initial: message.state, close,
          guess(number, move) {
            if (!connection.open) throw new Error('與房主的連線已中斷。');
            connection.send({ type: 'guess', number, move });
          },
        });
      }
    });
  });
}
