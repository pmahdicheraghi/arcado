import assert from 'node:assert';
import {
  createNimBoard,
  isValidNimMove,
  applyNimMove,
  isNimGameOver,
  calculateNimSum,
  getOptimalNimMove,
} from '../src/pages/nim/nim-logic.ts';
import { clampPosition, checkTugWinner, PULL_THRESHOLD } from '../src/pages/tug-of-war/tug-of-war-logic.ts';
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
  'Uninstalled with prompt should show install button',
);
assert.strictEqual(
  resolveHeaderAction({ isInstalled: true, canInstall: true, isUpdateAvailable: false }),
  'status',
  'Installed app must never show install button',
);
assert.strictEqual(
  resolveHeaderAction({ isInstalled: true, canInstall: false, isUpdateAvailable: true }),
  'update',
  'Installed with update available should show update button',
);
assert.strictEqual(
  resolveHeaderAction({ isInstalled: true, canInstall: false, isUpdateAvailable: false }),
  'status',
  'Installed without update should show online/offline status',
);
assert.strictEqual(
  resolveHeaderAction({ isInstalled: false, canInstall: true, isUpdateAvailable: true }),
  'install',
  'Uninstalled should show install even if update is ready',
);
assert.strictEqual(
  resolveHeaderAction({ isInstalled: false, canInstall: false, isUpdateAvailable: true }),
  'status',
  'Uninstalled without prompt should fallback to status',
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
assert(
  cwBoard.every((c) => c.player === null && c.dots === 0),
  'All cells must start empty',
);
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

// Test Rule 1: Rush frontline cell to 3 when enemy is not ahead
const rushBoard = createColorWarBoard();
rushBoard[0] = { player: 'O', dots: 2 }; // Safe backline cell
rushBoard[6] = { player: 'O', dots: 2 }; // Frontline cell adjacent to 7
rushBoard[7] = { player: 'X', dots: 2 }; // Enemy cell, not ahead (dots <= 2, dots < 3)
for (let i = 0; i < 10; i++) {
  const botRushMove = chooseColorWarBotMove(rushBoard, 'battle', 'O', 'hard');
  assert.strictEqual(botRushMove, 6, 'Bot O must consistently rush frontline cell 6 to 3 instead of safe backline cell 0');
}

// Test Rule 1 edge case: Do NOT rush frontline cell if enemy is ahead
const dangerBoard = createColorWarBoard();
dangerBoard[0] = { player: 'O', dots: 2 }; // Safe backline cell
dangerBoard[6] = { player: 'O', dots: 2 }; // Frontline cell adjacent to 7
dangerBoard[7] = { player: 'X', dots: 3 }; // Enemy cell is ahead / ready to explode (dots 3)
const botSafeMove = chooseColorWarBotMove(dangerBoard, 'battle', 'O', 'hard');
assert.strictEqual(botSafeMove, 0, 'Bot O must not rush frontline cell 6 when enemy at 7 has 3 dots');

// Test Rule 2: Don't explode near opponent if opponent can recapture the taken cell
const trapBoard = createColorWarBoard();
trapBoard[0] = { player: 'O', dots: 1 }; // Safe backline cell
trapBoard[1] = { player: 'O', dots: 1 }; // Extra backline cell to keep disc count lead
trapBoard[6] = { player: 'O', dots: 3 }; // Frontline ready to explode into 7
trapBoard[7] = { player: 'X', dots: 2 }; // Enemy cell that 6 will take
trapBoard[8] = { player: 'X', dots: 3 }; // Enemy ready to explode and recapture 7
const botTrapMove = chooseColorWarBotMove(trapBoard, 'battle', 'O', 'hard');
assert.notStrictEqual(botTrapMove, 6, 'Bot O must not explode into cell 7 when enemy at 8 can immediately take it back');

// 5. Reaction Duel Logic Checks
import { resolveReactionAttempt, getReactionMatchWinner } from '../src/pages/reaction-duel/reaction-duel-logic.ts';

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

console.log('✓ All logic assertions passed successfully!');
