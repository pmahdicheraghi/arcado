import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { animateIn } from '../../app/animation';
import { useI18n } from '../../app/i18n';
import type { PlayerNames } from '../../app/player-names';
import { triggerHaptic } from '../../app/settings';
import { playMoveSound, playPairSound, playTapSound, playWinSound } from '../../app/sfx';
import { recordMatchResult } from '../../app/stats';
import { getRoundStarter, type GameSetup, type Player } from '../../app/types';
import { GameHeader, GameStatus, MatchResultToast, ScoreStrip, Tip } from '../../components/react-layout';
import {
  QUORIDOR_SIZE,
  QUORIDOR_WALL_GRID,
  applyQuoridorMove,
  checkQuoridorWinner,
  chooseQuoridorBotMove,
  createQuoridorState,
  getValidOrientationsAt,
  getValidPawnMoves,
  isValidWallPlacement,
  sameCell,
  type CellPos,
  type QuoridorMove,
  type QuoridorState,
  type QuoridorWall,
  type WallOrientation,
} from './quoridor-logic';
import './quoridor.css';

export function QuoridorPage({
  setup,
  playerNames,
  onExit,
}: {
  setup: GameSetup;
  playerNames: PlayerNames;
  onExit: () => void;
}): ReactElement {
  const { language, t } = useI18n();
  const mode = setup.mode;
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState<Record<Player, number>>({ X: 0, O: 0 });
  const [state, setState] = useState<QuoridorState>(createQuoridorState);
  const [turn, setTurn] = useState<Player>(() => getRoundStarter(1));
  const [roundWinner, setRoundWinner] = useState<Player | null>(null);
  const [stagedMove, setStagedMove] = useState<QuoridorMove | null>(null);
  const botTimeoutRef = useRef<number | null>(null);
  const nextRoundTimeoutRef = useRef<number | null>(null);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en'), [language]);

  useEffect(() => {
    animateIn('.score-strip, .quoridor-board-wrap, .tip');
    return () => {
      if (botTimeoutRef.current !== null) window.clearTimeout(botTimeoutRef.current);
      if (nextRoundTimeoutRef.current !== null) window.clearTimeout(nextRoundTimeoutRef.current);
    };
  }, []);

  const isHumanTurn = !roundWinner && !(mode === 'bot' && turn === 'O');
  const currentPlayerWalls = state.remainingWalls[turn];

  const validMoves = useMemo<CellPos[]>(() => {
    if (roundWinner) return [];
    return getValidPawnMoves(state, turn);
  }, [roundWinner, state, turn]);

  const finishRound = (winner: Player) => {
    setRoundWinner(winner);
    setStagedMove(null);
    const nextScores = {
      ...scores,
      [winner]: scores[winner] + 1,
    };
    setScores(nextScores);

    if (round >= setup.rounds) {
      const outcome = nextScores.X === nextScores.O ? 'draw' : nextScores.X > nextScores.O ? 'win' : 'loss';
      recordMatchResult('quoridor', outcome, { difficulty: mode === 'bot' ? setup.difficulty : undefined });
      playWinSound();
    } else {
      playPairSound();
      triggerHaptic([18, 32, 18]);
    }
  };

  const commitMove = (move: QuoridorMove, mover: Player, isHuman: boolean) => {
    const nextState = applyQuoridorMove(state, mover, move);
    setState(nextState);
    setStagedMove(null);
    playMoveSound(mover === 'O');
    if (isHuman) triggerHaptic(move.kind === 'wall' ? [10, 18] : 6);

    const winner = checkQuoridorWinner(nextState);
    if (winner) {
      finishRound(winner);
    } else {
      setTurn(mover === 'X' ? 'O' : 'X');
    }
  };

  // Bot turn
  useEffect(() => {
    if (roundWinner || mode !== 'bot' || turn !== 'O') return;
    botTimeoutRef.current = window.setTimeout(() => {
      const move = chooseQuoridorBotMove(state, 'O', setup.difficulty);
      commitMove(move, 'O', false);
    }, 460);
    return () => {
      if (botTimeoutRef.current !== null) window.clearTimeout(botTimeoutRef.current);
    };
  }, [mode, roundWinner, setup.difficulty, state, turn]);

  // Auto-advance round
  useEffect(() => {
    if (!roundWinner || round >= setup.rounds) return;
    nextRoundTimeoutRef.current = window.setTimeout(() => {
      const nextRound = round + 1;
      setRound(nextRound);
      setState(createQuoridorState());
      setTurn(getRoundStarter(nextRound));
      setRoundWinner(null);
      setStagedMove(null);
    }, 1650);
    return () => {
      if (nextRoundTimeoutRef.current !== null) window.clearTimeout(nextRoundTimeoutRef.current);
    };
  }, [round, roundWinner, setup.rounds]);

  const handleTileClick = (pos: CellPos) => {
    if (!isHumanTurn) return;
    if (!validMoves.some((m) => sameCell(m, pos))) return;
    playTapSound();
    triggerHaptic(5);
    setStagedMove({ kind: 'move', to: pos });
  };

  const handleStageWall = (row: number, col: number, preferred: WallOrientation) => {
    if (!isHumanTurn || currentPlayerWalls <= 0) return;
    playTapSound();
    triggerHaptic(5);

    const clampedRow = Math.min(Math.max(0, row), QUORIDOR_WALL_GRID - 1);
    const clampedCol = Math.min(Math.max(0, col), QUORIDOR_WALL_GRID - 1);

    // Tapping the same intersection rotates H <-> V when valid
    if (stagedMove?.kind === 'wall' && stagedMove.wall.row === clampedRow && stagedMove.wall.col === clampedCol) {
      const flipped: QuoridorWall = {
        row: clampedRow,
        col: clampedCol,
        orientation: stagedMove.wall.orientation === 'h' ? 'v' : 'h',
      };
      if (isValidWallPlacement(state, turn, flipped)) {
        setStagedMove({ kind: 'wall', wall: flipped });
      }
      return;
    }

    const candidateCoords: Array<{ r: number; c: number; o: WallOrientation }> = [
      { r: clampedRow, c: clampedCol, o: preferred },
      { r: clampedRow, c: clampedCol, o: preferred === 'h' ? 'v' : 'h' },
      ...(preferred === 'h' && col > 0 ? [{ r: clampedRow, c: Math.min(col - 1, QUORIDOR_WALL_GRID - 1), o: 'h' as const }] : []),
      ...(preferred === 'v' && row > 0 ? [{ r: Math.min(row - 1, QUORIDOR_WALL_GRID - 1), c: clampedCol, o: 'v' as const }] : []),
    ];

    for (const cand of candidateCoords) {
      const wall: QuoridorWall = { row: cand.r, col: cand.c, orientation: cand.o };
      if (isValidWallPlacement(state, turn, wall)) {
        setStagedMove({ kind: 'wall', wall });
        return;
      }
    }
  };

  const handleConfirmAction = () => {
    if (!stagedMove || !isHumanTurn) return;
    if (stagedMove.kind === 'move') {
      if (!validMoves.some((m) => sameCell(m, stagedMove.to))) return;
      commitMove(stagedMove, turn, true);
    } else {
      if (!isValidWallPlacement(state, turn, stagedMove.wall)) return;
      commitMove(stagedMove, turn, true);
    }
  };

  const playerName = (player: Player) => playerNames[player];
  const matchComplete = Boolean(roundWinner) && round >= setup.rounds;
  const status = roundWinner
    ? matchComplete
      ? scores.X === scores.O
        ? t('matchDraw')
        : t('winsMatch', { player: playerName(scores.X > scores.O ? 'X' : 'O') })
      : t('takesRound', { player: playerName(roundWinner) })
    : t('playerTurn', { player: playerName(turn) });

  return (
    <main className="shell game-screen quoridor-screen theme-quoridor">
      <GameHeader
        title={t('quoridor')}
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
          X: state.remainingWalls.X,
          O: state.remainingWalls.O,
        }}
        inGameUnit={t('wallsUnit')}
        turn={roundWinner ? undefined : turn}
      />

      <section className="quoridor-board-wrap">
        <GameStatus>{status}</GameStatus>

        <div className="board-surface quoridor-board" role="group" aria-label={t('quoridorBoard')}>
          {/* 7x7 Tiles */}
          {Array.from({ length: QUORIDOR_SIZE }, (_, r) =>
            Array.from({ length: QUORIDOR_SIZE }, (_, c) => {
              const pos: CellPos = { row: r, col: c };
              const isX = sameCell(state.pawns.X, pos);
              const isO = sameCell(state.pawns.O, pos);
              const isValid = isHumanTurn && validMoves.some((m) => sameCell(m, pos));
              const isStagedTarget = stagedMove?.kind === 'move' && sameCell(stagedMove.to, pos);
              const rowFmt = numberFormatter.format(r + 1);
              const colFmt = numberFormatter.format(c + 1);
              const label = isX
                ? t('quoridorCellOccupied', { row: rowFmt, column: colFmt, player: playerNames.X })
                : isO
                  ? t('quoridorCellOccupied', { row: rowFmt, column: colFmt, player: playerNames.O })
                  : isValid
                    ? t('quoridorCellValid', { row: rowFmt, column: colFmt })
                    : t('quoridorCellEmpty', { row: rowFmt, column: colFmt });

              return (
                <button
                  key={`cell-${r}-${c}`}
                  type="button"
                  className={`quoridor-cell ${r === 0 ? 'is-goal-x' : ''} ${r === QUORIDOR_SIZE - 1 ? 'is-goal-o' : ''} ${isValid ? 'is-valid' : ''} ${isStagedTarget ? 'is-staged-cell' : ''}`}
                  style={{ gridRow: r * 2 + 1, gridColumn: c * 2 + 1 }}
                  disabled={!isValid}
                  onClick={() => handleTileClick(pos)}
                  aria-label={label}
                >
                  {isX && <span className="quoridor-pawn pawn-x" />}
                  {isO && <span className="quoridor-pawn pawn-o" />}
                  {!isX && !isO && isStagedTarget && (
                    <span className={`quoridor-pawn ${turn === 'X' ? 'pawn-x' : 'pawn-o'} is-staged-pawn`} />
                  )}
                  {!isX && !isO && isValid && !isStagedTarget && <span className="quoridor-move-hint" aria-hidden="true" />}
                </button>
              );
            }),
          )}

          {/* Horizontal groove hit targets */}
          {Array.from({ length: QUORIDOR_WALL_GRID }, (_, r) =>
            Array.from({ length: QUORIDOR_SIZE }, (_, c) => (
              <button
                key={`hgroove-${r}-${c}`}
                type="button"
                className="quoridor-groove is-h"
                style={{ gridRow: r * 2 + 2, gridColumn: c * 2 + 1 }}
                disabled={!isHumanTurn || currentPlayerWalls <= 0}
                onClick={() => handleStageWall(r, c, 'h')}
                tabIndex={-1}
                aria-hidden="true"
              />
            )),
          )}

          {/* Vertical groove hit targets */}
          {Array.from({ length: QUORIDOR_SIZE }, (_, r) =>
            Array.from({ length: QUORIDOR_WALL_GRID }, (_, c) => (
              <button
                key={`vgroove-${r}-${c}`}
                type="button"
                className="quoridor-groove is-v"
                style={{ gridRow: r * 2 + 1, gridColumn: c * 2 + 2 }}
                disabled={!isHumanTurn || currentPlayerWalls <= 0}
                onClick={() => handleStageWall(r, c, 'v')}
                tabIndex={-1}
                aria-hidden="true"
              />
            )),
          )}

          {/* 6x6 Interior vertex intersections */}
          {Array.from({ length: QUORIDOR_WALL_GRID }, (_, r) =>
            Array.from({ length: QUORIDOR_WALL_GRID }, (_, c) => {
              const validOrientations = isHumanTurn && currentPlayerWalls > 0 ? getValidOrientationsAt(state, turn, r, c) : [];
              const isStagedHere = stagedMove?.kind === 'wall' && stagedMove.wall.row === r && stagedMove.wall.col === c;
              const isDisabled = !isHumanTurn || currentPlayerWalls <= 0 || validOrientations.length === 0;

              return (
                <button
                  key={`vertex-${r}-${c}`}
                  type="button"
                  className={`quoridor-vertex ${isStagedHere ? 'is-staged-vertex' : ''}`}
                  style={{ gridRow: r * 2 + 2, gridColumn: c * 2 + 2 }}
                  disabled={isDisabled}
                  onClick={() =>
                    handleStageWall(
                      r,
                      c,
                      isStagedHere && stagedMove?.kind === 'wall' ? stagedMove.wall.orientation : (validOrientations[0] ?? 'h'),
                    )
                  }
                  aria-label={t('quoridorWallSlot', {
                    row: numberFormatter.format(r + 1),
                    column: numberFormatter.format(c + 1),
                  })}
                />
              );
            }),
          )}

          {/* Placed 2-tile walls */}
          {state.walls.map((w) => (
            <span
              key={`wall-${w.row}-${w.col}-${w.orientation}`}
              className={`quoridor-wall-bar is-${w.orientation} owner-${(w.owner ?? 'X').toLowerCase()}`}
              style={
                w.orientation === 'h'
                  ? { gridRow: w.row * 2 + 2, gridColumn: `${w.col * 2 + 1} / span 3` }
                  : { gridRow: `${w.row * 2 + 1} / span 3`, gridColumn: w.col * 2 + 2 }
              }
              aria-hidden="true"
            />
          ))}

          {/* Staged wall preview */}
          {stagedMove?.kind === 'wall' && (
            <span
              className={`quoridor-wall-bar is-${stagedMove.wall.orientation} is-staged`}
              style={
                stagedMove.wall.orientation === 'h'
                  ? { gridRow: stagedMove.wall.row * 2 + 2, gridColumn: `${stagedMove.wall.col * 2 + 1} / span 3` }
                  : { gridRow: `${stagedMove.wall.row * 2 + 1} / span 3`, gridColumn: stagedMove.wall.col * 2 + 2 }
              }
              aria-hidden="true"
            />
          )}
        </div>

        <div className="quoridor-action-bar">
          {stagedMove && isHumanTurn && (
            <button type="button" className="primary-btn" onClick={handleConfirmAction}>
              {t(stagedMove.kind === 'move' ? 'quoridorConfirmMove' : 'quoridorConfirmWall')}
            </button>
          )}
        </div>
      </section>

      <Tip>{t('quoridorTip')}</Tip>
      {matchComplete && <MatchResultToast message={status} gameTitle={t('quoridor')} onExit={onExit} />}
    </main>
  );
}
