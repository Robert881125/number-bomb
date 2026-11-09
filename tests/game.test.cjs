const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createGame } = require('../game.js');

function setup() {
  const game = createGame('a', '阿明', () => 42);
  game.join('b', '小美');
  return game;
}

test('starting requires two players, and only the host can start', () => {
  const game = createGame('a', '阿明');
  assert.throws(() => game.start('a'));
  game.join('b', '小美');
  assert.throws(() => game.start('b'));
  game.start('a');
  assert.throws(() => game.start('a'));
  assert.throws(() => game.join('c', '小林'));
});

test('valid guesses shrink the inclusive range and advance the turn', () => {
  const game = setup();
  game.start('a');
  assert.throws(() => game.guess('b', 50, 1));
  assert.throws(() => game.guess('a', 0, 1));
  assert.throws(() => game.guess('a', 3.5, 1));
  game.guess('a', 50, 1);
  assert.equal(game.view().high, 49);
  assert.equal(game.view().turn, 'b');
  game.guess('b', 41, 2);
  assert.equal(game.view().low, 42);
  assert.throws(() => game.guess('a', 41, 3));
  assert.throws(() => game.guess('a', 42, 1));
  assert.equal(game.view().turn, 'a');
});

test('bomb stays private until hit, and rematch resets the board', () => {
  const game = setup();
  game.start('a');
  assert.equal(game.view().bomb, null);
  game.guess('a', 42, 1);
  assert.equal(game.view().bomb, 42);
  assert.equal(game.view().loser, '阿明');
  game.start('a');
  assert.deepEqual([game.view().low, game.view().high, game.view().turn], [1, 100, 'b']);
  assert.deepEqual(game.view().history, []);
  assert.throws(() => game.guess('b', 42, 1));
});

test('departure advances the active turn and stops a one-player round', () => {
  const game = setup();
  game.join('c', '小林');
  game.start('a');
  game.guess('a', 50, 1);
  game.leave('b');
  assert.equal(game.view().turn, 'c');
  game.leave('c');
  assert.equal(game.view().phase, 'lobby');
  game.join('d', '小王');
  game.start('a');
  assert.deepEqual([game.view().low, game.view().high], [1, 100]);
});
