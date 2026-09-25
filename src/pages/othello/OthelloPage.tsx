import { useEffect, useMemo, useRef, useState } from 'react';
import { animateIn, motionEnabled } from '../../app/animation';
import { useI18n } from '../../app/i18n';
import { triggerHaptic } from '../../app/settings';
import { getRoundStarter, type GameSetup, type Player } from '../../app/types';
import { GameHeader, GameStatus, MatchResultToast, ScoreStrip, Tip } from '../../components/react-layout';
import { playMoveSound, playPairSound } from '../../app/sfx';
import { recordMatchResult } from '../../app/stats';
import { chooseOthelloBotMove, countDiscs, createOthelloBoard, getValidMoves, makeMove, type OthelloCell } from './othello-logic';
import './othello.css';
import type { PlayerNames } from '../../app/player-names';

const FLIP_SETTLE_MS = 420;

export function OthelloPage({ setup, playerNames, onExit }: { setup: GameSetup; playerNames: PlayerNames; onExit: () => void }) {
  const { language, t } = useI18n();
  const mode = setup.mode;
  const [board, setBoard] = useState<OthelloCell[]>(createOthelloBoard);
  const [turn, setTurn] = useState<Player>('X');
  const [roundWinner, setRoundWinner] = useState<Player | 'draw' | null>(null);
  const [flippedDiscs, setFlippedDiscs] = useState<number[]>([]);
  const [passMessage, setPassMessage] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [matchScores, setMatchScores] = useState<Record<Player, number>>({ X: 0, O: 0 });
  const [round, setRound] = useState(1);
  const settleTimeoutRef = useRef<number | null>(null);
  const passTimeoutRef = useRef<number | null>(null);
  const numberFormatter = new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en');

  const validMoves = useMemo(() => {
    if (roundWinner || isSettling) return [];
    if (mode === 'bot' && turn === 'O') return [];
    return getValidMoves(board, turn);
  }, [board, isSettling, mode, roundWinner, turn]);

  const discCounts = useMemo(() => countDiscs(board), [board]);

  useEffect(() => animateIn('.score-strip, .othello-board-wrap, .tip'), []);

  // Cleanup timers on unmount
  useEffect(
    () => () => {
      if (settleTimeoutRef.current !== null) window.clearTimeout(settleTimeoutRef.current);
      if (passTimeoutRef.current !== null) window.clearTimeout(passTimeoutRef.current);
    },
    [],
  );

  // Auto-advance to next round
  useEffect(() => {
    if (!roundWinner || round >= setup.rounds) return;
    const timeout = window.setTimeout(() => resetRound(true), 1550);
    return () => window.clearTimeout(timeout);
  }, [round, roundWinner, setup.rounds]);

  const clearTimers = () => {
    if (settleTimeoutRef.current !== null) {
      window.clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
    if (passTimeoutRef.current !== null) {
      window.clearTimeout(passTimeoutRef.current);
      passTimeoutRef.current = null;
    }
  };

  const finishRound = (finalBoard: OthelloCell[]) => {
    const counts = countDiscs(finalBoard);
    const result: Player | 'draw' = counts.X === counts.O ? 'draw' : counts.X > counts.O ? 'X' : 'O';
    setRoundWinner(result);
    setIsSettling(false);
    const nextScores = {
      ...matchScores,
      ...(result !== 'draw' ? { [result]: matchScores[result] + 1 } : {}),
    };
    if (result !== 'draw') {
      playPairSound();
      setMatchScores(nextScores);
    }
    if (round >= setup.rounds) {
      const outcome = nextScores.X === nextScores.O ? 'draw' : nextScores.X > nextScores.O ? 'win' : 'loss';
      recordMatchResult('othello', outcome, { difficulty: mode === 'bot' ? setup.difficulty : undefined });
    }
  };

  const handleTurnAfterMove = (nextBoard: OthelloCell[], player: Player) => {
    const opponent: Player = player === 'X' ? 'O' : 'X';
    const opponentValidMoves = getValidMoves(nextBoard, opponent);
    const playerValidMoves = getValidMoves(nextBoard, player);

    if (opponentValidMoves.length > 0) {
      setPassMessage(null);
      setTurn(opponent);
    } else if (playerValidMoves.length > 0) {
      // Opponent must pass
      const opponentName = playerName(opponent);
      setPassMessage(t('othelloPassed', { player: opponentName }));
      if (passTimeoutRef.current !== null) window.clearTimeout(passTimeoutRef.current);
      passTimeoutRef.current = window.setTimeout(() => {
        passTimeoutRef.current = null;
        setPassMessage(null);
      }, 2200);
      // Current player continues
      setTurn(player);
    } else {
      // Neither player has legal moves — round is over
      setPassMessage(null);
      setIsSettling(true);
      clearTimers();
      settleTimeoutRef.current = window.setTimeout(
        () => {
          settleTimeoutRef.current = null;
          finishRound(nextBoard);
        },
        motionEnabled() ? FLIP_SETTLE_MS : 0,
      );
    }
  };

  const playCell = (index: number, player: Player = turn, human = true) => {
    if (roundWinner || isSettling || (mode === 'bot' && human && turn === 'O')) return;

    const moveResult = makeMove(board, index, player);
    if (!moveResult) return;

    setBoard(moveResult.board);
    setFlippedDiscs(moveResult.flippedIndices);
    playMoveSound(player === 'O');

    if (human) {
      triggerHaptic(moveResult.flippedIndices.length > 2 ? [14, 28, 14] : 8);
    }

    handleTurnAfterMove(moveResult.board, player);
  };

  // Bot turn effect
  useEffect(() => {
    if (roundWinner || isSettling || mode !== 'bot' || turn !== 'O') return;

    const botTimer = window.setTimeout(() => {
      const botMove = chooseOthelloBotMove(board, setup.difficulty);
      if (botMove !== null) {
        playCell(botMove, 'O', false);
      } else {
        // Bot has no moves
        const humanMoves = getValidMoves(board, 'X');
        if (humanMoves.length > 0) {
          setPassMessage(t('othelloPassed', { player: playerName('O') }));
          if (passTimeoutRef.current !== null) window.clearTimeout(passTimeoutRef.current);
          passTimeoutRef.current = window.setTimeout(() => {
            passTimeoutRef.current = null;
            setPassMessage(null);
          }, 2200);
          setTurn('X');
        } else {
          // Game over
          setIsSettling(true);
          clearTimers();
          settleTimeoutRef.current = window.setTimeout(
            () => {
              settleTimeoutRef.current = null;
              finishRound(board);
            },
            motionEnabled() ? FLIP_SETTLE_MS : 0,
          );
        }
      }
    }, 480);

    return () => window.clearTimeout(botTimer);
  }, [board, isSettling, mode, roundWinner, setup.difficulty, turn]);

  const resetRound = (advanceRound = false) => {
    clearTimers();
    const nextRound = advanceRound ? round + 1 : round;
    if (advanceRound) setRound(nextRound);
    setBoard(createOthelloBoard());
    setTurn(getRoundStarter(nextRound));
    setRoundWinner(null);
    setFlippedDiscs([]);
    setPassMessage(null);
    setIsSettling(false);
  };

  const playerName = (player: Player) => playerNames[player];
  const matchComplete = Boolean(roundWinner) && round >= setup.rounds;
  const status = isSettling
    ? t('dotsCounting')
    : roundWinner
      ? matchComplete
        ? matchScores.X === matchScores.O
          ? t('matchDraw')
          : t('winsMatch', { player: playerName(matchScores.X > matchScores.O ? 'X' : 'O') })
        : roundWinner === 'draw'
          ? t('drawRound')
          : t('takesRound', { player: playerName(roundWinner) })
      : (passMessage ?? t('playerTurn', { player: playerName(turn) }));

  return (
    <main className="shell game-screen othello-screen theme-othello">
      <GameHeader
        title={t('othello')}
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
        scores={matchScores}
        inGameScores={discCounts}
        inGameUnit={t('discsUnit')}
        turn={turn}
      />
      <section className="othello-board-wrap">
        <GameStatus>{status}</GameStatus>
        <div className={`board-surface othello-board turn-${turn.toLowerCase()}`} role="group" aria-label={t('othelloBoard')}>
          {board.map((cell, index) => {
            const isValid = validMoves.includes(index);
            const ariaLabel = cell
              ? t('othelloCellMarked', {
                  cell: numberFormatter.format(index + 1),
                  player: playerName(cell),
                })
              : isValid
                ? t('othelloCellValid', {
                    cell: numberFormatter.format(index + 1),
                    player: playerName(turn),
                  })
                : t('othelloCellEmpty', { cell: numberFormatter.format(index + 1) });

            return (
              <button
                key={index}
                type="button"
                className={`othello-cell ${cell ? (cell === 'X' ? 'x' : 'o') : ''} ${isValid ? 'is-valid' : ''}`}
                data-index={index}
                disabled={!isValid || Boolean(roundWinner) || isSettling}
                onClick={() => playCell(index)}
                aria-label={ariaLabel}
              >
                {cell && <span key={cell} className={`othello-disc ${flippedDiscs.includes(index) ? 'is-flipping' : ''}`} />}
                {!cell && isValid && <span className="othello-valid-dot" />}
              </button>
            );
          })}
        </div>
      </section>
      <Tip>{t('othelloTip')}</Tip>
      {matchComplete && <MatchResultToast message={status} gameTitle={t('othello')} onExit={onExit} />}
    </main>
  );
}
