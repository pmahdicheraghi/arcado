import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
import { animateIn } from '../../app/animation';
import { useI18n } from '../../app/i18n';
import { triggerHaptic } from '../../app/settings';
import { getRoundStarter, type GameSetup, type Player } from '../../app/types';
import { GameHeader, GameStatus, MatchResultToast, ScoreStrip, Tip } from '../../components/react-layout';
import { playPairSound, playTapSound, playWinSound } from '../../app/sfx';
import { recordMatchResult } from '../../app/stats';
import type { PlayerNames } from '../../app/player-names';
import {
  applyBattleTap,
  applyPlacement,
  checkWinner,
  chooseColorWarBotMove,
  countDiscs,
  createColorWarBoard,
  getExplosionTrajectories,
  isValidMove,
  stepExplosionWave,
  type ColorWarCell,
  type ColorWarPhase,
  type ExplosionTrajectory,
} from './color-war-logic';
import './color-war.css';

interface ExplodingCell {
  index: number;
  player: Player;
  trajectories: ExplosionTrajectory[];
}

interface ColorWarPageProps {
  setup: GameSetup;
  playerNames: PlayerNames;
  onExit: () => void;
}

export function ColorWarPage({ setup, playerNames, onExit }: ColorWarPageProps): ReactElement {
  const { language, t } = useI18n();
  const mode = setup.mode;

  const [round, setRound] = useState(1);
  const starter = useMemo(() => getRoundStarter(round), [round]);
  const [board, setBoard] = useState<ColorWarCell[]>(createColorWarBoard);
  const [phase, setPhase] = useState<ColorWarPhase>('placement');
  const [placementsDone, setPlacementsDone] = useState(0);
  const [turn, setTurn] = useState<Player>(starter);
  const [roundWinner, setRoundWinner] = useState<Player | null>(null);
  const [scores, setScores] = useState<Record<Player, number>>({ X: 0, O: 0 });

  const [isSettling, setIsSettling] = useState(false);
  const [explodingCells, setExplodingCells] = useState<ExplodingCell[]>([]);
  const [hitIndices, setHitIndices] = useState<number[]>([]);
  const [bornIndices, setBornIndices] = useState<number[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tappedIndex, setTappedIndex] = useState<number | null>(null);

  const botTimeoutRef = useRef<number | null>(null);
  const cascadeTimeoutRef = useRef<number | null>(null);
  const nextRoundTimeoutRef = useRef<number | null>(null);
  const tapTimeoutRef = useRef<number | null>(null);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en'), [language]);

  const discCounts = useMemo(() => countDiscs(board), [board]);

  const clearTimers = () => {
    if (botTimeoutRef.current !== null) {
      window.clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }
    if (cascadeTimeoutRef.current !== null) {
      window.clearTimeout(cascadeTimeoutRef.current);
      cascadeTimeoutRef.current = null;
    }
    if (nextRoundTimeoutRef.current !== null) {
      window.clearTimeout(nextRoundTimeoutRef.current);
      nextRoundTimeoutRef.current = null;
    }
    if (tapTimeoutRef.current !== null) {
      window.clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    animateIn('.score-strip, .colorwar-board-wrap, .tip');
    return () => clearTimers();
  }, []);

  const finishRound = (winner: Player) => {
    setRoundWinner(winner);
    setPhase('ended');
    setIsSettling(false);
    setExplodingCells([]);
    setHitIndices([]);
    setBornIndices([]);
    setTappedIndex(null);

    const nextScores = {
      ...scores,
      [winner]: scores[winner] + 1,
    };
    setScores(nextScores);

    if (round >= setup.rounds) {
      const outcome = nextScores.X === nextScores.O ? 'draw' : nextScores.X > nextScores.O ? 'win' : 'loss';
      recordMatchResult('colorwar', outcome, { difficulty: mode === 'bot' ? setup.difficulty : undefined });
      playWinSound();
    } else {
      playPairSound();
      triggerHaptic([20, 40, 20]);
    }
  };

  const resetRound = (nextRoundNumber: number) => {
    clearTimers();
    setRound(nextRoundNumber);
    const nextStarter = getRoundStarter(nextRoundNumber);
    setBoard(createColorWarBoard());
    setPhase('placement');
    setPlacementsDone(0);
    setTurn(nextStarter);
    setRoundWinner(null);
    setIsSettling(false);
    setExplodingCells([]);
    setHitIndices([]);
    setBornIndices([]);
    setHoveredIndex(null);
    setTappedIndex(null);
  };

  // Auto-advance to next round
  useEffect(() => {
    if (!roundWinner || round >= setup.rounds) return;
    nextRoundTimeoutRef.current = window.setTimeout(() => resetRound(round + 1), 1600);
    return () => {
      if (nextRoundTimeoutRef.current !== null) {
        window.clearTimeout(nextRoundTimeoutRef.current);
      }
    };
  }, [round, roundWinner, setup.rounds]);

  // Chain-reaction cascade animator
  const runCascade = (startingBoard: ColorWarCell[], currentMover: Player) => {
    setIsSettling(true);

    const stepWave = (curBoard: ColorWarCell[]) => {
      const step = stepExplosionWave(curBoard);
      if (step.explodedIndices.length === 0) {
        // Cascade finished
        setExplodingCells([]);
        setHitIndices([]);
        setBoard(curBoard);

        const possibleWinner = checkWinner(curBoard, 'battle');
        if (possibleWinner) {
          finishRound(possibleWinner);
        } else {
          setIsSettling(false);
          setTurn(currentMover === 'X' ? 'O' : 'X');
        }
        return;
      }

      // Track exploding cells with their directional trajectories
      const waveExplosions: ExplodingCell[] = step.explodedIndices.map((idx) => ({
        index: idx,
        player: curBoard[idx].player || currentMover,
        trajectories: getExplosionTrajectories(idx),
      }));
      setExplodingCells(waveExplosions);

      const recipientIndices: number[] = [];
      const newlyGeneratedIndices = new Set<number>();
      for (const exp of waveExplosions) {
        for (const traj of exp.trajectories) {
          if (!traj.isWall && traj.targetIndex !== null) {
            recipientIndices.push(traj.targetIndex);
            if (!curBoard[traj.targetIndex].player) {
              newlyGeneratedIndices.add(traj.targetIndex);
            }
          }
        }
      }

      playPairSound();
      triggerHaptic([15, 20]);

      // 400ms smooth glide duration for projectile dots to travel across to neighbor cells
      cascadeTimeoutRef.current = window.setTimeout(() => {
        setBoard(step.nextBoard);
        setExplodingCells([]);
        setHitIndices(recipientIndices);
        setBornIndices(Array.from(newlyGeneratedIndices));

        // 240ms pause for recipient cells to absorb the impact and bloom before the next wave expands
        cascadeTimeoutRef.current = window.setTimeout(() => {
          setHitIndices([]);
          setBornIndices([]);

          if (step.hasMore) {
            stepWave(step.nextBoard);
          } else {
            // Cascade completed
            const possibleWinner = checkWinner(step.nextBoard, 'battle');
            if (possibleWinner) {
              finishRound(possibleWinner);
            } else {
              setIsSettling(false);
              setTurn(currentMover === 'X' ? 'O' : 'X');
            }
          }
        }, 240);
      }, 400);
    };

    stepWave(startingBoard);
  };

  // Handle cell interaction (used by both human and bot)
  const executeMove = (index: number, mover: Player) => {
    if (roundWinner || isSettling) return;

    if (phase === 'placement') {
      if (!isValidMove(board, 'placement', index, mover)) return;
      playTapSound();
      triggerHaptic(12);

      const nextBoard = applyPlacement(board, index, mover);
      setBoard(nextBoard);
      setTappedIndex(index);
      if (tapTimeoutRef.current !== null) {
        window.clearTimeout(tapTimeoutRef.current);
      }
      tapTimeoutRef.current = window.setTimeout(() => {
        setTappedIndex(null);
      }, 260);

      if (placementsDone === 0) {
        setPlacementsDone(1);
        setTurn(mover === 'X' ? 'O' : 'X');
      } else {
        setPlacementsDone(2);
        setPhase('battle');
        setTurn(starter);
      }
      return;
    }

    if (phase === 'battle') {
      if (!isValidMove(board, 'battle', index, mover)) return;
      playTapSound();
      triggerHaptic(10);

      const nextBoard = applyBattleTap(board, index);
      setBoard(nextBoard);

      if (nextBoard[index].dots >= 4) {
        runCascade(nextBoard, mover);
      } else {
        setTappedIndex(index);
        if (tapTimeoutRef.current !== null) {
          window.clearTimeout(tapTimeoutRef.current);
        }
        tapTimeoutRef.current = window.setTimeout(() => {
          setTappedIndex(null);
        }, 260);
        setTurn(mover === 'X' ? 'O' : 'X');
      }
    }
  };

  const handleCellClick = (index: number) => {
    if (mode === 'bot' && turn === 'O') return;
    executeMove(index, turn);
  };

  // Bot Turn Handler
  useEffect(() => {
    if (roundWinner || isSettling || mode !== 'bot' || turn !== 'O') return;

    botTimeoutRef.current = window.setTimeout(
      () => {
        const move = chooseColorWarBotMove(board, phase, 'O', setup.difficulty);
        if (move !== -1) {
          executeMove(move, 'O');
        }
      },
      phase === 'placement' ? 650 : 550,
    );

    return () => {
      if (botTimeoutRef.current !== null) {
        window.clearTimeout(botTimeoutRef.current);
      }
    };
  }, [board, isSettling, mode, phase, roundWinner, setup.difficulty, turn]);

  const currentTurnName = playerNames[turn];
  const isHumanTurn = !(mode === 'bot' && turn === 'O');

  const statusText = useMemo(() => {
    if (roundWinner) {
      return t('winsRound', { player: playerNames[roundWinner] });
    }
    if (isSettling) {
      return t('colorwarCascade');
    }
    if (phase === 'placement') {
      return t('colorwarPlaceDisc', { player: currentTurnName });
    }
    return t('playerTurn', { player: currentTurnName });
  }, [currentTurnName, isSettling, phase, playerNames, roundWinner, t]);

  const matchComplete = roundWinner !== null && round >= setup.rounds;
  const matchResultText = useMemo(() => {
    if (!matchComplete) return '';
    return scores.X === scores.O ? t('matchTie') : t('winsMatch', { player: scores.X > scores.O ? playerNames.X : playerNames.O });
  }, [matchComplete, playerNames, scores, t]);

  const titleId = useId();

  return (
    <main className="shell game-screen colorwar-screen theme-colorwar" aria-labelledby={titleId}>
      <GameHeader
        title={t('colorwar')}
        statIcon="spark"
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
        inGameScores={{ X: discCounts.X, O: discCounts.O }}
        inGameUnit={t('colorwarDiscsUnit')}
        turn={roundWinner ? undefined : turn}
      />

      <GameStatus>{statusText}</GameStatus>

      <section className="colorwar-board-wrap">
        <div className={`board-surface colorwar-board turn-${turn.toLowerCase()}`} role="group" aria-label={t('colorwarBoard')}>
          {board.map((cell, index) => {
            const isValid = !roundWinner && !isSettling && isHumanTurn && isValidMove(board, phase, index, turn);
            const explodingInfo = explodingCells.find((e) => e.index === index);
            const isExploding = Boolean(explodingInfo);
            const isHit = hitIndices.includes(index);
            const isBorn = bornIndices.includes(index);
            const isHovered = hoveredIndex === index;
            const isPlacementPreview = !cell.player && phase === 'placement' && isValid && isHovered;

            return (
              <button
                key={index}
                type="button"
                className={`colorwar-cell ${cell.player ? cell.player.toLowerCase() : ''} ${isValid ? 'is-valid' : ''} ${isHit ? 'has-impact' : ''}`}
                onClick={() => handleCellClick(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                disabled={!isValid}
                aria-label={
                  cell.player
                    ? t('colorwarCellMarked', {
                        cell: numberFormatter.format(index + 1),
                        player: playerNames[cell.player],
                        count: numberFormatter.format(cell.dots),
                      })
                    : isValid
                      ? t('colorwarCellValid', { cell: numberFormatter.format(index + 1), player: currentTurnName })
                      : t('colorwarCellEmpty', { cell: numberFormatter.format(index + 1) })
                }
              >
                {cell.player && (
                  <div
                    className={`colorwar-disc ${isExploding ? 'is-exploding' : ''} ${isHit ? 'is-hit' : ''} ${isBorn ? 'is-born' : ''} ${tappedIndex === index ? 'is-tapped' : ''}`}
                  >
                    <div className={`colorwar-pips dots-${cell.dots}`}>
                      {Array.from({ length: Math.min(cell.dots, 4) }, (_, pIdx) => (
                        <span key={pIdx} className="colorwar-pip" />
                      ))}
                    </div>
                  </div>
                )}
                {isPlacementPreview && (
                  <div className={`colorwar-disc ghost ${turn.toLowerCase()}`}>
                    <div className="colorwar-pips dots-3">
                      <span className="colorwar-pip" />
                      <span className="colorwar-pip" />
                      <span className="colorwar-pip" />
                    </div>
                  </div>
                )}
                {isHit && <span className="cw-impact-ripple" />}
                {explodingInfo && (
                  <div className={`colorwar-emitters ${explodingInfo.player.toLowerCase()}`}>
                    <span className="cw-detonation-blast" />
                    {explodingInfo.trajectories.map((traj) => (
                      <div
                        key={traj.direction}
                        className={`cw-emitter-track cw-${traj.direction} ${traj.isWall ? 'is-wall' : 'is-neighbor'}`}
                      >
                        <span className="cw-emitter-dot" />
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <Tip>{t('colorwarTip')}</Tip>

      {matchComplete && <MatchResultToast message={matchResultText} gameTitle={t('colorwar')} onExit={onExit} />}
    </main>
  );
}
