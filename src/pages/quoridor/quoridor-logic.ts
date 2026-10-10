import type { GameDifficulty, Player } from '../../app/types.ts';

export const QUORIDOR_SIZE = 7;
export const QUORIDOR_WALL_GRID = QUORIDOR_SIZE - 1; // 6x6 interior intersections (0..5)
export const INITIAL_WALLS = 6;

export interface CellPos {
  row: number;
  col: number;
}

export type WallOrientation = 'h' | 'v';

export interface QuoridorWall {
  row: number;
  col: number;
  orientation: WallOrientation;
  owner?: Player;
}

export interface QuoridorState {
  pawns: Record<Player, CellPos>;
  walls: QuoridorWall[];
  remainingWalls: Record<Player, number>;
}

export type QuoridorMove = { kind: 'move'; to: CellPos } | { kind: 'wall'; wall: QuoridorWall };

const ORTHOGONAL_DIRS: readonly CellPos[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

export function createQuoridorState(): QuoridorState {
  const center = Math.floor(QUORIDOR_SIZE / 2);
  return {
    pawns: {
      X: { row: QUORIDOR_SIZE - 1, col: center },
      O: { row: 0, col: center },
    },
    walls: [],
    remainingWalls: {
      X: INITIAL_WALLS,
      O: INITIAL_WALLS,
    },
  };
}

export function getGoalRow(player: Player): number {
  return player === 'X' ? 0 : QUORIDOR_SIZE - 1;
}

export function checkQuoridorWinner(state: QuoridorState): Player | null {
  if (state.pawns.X.row === 0) return 'X';
  if (state.pawns.O.row === QUORIDOR_SIZE - 1) return 'O';
  return null;
}

export function isInBounds(pos: CellPos): boolean {
  return pos.row >= 0 && pos.row < QUORIDOR_SIZE && pos.col >= 0 && pos.col < QUORIDOR_SIZE;
}

export function sameCell(a: CellPos, b: CellPos): boolean {
  return a.row === b.row && a.col === b.col;
}

/**
 * Checks whether an orthogonal step of length 1 between `from` and `to` is blocked by any wall.
 */
export function isEdgeBlocked(walls: readonly QuoridorWall[], from: CellPos, to: CellPos): boolean {
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  if (Math.abs(dr) + Math.abs(dc) !== 1) return true;

  if (dr !== 0) {
    // Vertical movement across horizontal groove row = min(from.row, to.row)
    const grooveRow = Math.min(from.row, to.row);
    const col = from.col;
    return walls.some((w) => w.orientation === 'h' && w.row === grooveRow && (w.col === col || w.col === col - 1));
  }

  // Horizontal movement across vertical groove col = min(from.col, to.col)
  const grooveCol = Math.min(from.col, to.col);
  const row = from.row;
  return walls.some((w) => w.orientation === 'v' && w.col === grooveCol && (w.row === row || w.row === row - 1));
}

export function getValidPawnMoves(state: QuoridorState, player: Player): CellPos[] {
  const cur = state.pawns[player];
  const opp = state.pawns[player === 'X' ? 'O' : 'X'];
  const moves: CellPos[] = [];

  for (const dir of ORTHOGONAL_DIRS) {
    const next: CellPos = { row: cur.row + dir.row, col: cur.col + dir.col };
    if (!isInBounds(next) || isEdgeBlocked(state.walls, cur, next)) continue;

    if (!sameCell(next, opp)) {
      moves.push(next);
      continue;
    }

    // Opponent is adjacent in direction `dir`: try straight jump first
    const jumpStraight: CellPos = { row: next.row + dir.row, col: next.col + dir.col };
    if (isInBounds(jumpStraight) && !isEdgeBlocked(state.walls, next, jumpStraight)) {
      moves.push(jumpStraight);
    } else {
      // Straight jump blocked by wall or board edge -> allow perpendicular diagonal jumps
      const perpDirs: CellPos[] =
        dir.row !== 0
          ? [
              { row: 0, col: -1 },
              { row: 0, col: 1 },
            ]
          : [
              { row: -1, col: 0 },
              { row: 1, col: 0 },
            ];
      for (const pDir of perpDirs) {
        const diag: CellPos = { row: next.row + pDir.row, col: next.col + pDir.col };
        if (isInBounds(diag) && !isEdgeBlocked(state.walls, next, diag)) {
          moves.push(diag);
        }
      }
    }
  }

  return moves;
}

export function isValidPawnMove(state: QuoridorState, player: Player, to: CellPos): boolean {
  return getValidPawnMoves(state, player).some((m) => sameCell(m, to));
}

/**
 * BFS shortest path distance (in steps) from a player's current cell to any cell on their goal row.
 * Returns Infinity if no path exists.
 */
export function shortestPathDistance(state: QuoridorState, player: Player, startOverride?: CellPos): number {
  const start = startOverride ?? state.pawns[player];
  const goalRow = getGoalRow(player);
  if (start.row === goalRow) return 0;

  const visited = new Uint8Array(QUORIDOR_SIZE * QUORIDOR_SIZE);
  const queueRow = new Int8Array(QUORIDOR_SIZE * QUORIDOR_SIZE);
  const queueCol = new Int8Array(QUORIDOR_SIZE * QUORIDOR_SIZE);
  const queueDist = new Uint8Array(QUORIDOR_SIZE * QUORIDOR_SIZE);

  let head = 0;
  let tail = 0;
  const startIdx = start.row * QUORIDOR_SIZE + start.col;
  visited[startIdx] = 1;
  queueRow[tail] = start.row;
  queueCol[tail] = start.col;
  queueDist[tail] = 0;
  tail++;

  while (head < tail) {
    const r = queueRow[head];
    const c = queueCol[head];
    const d = queueDist[head];
    head++;

    for (const dir of ORTHOGONAL_DIRS) {
      const nr = r + dir.row;
      const nc = c + dir.col;
      if (nr < 0 || nr >= QUORIDOR_SIZE || nc < 0 || nc >= QUORIDOR_SIZE) continue;
      const nIdx = nr * QUORIDOR_SIZE + nc;
      if (visited[nIdx]) continue;
      if (isEdgeBlocked(state.walls, { row: r, col: c }, { row: nr, col: nc })) continue;
      if (nr === goalRow) return d + 1;
      visited[nIdx] = 1;
      queueRow[tail] = nr;
      queueCol[tail] = nc;
      queueDist[tail] = d + 1;
      tail++;
    }
  }

  return Infinity;
}

export function isWallGeometryValid(walls: readonly QuoridorWall[], candidate: QuoridorWall): boolean {
  const { row, col, orientation } = candidate;
  if (row < 0 || row >= QUORIDOR_WALL_GRID || col < 0 || col >= QUORIDOR_WALL_GRID) {
    return false;
  }

  for (const w of walls) {
    // Same intersection (either exact duplicate or orthogonal cross)
    if (w.row === row && w.col === col) return false;
    // Collinear overlap of 1 segment
    if (orientation === 'h' && w.orientation === 'h' && w.row === row && Math.abs(w.col - col) === 1) {
      return false;
    }
    if (orientation === 'v' && w.orientation === 'v' && w.col === col && Math.abs(w.row - row) === 1) {
      return false;
    }
  }

  return true;
}

export function isValidWallPlacement(state: QuoridorState, player: Player, wall: QuoridorWall): boolean {
  if (state.remainingWalls[player] <= 0) return false;
  if (!isWallGeometryValid(state.walls, wall)) return false;

  const nextWalls = [...state.walls, wall];
  const nextState: QuoridorState = {
    ...state,
    walls: nextWalls,
  };

  // Both players must retain at least one valid path to their goal row
  return Number.isFinite(shortestPathDistance(nextState, 'X')) && Number.isFinite(shortestPathDistance(nextState, 'O'));
}

export function getValidOrientationsAt(state: QuoridorState, player: Player, row: number, col: number): WallOrientation[] {
  const orientations: WallOrientation[] = [];
  for (const orientation of ['h', 'v'] as const) {
    if (isValidWallPlacement(state, player, { row, col, orientation })) {
      orientations.push(orientation);
    }
  }
  return orientations;
}

export function applyQuoridorMove(state: QuoridorState, player: Player, move: QuoridorMove): QuoridorState {
  if (move.kind === 'move') {
    return {
      ...state,
      pawns: {
        ...state.pawns,
        [player]: { row: move.to.row, col: move.to.col },
      },
    };
  }

  return {
    ...state,
    walls: [...state.walls, { ...move.wall, owner: player }],
    remainingWalls: {
      ...state.remainingWalls,
      [player]: Math.max(0, state.remainingWalls[player] - 1),
    },
  };
}

function getBestPawnStep(state: QuoridorState, player: Player): CellPos {
  const validMoves = getValidPawnMoves(state, player);
  const opponent: Player = player === 'X' ? 'O' : 'X';
  let bestMove = validMoves[0];
  let bestDist = Infinity;

  for (const move of validMoves) {
    const nextState = applyQuoridorMove(state, player, { kind: 'move', to: move });
    const d = shortestPathDistance(nextState, player);
    const centerBias = Math.abs(move.col - Math.floor(QUORIDOR_SIZE / 2)) * 0.01;
    const oppDist = shortestPathDistance(nextState, opponent);
    const score = d + centerBias - oppDist * 0.001;
    if (score < bestDist) {
      bestDist = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function getCandidateWallsNearPlayers(state: QuoridorState, botPlayer: Player): QuoridorWall[] {
  const opponent: Player = botPlayer === 'X' ? 'O' : 'X';
  const oppPos = state.pawns[opponent];
  const botPos = state.pawns[botPlayer];
  const candidates: QuoridorWall[] = [];

  for (let r = 0; r < QUORIDOR_WALL_GRID; r++) {
    for (let c = 0; c < QUORIDOR_WALL_GRID; c++) {
      const nearOpp = Math.abs(r - oppPos.row) <= 2 && Math.abs(c - oppPos.col) <= 2;
      const nearBot = Math.abs(r - botPos.row) <= 1 && Math.abs(c - botPos.col) <= 1;
      if (!nearOpp && !nearBot) continue;

      for (const orientation of ['h', 'v'] as const) {
        const wall: QuoridorWall = { row: r, col: c, orientation };
        if (isValidWallPlacement(state, botPlayer, wall)) {
          candidates.push(wall);
        }
      }
    }
  }

  return candidates;
}

export function chooseQuoridorBotMove(state: QuoridorState, botPlayer: Player, difficulty: GameDifficulty): QuoridorMove {
  const opponent: Player = botPlayer === 'X' ? 'O' : 'X';
  const validMoves = getValidPawnMoves(state, botPlayer);
  const bestStep = getBestPawnStep(state, botPlayer);

  // Immediate winning step always taken
  if (bestStep.row === getGoalRow(botPlayer)) {
    return { kind: 'move', to: bestStep };
  }

  const curBotDist = shortestPathDistance(state, botPlayer);
  const curOppDist = shortestPathDistance(state, opponent);

  if (difficulty === 'easy') {
    if (state.remainingWalls[botPlayer] > 0 && Math.random() < 0.22) {
      const candidates = getCandidateWallsNearPlayers(state, botPlayer);
      if (candidates.length > 0) {
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        return { kind: 'wall', wall: picked };
      }
    }
    if (Math.random() < 0.3 && validMoves.length > 1) {
      return { kind: 'move', to: validMoves[Math.floor(Math.random() * validMoves.length)] };
    }
    return { kind: 'move', to: bestStep };
  }

  // ponytail: 1-ply wall evaluation over candidate intersections (36x2 max) keeps bot instant (<2ms) on mobile; upgrade path is 2-ply alpha-beta if deeper wall traps are needed.
  if (state.remainingWalls[botPlayer] > 0) {
    const candidates =
      difficulty === 'hard'
        ? (() => {
            const all: QuoridorWall[] = [];
            for (let r = 0; r < QUORIDOR_WALL_GRID; r++) {
              for (let c = 0; c < QUORIDOR_WALL_GRID; c++) {
                for (const orientation of ['h', 'v'] as const) {
                  const wall: QuoridorWall = { row: r, col: c, orientation };
                  if (isValidWallPlacement(state, botPlayer, wall)) all.push(wall);
                }
              }
            }
            return all;
          })()
        : getCandidateWallsNearPlayers(state, botPlayer);

    let bestWall: QuoridorWall | null = null;
    let bestDeltaGain = 0;

    const baseDelta = curOppDist - curBotDist;

    for (const wall of candidates) {
      const nextState = applyQuoridorMove(state, botPlayer, { kind: 'wall', wall });
      const nextBotDist = shortestPathDistance(nextState, botPlayer);
      const nextOppDist = shortestPathDistance(nextState, opponent);
      const nextDelta = nextOppDist - nextBotDist;
      const gain = nextDelta - baseDelta;

      if (gain > bestDeltaGain) {
        bestDeltaGain = gain;
        bestWall = wall;
      }
    }

    if (difficulty === 'normal') {
      if (bestWall && curOppDist <= curBotDist && bestDeltaGain >= 1 && Math.random() < 0.75) {
        return { kind: 'wall', wall: bestWall };
      }
    } else {
      const stateAfterMove = applyQuoridorMove(state, botPlayer, { kind: 'move', to: bestStep });
      const moveAdvance = curBotDist - shortestPathDistance(stateAfterMove, botPlayer);
      if (
        bestWall &&
        (bestDeltaGain > moveAdvance || (curOppDist <= 2 && bestDeltaGain >= 1) || (curOppDist <= curBotDist && bestDeltaGain >= 2))
      ) {
        return { kind: 'wall', wall: bestWall };
      }
    }
  }

  return { kind: 'move', to: bestStep };
}
