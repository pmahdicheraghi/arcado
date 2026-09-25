import { useEffect, useRef, useState } from 'react';
import anime from 'animejs';
import { animateIn, motionEnabled } from '../../app/animation';
import { triggerHaptic } from '../../app/settings';
import type { GameSetup, Player } from '../../app/types';
import { GameHeader, GameStatus, MatchResultToast, ScoreStrip, Tip } from '../../components/react-layout';
import './reaction-duel.css';
import { useI18n } from '../../app/i18n';
import { playErrorSound, playMoveSound, playPairSound } from '../../app/sfx';
import { recordMatchResult } from '../../app/stats';
import type { PlayerNames } from '../../app/player-names';
import {
  getBotReactionDelay,
  getReactionMatchWinner,
  getReactionWaitDelay,
  resolveReactionAttempt,
  type ReactionPhase,
} from './reaction-duel-logic';

export function ReactionDuelPage({ setup, playerNames, onExit }: { setup: GameSetup; playerNames: PlayerNames; onExit: () => void }) {
  const { language, t } = useI18n();
  const mode = setup.mode;
  const [phase, setPhase] = useState<ReactionPhase>('idle');
  const [scores, setScores] = useState<Record<Player, number>>({ X: 0, O: 0 });
  const [reactions, setReactions] = useState<Partial<Record<Player, number>>>({});
  const [winner, setWinner] = useState<Player | null>(null);
  const [falseStart, setFalseStart] = useState<Player | null>(null);
  const [round, setRound] = useState(1);
  const goAt = useRef(0);
  const timer = useRef<number | null>(null);
  const botTimer = useRef<number | null>(null);
  const bestReactionRef = useRef<number | undefined>(undefined);

  useEffect(() => animateIn('.score-strip, .reaction-arena-wrap, .reaction-buttons, .tip'), []);
  useEffect(() => {
    const timeout = window.setTimeout(startRound, 600);
    return () => window.clearTimeout(timeout);
  }, []);
  useEffect(() => () => stopTimers(), []);
  useEffect(() => {
    if (phase !== 'waiting') return;
    timer.current = window.setTimeout(() => {
      setPhase('go');
      playMoveSound(false);
      goAt.current = performance.now();
      if (motionEnabled()) anime({ targets: '.signal-orb', scale: [0.8, 1.12, 1], duration: 360, easing: 'easeOutBack' });
    }, getReactionWaitDelay());
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [phase]);
  useEffect(() => {
    if (phase !== 'go' || mode !== 'bot') return;
    botTimer.current = window.setTimeout(() => tap('O'), getBotReactionDelay(setup.difficulty));
    return () => {
      if (botTimer.current) window.clearTimeout(botTimer.current);
    };
  }, [phase, mode]);

  const stopTimers = () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (botTimer.current) window.clearTimeout(botTimer.current);
    timer.current = null;
    botTimer.current = null;
  };
  const startRound = () => {
    if (phase === 'result' && round >= setup.rounds) return;
    stopTimers();
    if (phase === 'idle') bestReactionRef.current = undefined;
    if (phase === 'result') setRound((current) => current + 1);
    setPhase('waiting');
    setReactions({});
    setWinner(null);
    setFalseStart(null);
    triggerHaptic(5);
  };

  useEffect(() => {
    if (phase !== 'result' || round >= setup.rounds) return;
    const timeout = window.setTimeout(startRound, 1400);
    return () => window.clearTimeout(timeout);
  }, [phase, round, setup.rounds]);

  const tap = (player: Player) => {
    const attempt = resolveReactionAttempt(phase, player, goAt.current, performance.now(), Boolean(reactions[player]));
    if (attempt.kind === 'false-start') {
      if (!(mode === 'bot' && player === 'O')) {
        playErrorSound();
        triggerHaptic([28, 40, 28]);
      }
      setFalseStart(attempt.falseStart);
      setWinner(attempt.winner);
      setPhase('result');
      stopTimers();
      const nextScores = { ...scores, [attempt.winner]: scores[attempt.winner] + 1 };
      setScores(nextScores);
      if (round >= setup.rounds) {
        const matchWinner = getReactionMatchWinner(nextScores);
        const outcome = matchWinner === 'draw' ? 'draw' : matchWinner === 'X' ? 'win' : 'loss';
        recordMatchResult('reaction', outcome, {
          reactionMs: bestReactionRef.current,
          difficulty: mode === 'bot' ? setup.difficulty : undefined,
        });
      }
      return;
    }
    if (attempt.kind !== 'reaction') return;
    if (player === 'X') {
      bestReactionRef.current = Math.min(bestReactionRef.current ?? Infinity, attempt.reaction);
    }
    if (!(mode === 'bot' && player === 'O')) {
      playPairSound();
      triggerHaptic([18, 35, 18]);
    }
    setReactions((current) => ({ ...current, [player]: attempt.reaction }));
    setWinner(attempt.winner);
    const nextScores = { ...scores, [attempt.winner]: scores[attempt.winner] + 1 };
    setScores(nextScores);
    setPhase('result');
    stopTimers();
    if (round >= setup.rounds) {
      const matchWinner = getReactionMatchWinner(nextScores);
      const outcome = matchWinner === 'draw' ? 'draw' : matchWinner === 'X' ? 'win' : 'loss';
      recordMatchResult('reaction', outcome, {
        reactionMs: bestReactionRef.current,
        difficulty: mode === 'bot' ? setup.difficulty : undefined,
      });
    }
  };

  const matchComplete = phase === 'result' && round >= setup.rounds;
  const playerName = (player: Player) => playerNames[player];
  const formatReaction = (reaction: number) =>
    `${new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en').format(reaction)} ${t('milliseconds')}`;
  const matchWinner = getReactionMatchWinner(scores);
  const status = matchComplete
    ? matchWinner === 'draw'
      ? t('matchDraw')
      : t('winsMatch', { player: playerName(matchWinner) })
    : phase === 'waiting'
      ? t('getReady')
      : phase === 'go'
        ? t('tapNow')
        : phase === 'result'
          ? falseStart
            ? t('tappedEarly', { player: playerName(falseStart), winner: playerName(winner!) })
            : t('winsRound', { player: playerName(winner!) })
          : t('pressStart');
  const label = (player: Player) =>
    phase === 'waiting'
      ? t('waitForGreen')
      : phase === 'go'
        ? t('tapNowShort')
        : phase === 'result' && falseStart
          ? falseStart === player
            ? t('tooEarly')
            : t('wins')
          : phase === 'result'
            ? winner === player
              ? t('wins')
              : t('noTap')
            : t('ready');
  const actionLabel = (player: Player) =>
    reactions[player] ? formatReaction(reactions[player]) : phase === 'waiting' ? t('ready') : phase === 'go' ? t('tap') : label(player);
  const running = phase === 'waiting' || phase === 'go';

  return (
    <main className="shell game-screen reaction-screen theme-reaction">
      <GameHeader
        title={t('reactionDuel')}
        statIcon="spark"
        statLabel={t('roundLabel')}
        statValue={new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en').format(round)}
        statSuffix={<small>/ {new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en').format(setup.rounds)}</small>}
        onExit={onExit}
      />
      <ScoreStrip leftLabel={playerNames.X} leftMark="✦" rightLabel={playerNames.O} rightMark="✦" scores={scores} />
      <section className={`reaction-arena-wrap phase-${phase}`}>
        <GameStatus ariaLive="assertive">{status}</GameStatus>
        <div className={`reaction-arena phase-${phase}`} aria-label={t('playerTapButtons')}>
          <div className="reaction-signal">
            <div className={`signal-orb ${phase === 'go' ? 'signal-go' : ''}`} aria-hidden="true">
              <span>{phase === 'go' ? t('go') : '✦'}</span>
            </div>
          </div>
          <div className="reaction-player-zones">
            <button
              type="button"
              className={`reaction-player player-one ${winner === 'X' ? 'is-winner' : ''} ${falseStart === 'X' ? 'is-false-start' : ''}`}
              onPointerDown={(event) => {
                event.preventDefault();
                tap('X');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') tap('X');
              }}
              disabled={!running}
            >
              <span>{playerNames.X}</span>
              <strong>{actionLabel('X')}</strong>
              <small>{label('X')}</small>
            </button>
            <button
              type="button"
              className={`reaction-player player-two ${mode === 'bot' ? 'is-bot' : ''} ${winner === 'O' ? 'is-winner' : ''}`}
              onPointerDown={(event) => {
                event.preventDefault();
                tap('O');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') tap('O');
              }}
              disabled={!running || mode === 'bot'}
            >
              <span>{playerNames.O}</span>
              <strong>{actionLabel('O')}</strong>
              <small>{label('O')}</small>
            </button>
          </div>
        </div>
      </section>
      <Tip>{t('reactionTip')}</Tip>
      {matchComplete && <MatchResultToast message={status} gameTitle={t('reactionDuel')} onExit={onExit} />}
    </main>
  );
}
