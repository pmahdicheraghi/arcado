import type { GameDifficulty, Player } from '../../app/types';

export const COLOR_WAR_SIZE = 5;
export const COLOR_WAR_CELL_COUNT = 25;
export const MAX_CASCADE_WAVES = 120;

export type ColorWarPhase = 'placement' | 'battle' | 'ended';

export interface ColorWarCell {
  player: Player | null;
  dots: number;
}

export interface WaveStepResult {
  nextBoard: ColorWarCell[];
  explodedIndices: number[];
  hasMore: boolean;
}

export function createColorWarBoard(): ColorWarCell[] {
  return Array.from({ length: COLOR_WAR_CELL_COUNT }, () => ({
    player: null,
    dots: 0,
  }));
}

export function indexToCoord(index: number): [row: number, col: number] {
  return [Math.floor(index / COLOR_WAR_SIZE), index % COLOR_WAR_SIZE];
}

export function coordToIndex(row: number, col: number): number {
  return row * COLOR_WAR_SIZE + col;
}

export function getOrthogonalNeighbors(index: number): number[] {
  const [row, col] = indexToCoord(index);
  const neighbors: number[] = [];

  if (row > 0) neighbors.push(coordToIndex(row - 1, col)); // Up
  if (row < COLOR_WAR_SIZE - 1) neighbors.push(coordToIndex(row + 1, col)); // Down
  if (col > 0) neighbors.push(coordToIndex(row, col - 1)); // Left
  if (col < COLOR_WAR_SIZE - 1) neighbors.push(coordToIndex(row, col + 1)); // Right

  return neighbors;
}

export type CardinalDirection = 'up' | 'down' | 'left' | 'right';

export interface ExplosionTrajectory {
  direction: CardinalDirection;
  isWall: boolean;
  targetIndex: number | null;
}

export function getExplosionTrajectories(index: number): ExplosionTrajectory[] {
  const [row, col] = indexToCoord(index);
  return [
    {
      direction: 'up',
      isWall: row === 0,
      targetIndex: row > 0 ? coordToIndex(row - 1, col) : null,
    },
    {
      direction: 'down',
      isWall: row === COLOR_WAR_SIZE - 1,
      targetIndex: row < COLOR_WAR_SIZE - 1 ? coordToIndex(row + 1, col) : null,
    },
    {
      direction: 'left',
      isWall: col === 0,
      targetIndex: col > 0 ? coordToIndex(row, col - 1) : null,
    },
    {
      direction: 'right',
      isWall: col === COLOR_WAR_SIZE - 1,
      targetIndex: col < COLOR_WAR_SIZE - 1 ? coordToIndex(row, col + 1) : null,
    },
  ];
}

export function isValidMove(board: readonly ColorWarCell[], phase: ColorWarPhase, index: number, player: Player): boolean {
  if (index < 0 || index >= COLOR_WAR_CELL_COUNT) return false;
  const cell = board[index];
  if (phase === 'placement') {
    return cell.player === null && cell.dots === 0;
  }
  if (phase === 'battle') {
    return cell.player === player && cell.dots > 0;
  }
  return false;
}

export function getValidMoves(board: readonly ColorWarCell[], phase: ColorWarPhase, player: Player): number[] {
  if (phase === 'ended') return [];
  const moves: number[] = [];
  for (let i = 0; i < COLOR_WAR_CELL_COUNT; i++) {
    if (isValidMove(board, phase, i, player)) {
      moves.push(i);
    }
  }
  return moves;
}

export function applyPlacement(board: readonly ColorWarCell[], index: number, player: Player): ColorWarCell[] {
  const next = board.map((c) => ({ ...c }));
  next[index] = { player, dots: 3 };
  return next;
}

export function applyBattleTap(board: readonly ColorWarCell[], index: number): ColorWarCell[] {
  const next = board.map((c) => ({ ...c }));
  next[index] = {
    ...next[index],
    dots: next[index].dots + 1,
  };
  return next;
}

export function stepExplosionWave(board: readonly ColorWarCell[]): WaveStepResult {
  const explodedIndices: number[] = [];
  for (let i = 0; i < COLOR_WAR_CELL_COUNT; i++) {
    if (board[i].dots >= 4 && board[i].player !== null) {
      explodedIndices.push(i);
    }
  }

  if (explodedIndices.length === 0) {
    return {
      nextBoard: board.map((c) => ({ ...c })),
      explodedIndices: [],
      hasMore: false,
    };
  }

  // Clone cells
  const nextBoard: ColorWarCell[] = board.map((c) => ({ ...c }));

  // Collect incoming dots per cell: map index -> Array of players
  const incomingDots: { player: Player; count: number }[][] = Array.from({ length: COLOR_WAR_CELL_COUNT }, () => []);

  for (const idx of explodedIndices) {
    const explodingCell = board[idx];
    const explodingPlayer = explodingCell.player!;

    // Exploding cell loses 4 dots
    nextBoard[idx].dots -= 4;
    if (nextBoard[idx].dots <= 0) {
      nextBoard[idx].dots = 0;
      nextBoard[idx].player = null;
    }

    // Distribute 1 dot to each in-bounds orthogonal neighbor
    const neighbors = getOrthogonalNeighbors(idx);
    for (const nIdx of neighbors) {
      incomingDots[nIdx].push({ player: explodingPlayer, count: 1 });
    }
  }

  // Apply incoming dots to neighbors
  for (let i = 0; i < COLOR_WAR_CELL_COUNT; i++) {
    const arrivals = incomingDots[i];
    if (arrivals.length === 0) continue;

    for (const arrival of arrivals) {
      nextBoard[i].dots += arrival.count;
      nextBoard[i].player = arrival.player; // Converted / claimed
    }
  }

  // Check if any cells are still >= 4 dots for next cascade wave
  const hasMore = nextBoard.some((c) => c.dots >= 4 && c.player !== null);

  return {
    nextBoard,
    explodedIndices,
    hasMore,
  };
}

export function simulateFullCascade(
  initialBoard: readonly ColorWarCell[],
  maxWaves = MAX_CASCADE_WAVES,
): { finalBoard: ColorWarCell[]; waves: number; totalExplosions: number } {
  let currentBoard = initialBoard.map((c) => ({ ...c }));
  let waves = 0;
  let totalExplosions = 0;

  while (waves < maxWaves) {
    const step = stepExplosionWave(currentBoard);
    if (step.explodedIndices.length === 0) break;
    waves++;
    totalExplosions += step.explodedIndices.length;
    currentBoard = step.nextBoard;
    if (!step.hasMore) break;
  }

  return {
    finalBoard: currentBoard,
    waves,
    totalExplosions,
  };
}

export function countDiscs(board: readonly ColorWarCell[]): { X: number; O: number; dotsX: number; dotsO: number } {
  let countX = 0;
  let countO = 0;
  let dotsX = 0;
  let dotsO = 0;

  for (const cell of board) {
    if (cell.player === 'X' && cell.dots > 0) {
      countX++;
      dotsX += cell.dots;
    } else if (cell.player === 'O' && cell.dots > 0) {
      countO++;
      dotsO += cell.dots;
    }
  }

  return { X: countX, O: countO, dotsX, dotsO };
}

export function checkWinner(board: readonly ColorWarCell[], phase: ColorWarPhase): Player | null {
  if (phase !== 'battle') return null;
  const counts = countDiscs(board);
  if (counts.X === 0 && counts.O > 0) return 'O';
  if (counts.O === 0 && counts.X > 0) return 'X';
  return null;
}

export function chooseColorWarBotMove(
  board: readonly ColorWarCell[],
  phase: ColorWarPhase,
  botPlayer: Player,
  difficulty: GameDifficulty,
): number {
  const validMoves = getValidMoves(board, phase, botPlayer);
  if (validMoves.length === 0) return -1;

  if (phase === 'placement') {
    if (difficulty === 'easy') {
      return validMoves[Math.floor(Math.random() * validMoves.length)];
    }
    const centerIndex = 12; // (2, 2)
    const opponent: Player = botPlayer === 'X' ? 'O' : 'X';
    const opponentCell = board.findIndex((c) => c.player === opponent);

    if (opponentCell === -1) {
      return validMoves.includes(centerIndex) ? centerIndex : validMoves[0];
    }

    const [oppR, oppC] = indexToCoord(opponentCell);
    let bestMove = validMoves[0];
    let bestDist = -1;

    for (const move of validMoves) {
      const [r, c] = indexToCoord(move);
      const dist = Math.abs(r - oppR) + Math.abs(c - oppC);
      const score = difficulty === 'hard' ? -Math.abs(dist - 3) : dist;
      if (score > bestDist) {
        bestDist = score;
        bestMove = move;
      }
    }
    return bestMove;
  }

  // Battle phase
  if (difficulty === 'easy') {
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  const opponent: Player = botPlayer === 'X' ? 'O' : 'X';

  let bestScore = -Infinity;
  let bestMoves: number[] = [];

  for (const move of validMoves) {
    const tapped = applyBattleTap(board, move);
    const { finalBoard, totalExplosions } = simulateFullCascade(tapped);
    const counts = countDiscs(finalBoard);

    const botDiscs = botPlayer === 'X' ? counts.X : counts.O;
    const oppDiscs = botPlayer === 'X' ? counts.O : counts.X;
    const botDots = botPlayer === 'X' ? counts.dotsX : counts.dotsO;
    const oppDots = botPlayer === 'X' ? counts.dotsO : counts.dotsX;

    if (oppDiscs === 0 && botDiscs > 0) {
      return move;
    }

    let score = (botDiscs - oppDiscs) * 20 + (botDots - oppDots) * 3 + totalExplosions * 4;

    if (difficulty === 'hard') {
      const oppMoves = getValidMoves(finalBoard, 'battle', opponent);
      let worstOpponentDamage = 0;

      for (const oppMove of oppMoves) {
        const oppTapped = applyBattleTap(finalBoard, oppMove);
        const oppCascade = simulateFullCascade(oppTapped);
        const oppResultCounts = countDiscs(oppCascade.finalBoard);
        const oppFinalDiscs = botPlayer === 'X' ? oppResultCounts.O : oppResultCounts.X;
        const botFinalDiscs = botPlayer === 'X' ? oppResultCounts.X : oppResultCounts.O;
        const damage = oppFinalDiscs - botFinalDiscs;
        if (damage > worstOpponentDamage) {
          worstOpponentDamage = damage;
        }
      }

      score -= worstOpponentDamage * 25;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}
