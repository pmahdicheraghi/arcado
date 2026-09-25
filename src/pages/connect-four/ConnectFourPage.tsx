import { useEffect, useRef, useState } from 'react';
import anime from 'animejs';
import { animateIn, motionEnabled } from '../../app/animation';
import { useI18n } from '../../app/i18n';
import { triggerHaptic } from '../../app/settings';
import { getRoundStarter, type GameSetup, type Player } from '../../app/types';
import { GameHeader, GameStatus, MatchResultToast, ScoreStrip, Tip } from '../../components/react-layout';
import { playMoveSound, playPairSound } from '../../app/sfx';
import { recordMatchResult } from '../../app/stats';
import {
  chooseConnectBotColumn,
  CONNECT_COLUMNS,
  CONNECT_ROWS,
  createConnectBoard,
  dropDisc,
  getConnectIndex,
  getConnectResult,
  getConnectWinningLine,
  getDropRow,
  type ConnectCell,
} from './connect-four-logic';
import './connect-four.css';
import type { PlayerNames } from '../../app/player-names';

const DROP_ANIMATION_DURATION_MS = 520;

export function ConnectFourPage({ setup, playerNames, onExit }: { setup: GameSetup; playerNames: PlayerNames; onExit: () => void }) {
  const { language, t } = useI18n();
  const mode = setup.mode;
  const [board, setBoard] = useState<ConnectCell[]>(createConnectBoard);
  const [turn, setTurn] = useState<Player>('X');
  const [winner, setWinner] = useState<Player | 'draw' | null>(null);
  const [winningLine, setWinningLine] = useState<number[]>([]);
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [scores, setScores] = useState<Record<Player, number>>({ X: 0, O: 0 });
  const [round, setRound] = useState(1);
  const resultTimeoutRef = useRef<number | null>(null);
  const numberFormatter = new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en');

  const finishRound = (result: Player | 'draw', finalBoard: ConnectCell[], human: boolean) => {
    setWinner(result);
    setWinningLine(getConnectWinningLine(finalBoard) ?? []);
    const nextScores = {
      ...scores,
      ...(result !== 'draw' ? { [result]: scores[result] + 1 } : {}),
    };
    if (result !== 'draw') setScores(nextScores);
    if (round >= setup.rounds) {
      const outcome = nextScores.X === nextScores.O ? 'draw' : nextScores.X > nextScores.O ? 'win' : 'loss';
      recordMatchResult('connect', outcome, { difficulty: mode === 'bot' ? setup.difficulty : undefined });
    }
    if (human) {
      triggerHaptic([18, 35, 18]);
      playPairSound();
    }
  };

  const settleResult = (result: Player | 'draw', finalBoard: ConnectCell[], human: boolean) => {
    setIsSettling(true);
    if (resultTimeoutRef.current !== null) window.clearTimeout(resultTimeoutRef.current);
    const delay = motionEnabled() ? DROP_ANIMATION_DURATION_MS : 0;
    resultTimeoutRef.current = window.setTimeout(() => {
      resultTimeoutRef.current = null;
      setIsSettling(false);
      finishRound(result, finalBoard, human);
    }, delay);
  };

  useEffect(() => animateIn('.score-strip, .connect-board-wrap, .tip'), []);

  useEffect(() => {
    if (lastMove === null || !motionEnabled()) return;
    anime({
      targets: `.connect-cell[data-index="${lastMove}"] .connect-disc`,
      translateY: [-70, 0],
      scale: [0.84, 1],
      duration: DROP_ANIMATION_DURATION_MS,
      easing: 'easeOutBounce',
    });
  }, [lastMove]);

  useEffect(() => {
    if (!winningLine.length || !motionEnabled()) return;
    anime({
      targets: '.connect-cell.is-winner .connect-disc',
      scale: [1, 0.82, 1],
      delay: anime.stagger(85),
      duration: 520,
      easing: 'easeOutCubic',
    });
  }, [winningLine]);

  useEffect(() => {
    if (winner || isSettling || mode !== 'bot' || turn !== 'O') return;
    const timeout = window.setTimeout(() => {
      const column = chooseConnectBotColumn(board, setup.difficulty);
      const move = dropDisc(board, column, 'O');
      if (!move) return;
      setBoard(move.board);
      setLastMove(move.index);
      playMoveSound(true);
      const result = getConnectResult(move.board);
      if (result) settleResult(result, move.board, false);
      else setTurn('X');
    }, 460);
    return () => window.clearTimeout(timeout);
  }, [board, isSettling, mode, setup.difficulty, turn, winner]);

  const resetRound = (advanceRound = false) => {
    if (resultTimeoutRef.current !== null) window.clearTimeout(resultTimeoutRef.current);
    resultTimeoutRef.current = null;
    const nextRound = advanceRound ? round + 1 : round;
    if (advanceRound) setRound(nextRound);
    setBoard(createConnectBoard());
    setTurn(getRoundStarter(nextRound));
    setWinner(null);
    setWinningLine([]);
    setLastMove(null);
    setIsSettling(false);
  };

  useEffect(
    () => () => {
      if (resultTimeoutRef.current !== null) window.clearTimeout(resultTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!winner || round >= setup.rounds) return;
    const timeout = window.setTimeout(() => resetRound(true), 1500);
    return () => window.clearTimeout(timeout);
  }, [round, setup.rounds, winner]);

  const playColumn = (column: number) => {
    if (winner || isSettling || (mode === 'bot' && turn === 'O')) return;
    const move = dropDisc(board, column, turn);
    if (!move) return;
    setBoard(move.board);
    setLastMove(move.index);
    triggerHaptic();
    playMoveSound(turn === 'O');
    const result = getConnectResult(move.board);
    if (result) settleResult(result, move.board, true);
    else setTurn(turn === 'X' ? 'O' : 'X');
  };

  const matchComplete = Boolean(winner) && round >= setup.rounds;
  const playerName = (player: Player) => playerNames[player];
  const status = isSettling
    ? t('connectDiscSettling')
    : winner
      ? matchComplete
        ? scores.X === scores.O
          ? t('matchDraw')
          : t('winsMatch', { player: playerName(scores.X > scores.O ? 'X' : 'O') })
        : winner === 'draw'
          ? t('drawRound')
          : t('takesRound', { player: playerName(winner) })
      : t('playerTurn', { player: playerName(turn) });

  return (
    <main className="shell game-screen connect-screen theme-connect">
      <GameHeader
        title={t('connectFour')}
        statIcon="grid"
        statLabel={t('roundLabel')}
        statValue={numberFormatter.format(round)}
        statSuffix={<small>/ {numberFormatter.format(setup.rounds)}</small>}
        onExit={onExit}
      />
      <ScoreStrip
        leftLabel={playerNames.X}
        leftMark="●"
        rightLabel={playerNames.O}
        rightMark="●"
        scores={scores}
        inGameScores={{
          X: board.filter((c) => c === 'X').length,
          O: board.filter((c) => c === 'O').length,
        }}
        inGameUnit={t('discsUnit')}
        turn={turn}
      />
      <section className="connect-board-wrap">
        <GameStatus>{status}</GameStatus>
        <div className={`board-surface connect-board turn-${turn.toLowerCase()}`} role="group" aria-label={t('connectBoard')}>
          {Array.from({ length: CONNECT_COLUMNS }, (_, column) => {
            const targetRow = getDropRow(board, column);
            return (
              <button
                type="button"
                className="connect-column"
                key={column}
                onClick={() => playColumn(column)}
                disabled={targetRow === null || Boolean(winner) || isSettling || (mode === 'bot' && turn === 'O')}
                aria-label={t(targetRow === null ? 'connectColumnFull' : 'connectDropColumn', {
                  column: numberFormatter.format(column + 1),
                })}
              >
                {Array.from({ length: CONNECT_ROWS }, (_, row) => {
                  const index = getConnectIndex(row, column);
                  const mark = board[index];
                  return (
                    <span
                      className={`connect-cell ${mark.toLowerCase()} ${winningLine.includes(index) ? 'is-winner' : ''}`}
                      data-index={index}
                      key={row}
                      aria-hidden="true"
                    >
                      {mark && <span className="connect-disc" />}
                    </span>
                  );
                })}
              </button>
            );
          })}
        </div>
      </section>
      <Tip>{t('connectTip')}</Tip>
      {matchComplete && <MatchResultToast message={status} gameTitle={t('connectFour')} onExit={onExit} />}
    </main>
  );
}
