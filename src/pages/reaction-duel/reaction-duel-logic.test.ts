import assert from 'node:assert';
import { resolveReactionAttempt, getReactionMatchWinner } from './reaction-duel-logic.ts';

// False start
assert.deepStrictEqual(
  resolveReactionAttempt('waiting', 'X', 0, 500, false, false),
  { kind: 'false-start', falseStart: 'X', winner: 'O' },
  'Early tap in waiting phase should trigger false start',
);

// First reaction in go phase
assert.deepStrictEqual(
  resolveReactionAttempt('go', 'X', 1000, 1250, false, false),
  { kind: 'reaction', reaction: 250, winner: 'X' },
  'First tap in go phase should register reaction and award win',
);

// Duplicate tap in go phase
assert.deepStrictEqual(
  resolveReactionAttempt('go', 'X', 1000, 1300, true, false),
  { kind: 'ignored' },
  'Already reacted player tap should be ignored',
);

// Late tap in result phase (second player)
assert.deepStrictEqual(
  resolveReactionAttempt('result', 'O', 1000, 1310, false, false),
  { kind: 'late-reaction', reaction: 310 },
  'Second player tap in result phase should register late-reaction without changing winner',
);

// Second player already tapped in result phase
assert.deepStrictEqual(
  resolveReactionAttempt('result', 'O', 1000, 1350, true, false),
  { kind: 'ignored' },
  'Duplicate late tap should be ignored',
);

// Tap in result phase after false start
assert.deepStrictEqual(
  resolveReactionAttempt('result', 'O', 0, 600, false, true),
  { kind: 'ignored' },
  'Taps after false start should be ignored',
);

// Tap in idle phase
assert.deepStrictEqual(resolveReactionAttempt('idle', 'X', 0, 0, false, false), { kind: 'ignored' }, 'Tap in idle phase should be ignored');

// Match winner
assert.strictEqual(getReactionMatchWinner({ X: 3, O: 2 }), 'X');
assert.strictEqual(getReactionMatchWinner({ X: 1, O: 2 }), 'O');
assert.strictEqual(getReactionMatchWinner({ X: 2, O: 2 }), 'draw');
