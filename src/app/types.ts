export type View =
  'menu' | 'tic' | 'memory' | 'reaction' | 'connect' | 'dots' | 'othello' | 'nim' | 'tug' | 'colorwar' | 'settings' | 'stats';
export type GameMode = 'bot' | 'two';
export type Player = 'X' | 'O';
export type GameDifficulty = 'easy' | 'normal' | 'hard';
export type GameRounds = 1 | 3 | 5;

/** Alternates the player who opens each round, starting with player 1. */
export function getRoundStarter(round: number): Player {
  return round % 2 === 0 ? 'O' : 'X';
}

export interface GameSetup {
  mode: GameMode;
  difficulty: GameDifficulty;
  rounds: GameRounds;
}
