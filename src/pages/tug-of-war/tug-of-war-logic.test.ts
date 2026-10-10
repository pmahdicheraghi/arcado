import assert from 'node:assert';
import { clampPosition, checkTugWinner, PULL_THRESHOLD } from './tug-of-war-logic.ts';

assert.strictEqual(clampPosition(0), 0);
assert.strictEqual(clampPosition(PULL_THRESHOLD + 20), PULL_THRESHOLD);
assert.strictEqual(clampPosition(-PULL_THRESHOLD - 20), -PULL_THRESHOLD);
assert.strictEqual(checkTugWinner(0), null);
assert.strictEqual(checkTugWinner(-PULL_THRESHOLD), 'X');
assert.strictEqual(checkTugWinner(PULL_THRESHOLD), 'O');
