import { useEffect, useRef, useState } from 'react';
import { animateIn } from '../../app/animation';
import { useI18n } from '../../app/i18n';
import { triggerHaptic } from '../../app/settings';
import { getRoundStarter, type GameSetup, type Player } from '../../app/types';
import { GameHeader, GameStatus, MatchResultToast, ScoreStrip, Tip } from '../../components/react-layout';
import { playMoveSound, playPairSound, playTapSound } from '../../app/sfx';
import { recordMatchResult } from '../../app/stats';
import type { PlayerNames } from '../../app/player-names';
import { applyNimMove, chooseNimBotMove, createNimBoard, isNimGameOver, type NimMove } from './nim-logic';
import './nim.css';

export function NimPage({ setup, playerNames, onExit }: { setup: GameSetup; playerNames: PlayerNames; onExit: () => void }) {
  const { language, t } = useI18n();
  const mode = setup.mode;
  const [board, setBoard] = useState<number[]>(createNimBoard);
  const [turn, setTurn] = useState<Player>('X');
  const [winner, setWinner] = useState<Player | null>(null);
  const [scores, setScores] = useState<Record<Player, number>>({ X: 0, O: 0 });
  const [round, setRound] = useState(1);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [selectedCount, setSelectedCount] = useState<number>(0);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const botTimeoutRef = useRef<number | null>(null);
  const nextRoundTimeoutRef = useRef<number | null>(null);
  const numberFormatter = new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en');

  useEffect(() => {
    animateIn('.score-strip, .nim-board, .nim-action-bar, .tip');
  }, []);

  const totalMatchesRemaining = board.reduce((a, b) => a + b, 0);

  const finishRound = (roundWinner: Player) => {
    setWinner(roundWinner);
    const nextScores = {
      ...scores,
      [roundWinner]: scores[roundWinner] + 1,
    };
    setScores(nextScores);

    if (round >= setup.rounds) {
      const outcome = nextScores.X === nextScores.O ? 'draw' : nextScores.X > nextScores.O ? 'win' : 'loss';
      recordMatchResult('nim', outcome, { difficulty: mode === 'bot' ? setup.difficulty : undefined });
    }

    if (roundWinner === 'X' || mode === 'two') {
      triggerHaptic([18, 35, 18]);
      playPairSound();
    }
  };

  const handleApplyMove = (move: NimMove, mover: Player) => {
    const nextBoard = applyNimMove(board, move);
    setBoard(nextBoard);
    setSelectedRow(null);
    setSelectedCount(0);
    playMoveSound(mover === 'O');

    if (isNimGameOver(nextBoard)) {
      finishRound(mover);
    } else {
      setTurn(mover === 'X' ? 'O' : 'X');
    }
  };

  // Bot logic
  useEffect(() => {
    if (winner || mode !== 'bot' || turn !== 'O' || isNimGameOver(board)) return;

    setIsBotThinking(true);
    botTimeoutRef.current = window.setTimeout(() => {
      const move = chooseNimBotMove(board, setup.difficulty);
      setSelectedRow(move.row);
      setSelectedCount(move.count);

      // Brief animation pause showing what bot selected
      botTimeoutRef.current = window.setTimeout(() => {
        setIsBotThinking(false);
        handleApplyMove(move, 'O');
      }, 500);
    }, 650);

    return () => {
      if (botTimeoutRef.current !== null) {
        window.clearTimeout(botTimeoutRef.current);
      }
    };
  }, [board, mode, setup.difficulty, turn, winner]);

  const resetRound = (advanceRound = false) => {
    if (botTimeoutRef.current !== null) window.clearTimeout(botTimeoutRef.current);
    if (nextRoundTimeoutRef.current !== null) window.clearTimeout(nextRoundTimeoutRef.current);
    const nextRound = advanceRound ? round + 1 : round;
    if (advanceRound) setRound(nextRound);
    setBoard(createNimBoard());
    setTurn(getRoundStarter(nextRound));
    setWinner(null);
    setSelectedRow(null);
    setSelectedCount(0);
    setIsBotThinking(false);
  };

  useEffect(() => {
    if (!winner || round >= setup.rounds) return;
    nextRoundTimeoutRef.current = window.setTimeout(() => {
      resetRound(true);
    }, 1800);
    return () => {
      if (nextRoundTimeoutRef.current !== null) window.clearTimeout(nextRoundTimeoutRef.current);
    };
  }, [winner, round, setup.rounds]);

  const handleMatchClick = (rowIndex: number, matchIndex: number) => {
    if (winner || (mode === 'bot' && turn === 'O') || isBotThinking) return;

    playTapSound();
    triggerHaptic(8);

    if (selectedRow === rowIndex) {
      const targetCount = matchIndex + 1;
      if (selectedCount === targetCount) {
        setSelectedCount(0);
        setSelectedRow(null);
      } else {
        setSelectedCount(targetCount);
      }
    } else {
      setSelectedRow(rowIndex);
      setSelectedCount(matchIndex + 1);
    }
  };

  const handleConfirmTake = () => {
    if (selectedRow === null || selectedCount <= 0 || winner || isBotThinking) return;
    if (mode === 'bot' && turn === 'O') return;

    handleApplyMove({ row: selectedRow, count: selectedCount }, turn);
  };

  const currentTurnName = turn === 'X' ? playerNames.X : playerNames.O;
  const isHumanTurn = !(mode === 'bot' && turn === 'O');

  return (
    <main className="shell nim-page theme-nim">
      <GameHeader
        title={t('nim')}
        statIcon="flame"
        statLabel={t('roundLabel')}
        statValue={`${numberFormatter.format(round)} / ${numberFormatter.format(setup.rounds)}`}
        onExit={onExit}
      />

      <ScoreStrip
        leftLabel={playerNames.X}
        leftMark="×"
        rightLabel={playerNames.O}
        rightMark="○"
        scores={scores}
        inGameScores={{ X: totalMatchesRemaining, O: totalMatchesRemaining }}
        inGameUnit={t('matchesUnit')}
        turn={winner ? undefined : turn}
      />

      <div className="nim-game-layout">
        <GameStatus>
          {winner
            ? t('winsRound', { player: winner === 'X' ? playerNames.X : playerNames.O })
            : isBotThinking
              ? t('playerTurn', { player: playerNames.O })
              : t('playerTurn', { player: currentTurnName })}
        </GameStatus>

        <section className="nim-board" aria-label={t('nim')}>
          {board.map((count, rowIndex) => {
            const isRowSelected = selectedRow === rowIndex;
            const rowIdxFmt = numberFormatter.format(rowIndex + 1);

            return (
              <div
                key={rowIndex}
                className={`nim-row-wrapper nim-row-${rowIndex} ${isRowSelected ? 'is-selected-row' : ''} ${count === 0 ? 'is-empty' : ''}`}
              >
                <div className="nim-matches-rack">
                  {Array.from({ length: count }, (_, mIndex) => {
                    const isStaged = isRowSelected && mIndex < selectedCount;
                    return (
                      <button
                        key={mIndex}
                        type="button"
                        className={`nim-match-btn ${isStaged ? 'is-staged' : ''}`}
                        onClick={() => handleMatchClick(rowIndex, mIndex)}
                        disabled={!isHumanTurn || count === 0 || Boolean(winner)}
                        aria-label={`${t('nimPile', { pile: rowIdxFmt })}, match ${mIndex + 1}`}
                      >
                        <div className="nim-match-stick">
                          <span className="nim-match-head" />
                          <span className="nim-match-shaft" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        <div className="nim-action-bar">
          {isHumanTurn && !winner && (
            <button
              type="button"
              className="nim-confirm-btn"
              onClick={handleConfirmTake}
              disabled={selectedRow === null || selectedCount <= 0}
            >
              <span>{t('takeMatches', { count: numberFormatter.format(selectedCount || 1), unit: t('matchesUnit') })}</span>
            </button>
          )}
        </div>

        <Tip>{t('nimTip')}</Tip>
      </div>

      {winner && round >= setup.rounds && (
        <MatchResultToast
          message={scores.X === scores.O ? t('matchTie') : t('winsMatch', { player: scores.X > scores.O ? playerNames.X : playerNames.O })}
          onExit={onExit}
        />
      )}
    </main>
  );
}
