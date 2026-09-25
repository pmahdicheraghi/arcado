import { useEffect, useRef, useState, type ReactNode } from 'react';
import anime from 'animejs';
import { animateIn, motionEnabled } from '../../app/animation';
import { useI18n } from '../../app/i18n';
import { triggerHaptic } from '../../app/settings';
import { getRoundStarter, type GameSetup, type Player } from '../../app/types';
import { GameHeader, GameStatus, MatchResultToast, ScoreStrip, Tip } from '../../components/react-layout';
import { playMoveSound, playPairSound } from '../../app/sfx';
import { recordMatchResult } from '../../app/stats';
import {
  chooseDotsBotEdge,
  countOwnedBoxes,
  createDotBoxes,
  DOT_BOX_SIZE,
  getCompletedBoxes,
  isDotsBoardComplete,
  type DotBoxes,
  type DotEdge,
  type DotEdges,
} from './dots-boxes-logic';
import './dots-boxes.css';
import type { PlayerNames } from '../../app/player-names';

const BOARD_SETTLE_MS = 320;

export function DotsBoxesPage({ setup, playerNames, onExit }: { setup: GameSetup; playerNames: PlayerNames; onExit: () => void }) {
  const { language, t } = useI18n();
  const mode = setup.mode;
  const [edges, setEdges] = useState<DotEdges>({});
  const [boxes, setBoxes] = useState<DotBoxes>(createDotBoxes);
  const [turn, setTurn] = useState<Player>('X');
  const [roundWinner, setRoundWinner] = useState<Player | 'draw' | null>(null);
  const [newBoxes, setNewBoxes] = useState<number[]>([]);
  const [lastEdge, setLastEdge] = useState<DotEdge | null>(null);
  const [lastClaimCount, setLastClaimCount] = useState(0);
  const [isSettling, setIsSettling] = useState(false);
  const [matchScores, setMatchScores] = useState<Record<Player, number>>({ X: 0, O: 0 });
  const [round, setRound] = useState(1);
  const finishTimer = useRef<number | null>(null);
  const numberFormatter = new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en');

  useEffect(() => animateIn('.score-strip, .dots-board-wrap, .tip'), []);

  useEffect(() => {
    if (!newBoxes.length || !motionEnabled()) return;
    anime({
      targets: newBoxes.map((box) => `.dots-box[data-box="${box}"]`).join(', '),
      scale: [0.72, 1],
      opacity: [0.45, 1],
      delay: anime.stagger(75),
      duration: 360,
      easing: 'easeOutBack',
    });
  }, [newBoxes]);

  const stopFinishTimer = () => {
    if (finishTimer.current !== null) window.clearTimeout(finishTimer.current);
    finishTimer.current = null;
  };

  const finishRound = (finalBoxes: DotBoxes) => {
    const xBoxes = countOwnedBoxes(finalBoxes, 'X');
    const oBoxes = countOwnedBoxes(finalBoxes, 'O');
    const result: Player | 'draw' = xBoxes === oBoxes ? 'draw' : xBoxes > oBoxes ? 'X' : 'O';
    setRoundWinner(result);
    setIsSettling(false);
    const nextScores = {
      ...matchScores,
      ...(result !== 'draw' ? { [result]: matchScores[result] + 1 } : {}),
    };
    if (result !== 'draw') setMatchScores(nextScores);
    if (round >= setup.rounds) {
      const outcome = nextScores.X === nextScores.O ? 'draw' : nextScores.X > nextScores.O ? 'win' : 'loss';
      recordMatchResult('dots', outcome, { difficulty: mode === 'bot' ? setup.difficulty : undefined });
    }
  };

  const playEdge = (edge: DotEdge, player: Player = turn, human = true) => {
    if (edges[edge] || roundWinner || isSettling || (mode === 'bot' && human && turn === 'O')) return;
    const nextEdges: DotEdges = { ...edges, [edge]: player };
    const completed = getCompletedBoxes(nextEdges, boxes, edge);
    const nextBoxes = [...boxes];
    completed.forEach((boxIndex) => {
      nextBoxes[boxIndex] = player;
    });

    setEdges(nextEdges);
    setBoxes(nextBoxes);
    setLastEdge(edge);
    setNewBoxes(completed);
    setLastClaimCount(completed.length);
    if (completed.length) {
      playPairSound();
    } else {
      playMoveSound(player === 'O');
    }
    if (human) triggerHaptic(completed.length ? [14, 24, 14] : 4);

    if (isDotsBoardComplete(nextEdges)) {
      setIsSettling(true);
      stopFinishTimer();
      finishTimer.current = window.setTimeout(
        () => {
          finishTimer.current = null;
          finishRound(nextBoxes);
        },
        motionEnabled() ? BOARD_SETTLE_MS : 0,
      );
    } else if (!completed.length) setTurn(player === 'X' ? 'O' : 'X');
  };

  useEffect(() => {
    if (roundWinner || isSettling || mode !== 'bot' || turn !== 'O') return;
    const timeout = window.setTimeout(() => {
      const edge = chooseDotsBotEdge(edges, boxes, setup.difficulty);
      playEdge(edge, 'O', false);
    }, 390);
    return () => window.clearTimeout(timeout);
  }, [boxes, edges, isSettling, mode, roundWinner, setup.difficulty, turn]);

  const resetRound = (advance = false) => {
    stopFinishTimer();
    const nextRound = advance ? round + 1 : round;
    if (advance) setRound(nextRound);
    setEdges({});
    setBoxes(createDotBoxes());
    setTurn(getRoundStarter(nextRound));
    setRoundWinner(null);
    setNewBoxes([]);
    setLastEdge(null);
    setLastClaimCount(0);
    setIsSettling(false);
  };

  useEffect(() => {
    if (!roundWinner || round >= setup.rounds) return;
    const timeout = window.setTimeout(() => resetRound(true), 1550);
    return () => window.clearTimeout(timeout);
  }, [round, roundWinner, setup.rounds]);

  useEffect(() => () => stopFinishTimer(), []);

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
      : lastClaimCount
        ? t(lastClaimCount === 1 ? 'claimsBox' : 'claimsBoxes', {
            player: playerName(turn),
            count: numberFormatter.format(lastClaimCount),
          })
        : t('playerTurn', { player: playerName(turn) });

  return (
    <main className="shell game-screen dots-screen theme-dots">
      <GameHeader
        title={t('dotsBoxes')}
        statIcon="grid"
        statLabel={t('roundLabel')}
        statValue={numberFormatter.format(round)}
        statSuffix={<small>/ {numberFormatter.format(setup.rounds)}</small>}
        onExit={onExit}
      />
      <ScoreStrip
        leftLabel={playerNames.X}
        leftMark="■"
        rightLabel={playerNames.O}
        rightMark="■"
        scores={matchScores}
        inGameScores={{
          X: countOwnedBoxes(boxes, 'X'),
          O: countOwnedBoxes(boxes, 'O'),
        }}
        inGameUnit={t('boxesUnit')}
        turn={turn}
      />
      <section className="dots-board-wrap">
        <GameStatus>{status}</GameStatus>
        <div className={`dots-board turn-${turn.toLowerCase()}`} role="group" aria-label={t('dotsBoard')}>
          {renderBoard({
            edges,
            boxes,
            lastEdge,
            disabled: Boolean(roundWinner) || isSettling || (mode === 'bot' && turn === 'O'),
            playerName,
            numberFormatter,
            onPlay: playEdge,
            t,
          })}
        </div>
      </section>
      <Tip>{t('dotsTip')}</Tip>
      {matchComplete && <MatchResultToast message={status} gameTitle={t('dotsBoxes')} onExit={onExit} />}
    </main>
  );
}

type BoardRenderProps = {
  edges: DotEdges;
  boxes: DotBoxes;
  lastEdge: DotEdge | null;
  disabled: boolean;
  playerName: (player: Player) => string;
  numberFormatter: Intl.NumberFormat;
  onPlay: (edge: DotEdge) => void;
  t: ReturnType<typeof useI18n>['t'];
};

function renderBoard({ edges, boxes, disabled, playerName, numberFormatter, onPlay, t }: BoardRenderProps): ReactNode[] {
  return Array.from({ length: DOT_BOX_SIZE * 2 + 1 }, (_, gridRow) =>
    Array.from({ length: DOT_BOX_SIZE * 2 + 1 }, (_, gridColumn) => {
      const key = `${gridRow}-${gridColumn}`;
      if (gridRow % 2 === 0 && gridColumn % 2 === 0) return <span className="dots-dot" key={key} aria-hidden="true" />;

      if (gridRow % 2 === 1 && gridColumn % 2 === 1) {
        const boxIndex = Math.floor(gridRow / 2) * DOT_BOX_SIZE + Math.floor(gridColumn / 2);
        const owner = boxes[boxIndex];
        return (
          <span className={`dots-box ${owner ? `owner-${owner.toLowerCase()}` : ''}`} data-box={boxIndex} key={key} aria-hidden="true">
            {owner === 'X' ? '✦' : owner === 'O' ? '●' : ''}
          </span>
        );
      }

      const horizontal = gridRow % 2 === 0;
      const row = horizontal ? gridRow / 2 : Math.floor(gridRow / 2);
      const column = horizontal ? Math.floor(gridColumn / 2) : gridColumn / 2;
      const edge = `${horizontal ? 'h' : 'v'}-${row}-${column}` as DotEdge;
      const owner = edges[edge];
      const label = owner
        ? t('dotsEdgeClaimed', { player: playerName(owner) })
        : t(horizontal ? 'dotsHorizontalEdge' : 'dotsVerticalEdge', {
            row: numberFormatter.format(row + 1),
            column: numberFormatter.format(column + 1),
          });
      return (
        <button
          type="button"
          className={`dots-edge ${horizontal ? 'horizontal' : 'vertical'} ${owner ? `owner-${owner.toLowerCase()}` : ''}`}
          data-edge={edge}
          key={key}
          onClick={() => onPlay(edge)}
          disabled={disabled || Boolean(owner)}
          aria-label={label}
        />
      );
    }),
  ).flat();
}
