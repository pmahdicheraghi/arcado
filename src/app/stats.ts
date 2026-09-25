import type { GameDifficulty, View } from './types';

export type GameKey = Exclude<View, 'menu' | 'settings' | 'stats'>;

export const GAME_KEYS: readonly GameKey[] = ['tic', 'memory', 'reaction', 'connect', 'dots', 'othello', 'nim', 'tug', 'colorwar'] as const;

export interface GameStats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestStreak: number;
  winsByDifficulty: Record<GameDifficulty, number>;
  bestReactionMs?: number;
}

export type AllStats = Record<GameKey, GameStats>;

type StoredStats = Partial<AllStats> & { reversi?: GameStats };

const STATS_STORAGE_KEY = 'side-quest-stats';

function createDefaultGameStats(): GameStats {
  return {
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    bestStreak: 0,
    winsByDifficulty: { easy: 0, normal: 0, hard: 0 },
  };
}

export function createDefaultAllStats(): AllStats {
  return {
    tic: createDefaultGameStats(),
    memory: createDefaultGameStats(),
    reaction: createDefaultGameStats(),
    connect: createDefaultGameStats(),
    dots: createDefaultGameStats(),
    othello: createDefaultGameStats(),
    nim: createDefaultGameStats(),
    tug: createDefaultGameStats(),
    colorwar: createDefaultGameStats(),
  };
}

export function loadStats(): AllStats {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return createDefaultAllStats();
    const parsed = JSON.parse(raw) as StoredStats;
    const result = createDefaultAllStats();
    for (const key of GAME_KEYS) {
      const item = parsed[key] ?? (key === 'othello' ? parsed.reversi : undefined);
      if (item && typeof item === 'object') {
        result[key] = {
          played: Number(item.played) || 0,
          wins: Number(item.wins) || 0,
          losses: Number(item.losses) || 0,
          draws: Number(item.draws) || 0,
          streak: Number(item.streak) || 0,
          bestStreak: Number(item.bestStreak) || 0,
          winsByDifficulty: {
            easy: Number(item.winsByDifficulty?.easy) || 0,
            normal: Number(item.winsByDifficulty?.normal) || 0,
            hard: Number(item.winsByDifficulty?.hard) || 0,
          },
          bestReactionMs: typeof item.bestReactionMs === 'number' && item.bestReactionMs > 0 ? item.bestReactionMs : undefined,
        };
      }
    }
    return result;
  } catch {
    return createDefaultAllStats();
  }
}

export function saveStats(stats: AllStats): void {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Stats remain in memory if storage is disabled
  }
}

export function recordMatchResult(
  game: GameKey,
  outcome: 'win' | 'loss' | 'draw',
  extras?: { reactionMs?: number; difficulty?: GameDifficulty },
): AllStats {
  const all = loadStats();
  const current = all[game] ?? createDefaultGameStats();

  const nextStreak = outcome === 'win' ? current.streak + 1 : 0;
  const nextBestStreak = Math.max(current.bestStreak, nextStreak);

  let nextBestReaction = current.bestReactionMs;
  if (extras?.reactionMs && extras.reactionMs > 0) {
    nextBestReaction = nextBestReaction ? Math.min(nextBestReaction, extras.reactionMs) : extras.reactionMs;
  }

  all[game] = {
    played: current.played + 1,
    wins: current.wins + (outcome === 'win' ? 1 : 0),
    losses: current.losses + (outcome === 'loss' ? 1 : 0),
    draws: current.draws + (outcome === 'draw' ? 1 : 0),
    streak: nextStreak,
    bestStreak: nextBestStreak,
    winsByDifficulty: {
      ...current.winsByDifficulty,
      ...(outcome === 'win' && extras?.difficulty ? { [extras.difficulty]: current.winsByDifficulty[extras.difficulty] + 1 } : {}),
    },
    bestReactionMs: nextBestReaction,
  };

  saveStats(all);
  return all;
}

export function resetAllStats(): AllStats {
  const defaults = createDefaultAllStats();
  saveStats(defaults);
  return defaults;
}
