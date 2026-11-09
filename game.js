'use strict';

function playerName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 16) throw new Error('請輸入 1～16 個字的暱稱。');
  return name;
}

function createGame(host, name, pickBomb = () => Math.floor(Math.random() * 100) + 1) {
  let players = [{ id: host, name: playerName(name) }];
  let phase = 'lobby';
  let low = 1;
  let high = 100;
  let bomb;
  let turn = null;
  let loser = null;
  let history = [];
  let round = 0;
  let move = 0;

  function reset() {
    low = 1;
    high = 100;
    turn = null;
    loser = null;
    history = [];
  }

  return {
    join(id, name) {
      if (phase === 'playing') throw new Error('這局已經開始，請等下一局再加入。');
      if (players.length >= 8) throw new Error('房間已滿（最多 8 人）。');
      if (players.some(player => player.id === id)) throw new Error('你已經在房間裡了。');
      players.push({ id, name: playerName(name) });
    },
    leave(id) {
      const index = players.findIndex(player => player.id === id);
      if (index < 0 || id === host) return;
      players.splice(index, 1);
      if (phase !== 'playing') return;
      if (players.length < 2) {
        phase = 'lobby';
        reset();
      } else if (id === turn) {
        turn = players[index % players.length].id;
        move += 1;
      }
    },
    start(id) {
      if (id !== host) throw new Error('只有房主可以開始遊戲。');
      if (players.length < 2) throw new Error('至少需要 2 人才能開始。');
      if (phase === 'playing') throw new Error('遊戲已開始。');
      reset();
      bomb = pickBomb();
      turn = players[round % players.length].id;
      round += 1;
      move += 1;
      phase = 'playing';
    },
    guess(id, number, expectedMove) {
      if (phase !== 'playing' || turn !== id || move !== expectedMove) {
        throw new Error('回合已變更，請確認現在輪到誰。');
      }
      if (!Number.isInteger(number) || number < low || number > high) {
        throw new Error(`請輸入 ${low}～${high} 之間的整數。`);
      }
      const index = players.findIndex(player => player.id === id);
      const name = players[index].name;
      const hit = number === bomb;
      if (hit) {
        phase = 'finished';
        loser = name;
        turn = null;
      } else {
        if (number < bomb) low = number + 1;
        else high = number - 1;
        turn = players[(index + 1) % players.length].id;
      }
      move += 1;
      history.push({ name, number, hit, low, high });
    },
    view() {
      return {
        host, phase, low, high, turn, loser, round, move,
        bomb: phase === 'finished' ? bomb : null,
        players: players.map(player => ({ ...player })),
        history: history.map(entry => ({ ...entry })),
      };
    },
  };
}

if (typeof module !== 'undefined') module.exports = { createGame };
