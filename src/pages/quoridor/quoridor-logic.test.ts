import assert from 'node:assert';
import {
  QUORIDOR_SIZE,
  INITIAL_WALLS,
  createQuoridorState,
  getValidPawnMoves,
  isValidPawnMove,
  isValidWallPlacement,
  getValidOrientationsAt,
  applyQuoridorMove,
  checkQuoridorWinner,
  shortestPathDistance,
  chooseQuoridorBotMove,
} from './quoridor-logic.ts';

const qInit = createQuoridorState();
assert.strictEqual(QUORIDOR_SIZE, 7, 'Quoridor board size must be 7');
assert.deepStrictEqual(qInit.pawns.X, { row: 6, col: 3 }, 'X starts at (6,3)');
assert.deepStrictEqual(qInit.pawns.O, { row: 0, col: 3 }, 'O starts at (0,3)');
assert.strictEqual(qInit.remainingWalls.X, INITIAL_WALLS, 'X starts with 6 walls');
assert.strictEqual(qInit.remainingWalls.O, INITIAL_WALLS, 'O starts with 6 walls');
assert.strictEqual(shortestPathDistance(qInit, 'X'), 6, 'Initial shortest path for X is 6');
assert.strictEqual(shortestPathDistance(qInit, 'O'), 6, 'Initial shortest path for O is 6');
assert.deepStrictEqual(getValidOrientationsAt(qInit, 'X', 2, 2), ['h', 'v'], 'Empty board intersection allows both h and v');

// Initial moves for X at (6,3): (5,3), (6,2), (6,4)
const xInitMoves = getValidPawnMoves(qInit, 'X');
assert.strictEqual(xInitMoves.length, 3, 'X at bottom center has 3 initial moves');
assert(isValidPawnMove(qInit, 'X', { row: 5, col: 3 }), 'X can step up to (5,3)');

// Wall placement & collision checks
const hWall = { row: 5, col: 3, orientation: 'h' as const };
assert.strictEqual(isValidWallPlacement(qInit, 'O', hWall), true, 'Valid horizontal wall at (5,3)');
const qAfterWall = applyQuoridorMove(qInit, 'O', { kind: 'wall', wall: hWall });
assert.strictEqual(qAfterWall.remainingWalls.O, INITIAL_WALLS - 1, 'O wall count decremented');
assert.strictEqual(isValidPawnMove(qAfterWall, 'X', { row: 5, col: 3 }), false, 'Horizontal wall at (5,3) blocks (6,3)->(5,3)');
assert.strictEqual(shortestPathDistance(qAfterWall, 'X'), 7, 'Horizontal wall forces 1-step detour for X');
assert.deepStrictEqual(getValidOrientationsAt(qAfterWall, 'X', 5, 3), [], 'Occupied intersection has no valid orientations');
assert.deepStrictEqual(getValidOrientationsAt(qAfterWall, 'X', 5, 2), ['v'], 'Adjacent horizontal overlap leaves only vertical valid');

// Crossing & overlapping walls must be rejected
assert.strictEqual(
  isValidWallPlacement(qAfterWall, 'X', { row: 5, col: 3, orientation: 'v' }),
  false,
  'Crossing wall at same intersection must be rejected',
);
assert.strictEqual(
  isValidWallPlacement(qAfterWall, 'X', { row: 5, col: 2, orientation: 'h' }),
  false,
  'Overlapping horizontal wall at (5,2) must be rejected',
);
assert.strictEqual(
  isValidWallPlacement(qAfterWall, 'X', { row: 5, col: 4, orientation: 'h' }),
  false,
  'Overlapping horizontal wall at (5,4) must be rejected',
);

// Face-to-face straight jump & diagonal jump when blocked behind
const jumpState = createQuoridorState();
jumpState.pawns.X = { row: 3, col: 3 };
jumpState.pawns.O = { row: 2, col: 3 };
assert.strictEqual(isValidPawnMove(jumpState, 'X', { row: 1, col: 3 }), true, 'X can jump straight over O to (1,3)');
assert.strictEqual(isValidPawnMove(jumpState, 'X', { row: 2, col: 2 }), false, 'Diagonal jump disallowed when straight jump is open');

const blockedJumpState = applyQuoridorMove(jumpState, 'O', {
  kind: 'wall',
  wall: { row: 1, col: 3, orientation: 'h' },
});
assert.strictEqual(isValidPawnMove(blockedJumpState, 'X', { row: 1, col: 3 }), false, 'Wall behind O blocks straight jump');
assert.strictEqual(isValidPawnMove(blockedJumpState, 'X', { row: 2, col: 2 }), true, 'X can jump diagonally left when blocked behind O');
assert.strictEqual(isValidPawnMove(blockedJumpState, 'X', { row: 2, col: 4 }), true, 'X can jump diagonally right when blocked behind O');

// BFS anti-trap check: sealing X completely in bottom-left corner (6,0) must be rejected
const sealState = createQuoridorState();
sealState.pawns.X = { row: 6, col: 0 };
sealState.walls = [
  { row: 5, col: 0, orientation: 'h' },
  { row: 5, col: 2, orientation: 'h' },
];
assert.strictEqual(
  isValidWallPlacement(sealState, 'O', { row: 5, col: 1, orientation: 'v' }),
  false,
  'Wall that completely traps X with no path to row 0 must be rejected',
);

// Win condition & bot moves
const winState = applyQuoridorMove({ ...createQuoridorState(), pawns: { X: { row: 1, col: 3 }, O: { row: 0, col: 0 } } }, 'X', {
  kind: 'move',
  to: { row: 0, col: 3 },
});
assert.strictEqual(checkQuoridorWinner(winState), 'X', 'X reaching row 0 wins');

for (const diff of ['easy', 'normal', 'hard'] as const) {
  const botMove = chooseQuoridorBotMove(qInit, 'O', diff);
  if (botMove.kind === 'move') {
    assert(isValidPawnMove(qInit, 'O', botMove.to), `Bot (${diff}) pawn move must be valid`);
  } else {
    assert(isValidWallPlacement(qInit, 'O', botMove.wall), `Bot (${diff}) wall placement must be valid`);
  }
}
