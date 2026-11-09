'use strict';

const byId = id => document.getElementById(id);
const home = byId('home');
const room = byId('room');
const onlineForm = byId('online-form');
const localForm = byId('local-form');
const onlineMode = byId('online-mode');
const localMode = byId('local-mode');
const codeField = byId('code');
const guessField = byId('guess');
const guessForm = byId('guess-form');
const start = byId('start');

let session;
let state;
let busy = false;
let pendingMove = null;

function message(id, text = '', kind = 'error') {
  const node = byId(id);
  node.textContent = text;
  node.dataset.kind = kind;
}

function setMode(local) {
  onlineForm.hidden = local;
  localForm.hidden = !local;
  onlineMode.setAttribute('aria-pressed', String(!local));
  localMode.setAttribute('aria-pressed', String(local));
  message('home-status');
}

function setBusy(value) {
  busy = value;
  const controls = document.querySelectorAll('.modes button, #online-form input, #online-form button');
  for (const control of controls) control.disabled = value;
}

function showHome(text = '') {
  const previous = session;
  session = undefined;
  state = undefined;
  pendingMove = null;
  previous?.close();
  room.hidden = true;
  home.hidden = false;
  message('home-status', text);
  (localForm.hidden ? byId('nickname') : byId('local-names')).focus();
}

function showRoom(next) {
  session = next;
  home.hidden = true;
  room.hidden = false;
  byId('room-mode').textContent = session.code ? '線上連線' : '同機輪流';
  byId('invite').hidden = !session.code;
  byId('room-code').textContent = session.code || '';
  byId('room-title').focus();
  render(session.initial);
}

function listRow(label, detail, active = false) {
  const row = document.createElement('li');
  const name = document.createElement('span');
  const note = document.createElement('small');
  name.textContent = label;
  note.textContent = detail;
  row.classList.toggle('active', active);
  row.append(name, note);
  return row;
}

function render(next) {
  if (!session) return;
  const moveChanged = state?.move !== next.move;
  state = next;
  if (moveChanged) {
    pendingMove = null;
    guessField.value = '';
    message('room-status');
  }

  const lobby = state.phase === 'lobby';
  const finished = state.phase === 'finished';
  const playing = state.phase === 'playing';
  const activePlayer = state.players.find(player => player.id === state.turn);
  const mayGuess = playing && (!session.code || state.turn === session.id);
  const needsPlayers = state.players.length < 2;

  byId('round-label').textContent = lobby ? '準備區' : `第 ${state.round} 局`;
  byId('turn-status').textContent = lobby ? '準備開局'
    : finished ? `${state.loser} 引爆了炸彈！`
    : session.code && mayGuess ? '輪到你猜了' : `輪到 ${activePlayer.name}`;
  byId('range').dataset.phase = state.phase;
  byId('range').setAttribute('aria-label', finished ? '炸彈數字' : '可猜範圍');
  byId('low').textContent = finished ? state.bomb : state.low;
  byId('high').textContent = state.high;
  byId('board-hint').textContent = lobby
    ? needsPlayers ? '至少需要 2 人。把房間碼分享給朋友吧！' : '人到齊後，由房主開始遊戲。'
    : finished ? '這局結束了，準備好就再玩一局。'
      : !mayGuess ? '等這位玩家猜完，範圍就會更新。'
        : state.low === state.high ? '只剩最後一個數字了。' : '猜大了就降低上限，猜小了就提高下限。';

  guessForm.hidden = !mayGuess;
  guessField.min = state.low;
  guessField.max = state.high;
  guessForm.querySelector('button').disabled = pendingMove !== null;
  start.hidden = playing || !session.start;
  start.disabled = needsPlayers;
  start.textContent = finished ? '再玩一局' : '開始遊戲';
  byId('player-count').textContent = `${state.players.length} / 8`;
  byId('players').replaceChildren(...state.players.map(player => {
    const tags = [];
    if (session.code && player.id === session.id) tags.push('你');
    if (session.code && player.id === state.host) tags.push('房主');
    if (player.id === state.turn) tags.push('猜題中');
    return listRow(player.name, tags.join(' · '), player.id === state.turn);
  }));
  byId('empty-history').hidden = state.history.length > 0;
  byId('history').replaceChildren(...state.history.slice().reverse().map(entry =>
    listRow(`${entry.name} 猜 ${entry.number}`, entry.hit ? '引爆！' : `${entry.low}–${entry.high}`)
  ));

  if (mayGuess && moveChanged) guessField.focus({ preventScroll: true });
  else if (finished && moveChanged && !start.hidden && !start.disabled) start.focus({ preventScroll: true });
}

function notice(text) {
  pendingMove = null;
  guessForm.querySelector('button').disabled = false;
  message('room-status', text);
}

onlineMode.addEventListener('click', () => setMode(false));
localMode.addEventListener('click', () => setMode(true));
byId('leave').addEventListener('click', () => showHome());
codeField.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    onlineForm.requestSubmit(onlineForm.querySelector('[value="join"]'));
  }
});

onlineForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const joining = event.submitter?.value === 'join';
  const code = codeField.value.trim().toUpperCase();
  try {
    const name = playerName(byId('nickname').value);
    if (joining && !roomCodePattern.test(code)) throw new Error('請輸入完整的 6 碼房間碼。');
    setBusy(true);
    message('home-status', joining ? '正在加入房間…' : '正在建立房間…', 'info');
    const events = { state: render, notice, lost: showHome };
    const next = joining ? await joinRoom(code, name, events) : await hostRoom(name, events);
    message('home-status');
    showRoom(next);
  } catch (error) {
    message('home-status', error.message);
  } finally {
    setBusy(false);
  }
});

localForm.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const names = byId('local-names').value.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
    if (names.length < 2 || names.length > 8) throw new Error('請輸入 2～8 位玩家的暱稱。');
    const host = 'local-0';
    const game = createGame(host, names[0]);
    names.slice(1).forEach((name, index) => game.join(`local-${index + 1}`, name));
    game.start(host);
    showRoom({
      initial: game.view(),
      start() { game.start(host); render(game.view()); },
      guess(number, move) { game.guess(state.turn, number, move); render(game.view()); },
      close() {},
    });
  } catch (error) {
    message('home-status', error.message);
  }
});

start.addEventListener('click', () => {
  try { session?.start?.(); }
  catch (error) { notice(error.message); }
});

guessForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!session || pendingMove !== null) return;
  const move = state.move;
  pendingMove = move;
  guessForm.querySelector('button').disabled = true;
  message('room-status');
  try {
    session.guess(guessField.valueAsNumber, move);
  } catch (error) {
    notice(error.message);
  }
});

byId('copy').addEventListener('click', async () => {
  const code = session?.code;
  if (!code) return;
  const url = new URL(location.href);
  url.searchParams.set('room', code);
  const shareLink = url.protocol === 'https:' && url.hostname !== 'localhost';
  try {
    await navigator.clipboard.writeText(shareLink ? url.href : code);
    if (session?.code === code) message('room-status', shareLink ? '已複製邀請連結。' : '已複製房間碼。', 'info');
  } catch {
    if (session?.code === code) message('room-status', `請手動複製房間碼 ${code}。`);
  }
});

const invitation = new URL(location.href).searchParams.get('room')?.toUpperCase();
if (roomCodePattern.test(invitation || '')) {
  codeField.value = invitation;
  message('home-status', '輸入暱稱後，按「加入」進入好友的房間。', 'info');
}
