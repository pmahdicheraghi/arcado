import assert from 'node:assert';
import {
  createNimBoard,
  isValidNimMove,
  applyNimMove,
  isNimGameOver,
  calculateNimSum,
  getOptimalNimMove,
} from '../src/pages/nim/nim-logic.ts';
import {
  clampPosition,
  checkTugWinner,
  PULL_THRESHOLD,
} from '../src/pages/tug-of-war/tug-of-war-logic.ts';
import { resolveHeaderAction } from '../src/app/usePwaUpdate.ts';

// 1. Nim Logic Checks
const board = createNimBoard();
assert.deepStrictEqual(board, [3, 4, 5], 'Nim initial board should be [3, 4, 5]');

// 3 ^ 4 ^ 5 = 2 != 0
const initialNimSum = calculateNimSum(board);
assert.strictEqual(initialNimSum, 2, 'Initial Nim sum should be 2');

// Optimal move should leave Nim sum = 0
const optMove = getOptimalNimMove(board);
assert(isValidNimMove(board, optMove), 'Optimal move must be valid');
const nextBoard = applyNimMove(board, optMove);
assert.strictEqual(calculateNimSum(nextBoard), 0, 'Applying optimal move must reduce Nim sum to 0');

// Terminal state
assert.strictEqual(isNimGameOver([0, 0, 0]), true, 'All zero board is game over');
assert.strictEqual(isNimGameOver([0, 1, 0]), false, 'Non-zero board is not game over');

// 2. Tug of War Logic Checks
assert.strictEqual(clampPosition(0), 0);
assert.strictEqual(clampPosition(PULL_THRESHOLD + 20), PULL_THRESHOLD);
assert.strictEqual(clampPosition(-PULL_THRESHOLD - 20), -PULL_THRESHOLD);
assert.strictEqual(checkTugWinner(0), null);
assert.strictEqual(checkTugWinner(-PULL_THRESHOLD), 'X');
assert.strictEqual(checkTugWinner(PULL_THRESHOLD), 'O');
// 3. PWA Header Action Logic Checks
assert.strictEqual(
  resolveHeaderAction({ isInstalled: false, canInstall: true, isUpdateAvailable: false }),
  'install',
  'Uninstalled with prompt should show install button'
);
assert.strictEqual(
  resolveHeaderAction({ isInstalled: true, canInstall: true, isUpdateAvailable: false }),
  'status',
  'Installed app must never show install button'
);
assert.strictEqual(
  resolveHeaderAction({ isInstalled: true, canInstall: false, isUpdateAvailable: true }),
  'update',
  'Installed with update available should show update button'
);
assert.strictEqual(
  resolveHeaderAction({ isInstalled: true, canInstall: false, isUpdateAvailable: false }),
  'status',
  'Installed without update should show online/offline status'
);
assert.strictEqual(
  resolveHeaderAction({ isInstalled: false, canInstall: true, isUpdateAvailable: true }),
  'install',
  'Uninstalled should show install even if update is ready'
);
assert.strictEqual(
  resolveHeaderAction({ isInstalled: false, canInstall: false, isUpdateAvailable: true }),
  'status',
  'Uninstalled without prompt should fallback to status'
);

// 4. Color War Logic Checks
import {
  createColorWarBoard,
  isValidMove as isValidColorWarMove,
  applyPlacement as applyColorWarPlacement,
  applyBattleTap as applyColorWarBattleTap,
  stepExplosionWave,
  simulateFullCascade,
  checkWinner as checkColorWarWinner,
  chooseColorWarBotMove,
  getOrthogonalNeighbors,
  getExplosionTrajectories,
  countDiscs as countColorWarDiscs,
} from '../src/pages/color-war/color-war-logic.ts';

// Initial board
const cwBoard = createColorWarBoard();
assert.strictEqual(cwBoard.length, 25, 'Board must have 25 cells');
assert(cwBoard.every((c) => c.player === null && c.dots === 0), 'All cells must start empty');
assert.deepStrictEqual(getOrthogonalNeighbors(0), [5, 1], 'Corner cell (0,0) neighbors should be (1,0) and (0,1)');

// Corner trajectories
const cornerTrajs = getExplosionTrajectories(0);
assert.strictEqual(cornerTrajs.find((t) => t.direction === 'up')?.isWall, true);
assert.strictEqual(cornerTrajs.find((t) => t.direction === 'left')?.isWall, true);
assert.strictEqual(cornerTrajs.find((t) => t.direction === 'down')?.targetIndex, 5);
assert.strictEqual(cornerTrajs.find((t) => t.direction === 'right')?.targetIndex, 1);

// Placement rules
assert.strictEqual(isValidColorWarMove(cwBoard, 'placement', 0, 'X'), true);
const boardAfterP1 = applyColorWarPlacement(cwBoard, 0, 'X');
assert.strictEqual(boardAfterP1[0].player, 'X');
assert.strictEqual(boardAfterP1[0].dots, 3);
// Cannot place on occupied cell
assert.strictEqual(isValidColorWarMove(boardAfterP1, 'placement', 0, 'O'), false);
assert.strictEqual(isValidColorWarMove(boardAfterP1, 'placement', 24, 'O'), true);

const boardAfterP2 = applyColorWarPlacement(boardAfterP1, 24, 'O');
assert.strictEqual(boardAfterP2[24].player, 'O');
assert.strictEqual(boardAfterP2[24].dots, 3);

// Battle rules: can only click own discs
assert.strictEqual(isValidColorWarMove(boardAfterP2, 'battle', 0, 'X'), true);
assert.strictEqual(isValidColorWarMove(boardAfterP2, 'battle', 24, 'X'), false, 'Cannot click opponent disc');
assert.strictEqual(isValidColorWarMove(boardAfterP2, 'battle', 12, 'X'), false, 'Cannot click empty cell');

// Wall absorption on corner explosion:
// Cell 0 is top-left corner (row 0, col 0). Neighbors on board: (0, 1) and (1, 0).
const tappedCorner = applyColorWarBattleTap(boardAfterP2, 0); // dots becomes 4
assert.strictEqual(tappedCorner[0].dots, 4);

const wave1 = stepExplosionWave(tappedCorner);
assert.strictEqual(wave1.explodedIndices.length, 1);
assert.strictEqual(wave1.explodedIndices[0], 0);
assert.strictEqual(wave1.nextBoard[0].dots, 0);
assert.strictEqual(wave1.nextBoard[0].player, null);
// Neighbors at index 1 and index 5 should receive 1 dot with player X
assert.strictEqual(wave1.nextBoard[1].player, 'X');
assert.strictEqual(wave1.nextBoard[1].dots, 1);
assert.strictEqual(wave1.nextBoard[5].player, 'X');
assert.strictEqual(wave1.nextBoard[5].dots, 1);
// Two wall-directed dots absorbed (not wrapped)
assert.strictEqual(wave1.hasMore, false);

// Opponent capture & multi-wave chain reaction:
// Cell 12 (X, 3 dots) taps to 4. Neighbor Cell 13 is (O, 3 dots).
const testBoard = createColorWarBoard();
testBoard[12] = { player: 'X', dots: 4 };
testBoard[13] = { player: 'O', dots: 3 };

const cascadeRes = simulateFullCascade(testBoard);
assert(cascadeRes.waves >= 2, 'Should cascade across multiple waves');
// Cell 13 must have been captured by X, exploded, and converted
assert.strictEqual(cascadeRes.finalBoard[13].player === 'O', false, 'O disc at 13 must be captured');
const finalCounts = countColorWarDiscs(cascadeRes.finalBoard);
assert.strictEqual(finalCounts.O, 0, 'All O discs wiped out');
assert.strictEqual(checkColorWarWinner(cascadeRes.finalBoard, 'battle'), 'X', 'X must win after eliminating O');

// Bot move generation
const botPlacement = chooseColorWarBotMove(cwBoard, 'placement', 'X', 'hard');
assert(botPlacement >= 0 && botPlacement < 25, 'Bot must choose a valid placement');

const botBattleMove = chooseColorWarBotMove(boardAfterP2, 'battle', 'O', 'hard');
assert.strictEqual(botBattleMove, 24, 'Bot O must choose its only disc at 24');

console.log('✓ All logic assertions passed successfully!');
