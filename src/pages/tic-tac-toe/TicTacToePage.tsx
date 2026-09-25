import anime from 'animejs';
import { useEffect, useState } from 'react';
import { animateIn, motionEnabled } from '../../app/animation';
import { useI18n } from '../../app/i18n';
import { triggerHaptic } from '../../app/settings';
import { playMoveSound, playPairSound } from '../../app/sfx';
import { recordMatchResult } from '../../app/stats';
import { getRoundStarter, type GameSetup, type Player } from '../../app/types';
import { GameHeader, GameStatus, MatchResultToast, ScoreStrip, Tip } from '../../components/react-layout';
import {
  chooseTicBotMove,
  createTicState,
  getExpiringTicCell,
  getTicResult,
  getTicWinningLine,
  playTicMove,
  type TicResult,
  type TicState,
} from './tic-tac-toe-logic';
import './tic-tac-toe.css';
import type { PlayerNames } from '../../app/player-names';

export function TicTacToePage({ setup, playerNames, onExit }: { setup: GameSetup; playerNames: PlayerNames; onExit: () => void }) {
  const { language, t } = useI18n();
  const mode = setup.mode;
  const [game, setGame] = useState<TicState>(createTicState);
  const [turn, setTurn] = useState<Player>('X');
  const [winner, setWinner] = useState<TicResult>(null);
  const [winningLine, setWinningLine] = useState<number[]>([]);
  const [scores, setScores] = useState<Record<Player, number>>({ X: 0, O: 0 });
  const [round, setRound] = useState(1);

  const board = game.board;

  const finishRound = (result: Exclude<TicResult, null>, finalGame: TicState, human: boolean) => {
    setWinner(result);
    setWinningLine(getTicWinningLine(finalGame.board) ?? []);
    const nextScores = { ...scores, [result]: scores[result] + 1 };
    setScores(nextScores);
    if (round >= setup.rounds) {
      const outcome = nextScores.X === nextScores.O ? 'draw' : nextScores.X > nextScores.O ? 'win' : 'loss';
      recordMatchResult('tic', outcome, { difficulty: mode === 'bot' ? setup.difficulty : undefined });
    }
    if (human) {
      triggerHaptic([18, 35, 18]);
      playPairSound();
    }
  };

  useEffect(() => animateIn('.score-strip, .tic-board-wrap, .tip'), []);
  useEffect(() => {
    if (!winningLine.length || !motionEnabled()) return;
    anime({ targets: '.tic-cell.is-winner', scale: [1, 0.96, 1], delay: anime.stagger(90), duration: 420, easing: 'easeOutCubic' });
  }, [winningLine]);

  useEffect(() => {
    if (winner || mode !== 'bot' || turn !== 'O') return;
    const timeout = window.setTimeout(() => {
      const choice = chooseTicBotMove(game, setup.difficulty);
      const next = playTicMove(game, choice, 'O');
      if (!next) return;
      setGame(next);
      playMoveSound(true);
      const result = getTicResult(next);
      if (result) {
        finishRound(result, next, false);
      } else setTurn('X');
    }, 420);
    return () => window.clearTimeout(timeout);
  }, [game, mode, setup.difficulty, turn, winner]);

  const resetRound = (advanceRound = false) => {
    const nextRound = advanceRound ? round + 1 : round;
    if (advanceRound) setRound(nextRound);
    setGame(createTicState());
    setTurn(getRoundStarter(nextRound));
    setWinner(null);
    setWinningLine([]);
  };

  useEffect(() => {
    if (!winner || round >= setup.rounds) return;
    const timeout = window.setTimeout(() => resetRound(true), 1400);
    return () => window.clearTimeout(timeout);
  }, [winner, round, setup.rounds]);

  const play = (index: number) => {
    if (winner || board[index] || (mode === 'bot' && turn === 'O')) return;
    const next = playTicMove(game, index, turn);
    if (!next) return;
    setGame(next);
    triggerHaptic();
    playMoveSound(turn === 'O');
    const result = getTicResult(next);
    if (result) {
      finishRound(result, next, !(mode === 'bot' && turn === 'O'));
    } else setTurn(turn === 'X' ? 'O' : 'X');
  };

  const matchComplete = Boolean(winner) && round >= setup.rounds;
  const expiringCells = [getExpiringTicCell(game, 'X'), getExpiringTicCell(game, 'O')];
  const playerName = (player: Player) => playerNames[player];
  const status = winner
    ? matchComplete
      ? scores.X === scores.O
        ? t('matchDraw')
        : t('winsMatch', { player: playerName(scores.X > scores.O ? 'X' : 'O') })
      : t('takesRound', { player: playerName(winner) })
    : t('playerTurn', { player: playerName(turn) });

  return (
    <main className="shell game-screen tic-screen theme-tic">
      <GameHeader
        title={t('ticTacToe')}
        statIcon="grid"
        statLabel={t('roundLabel')}
        statValue={new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en').format(round)}
        statSuffix={<small>/ {new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en').format(setup.rounds)}</small>}
        onExit={onExit}
      />
      <ScoreStrip
        leftLabel={playerNames.X}
        leftMark="×"
        rightLabel={playerNames.O}
        rightMark="○"
        scores={scores}
        inGameScores={{
          X: board.filter((c) => c === 'X').length,
          O: board.filter((c) => c === 'O').length,
        }}
        inGameUnit={t('marksUnit')}
        turn={turn}
      />
      <section className="tic-board-wrap">
        <GameStatus>{status}</GameStatus>
        <div className="tic-board" aria-label={t('ticBoard')}>
          {board.map((mark, index) => (
            <button
              type="button"
              className={`tic-cell ${mark.toLowerCase()} ${winningLine.includes(index) ? 'is-winner' : ''} ${expiringCells.includes(index) ? 'is-expiring' : ''}`}
              data-cell={index}
              key={index}
              onClick={() => play(index)}
              disabled={Boolean(mark) || Boolean(winner) || (mode === 'bot' && turn === 'O')}
              aria-label={
                mark
                  ? t(winningLine.includes(index) ? 'cellWinning' : expiringCells.includes(index) ? 'cellExpiring' : 'cellMarked', {
                      cell: new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en').format(index + 1),
                      player: playerName(mark),
                    })
                  : t('cellEmpty', { cell: new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en').format(index + 1) })
              }
            >
              {mark === 'X' ? '×' : mark === 'O' ? '○' : ''}
            </button>
          ))}
        </div>
      </section>
      <Tip>{t('ticTip')}</Tip>
      {matchComplete && <MatchResultToast message={status} gameTitle={t('ticTacToe')} onExit={onExit} />}
    </main>
  );
}
