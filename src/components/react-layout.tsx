import { useEffect, useState, type ReactNode } from 'react';
import { iconPaths } from '../app/icons';
import { useI18n } from '../app/i18n';
import { Player } from '../app/types';
import { CelebrationBurst } from './CelebrationBurst';
import { playTapSound, playWinSound } from '../app/sfx';

export function Icon({ name, className = 'icon' }: { name: string; className?: string }) {
  return (
    <svg
      className={`${className} icon-${name}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: iconPaths[name] ?? '' }}
    />
  );
}

export function GameHeader({
  title,
  statIcon,
  statLabel,
  statValue,
  statSuffix,
  onExit,
}: {
  title: string;
  statIcon: string;
  statLabel: string;
  statValue: string | number;
  statSuffix?: ReactNode;
  onExit: () => void;
}) {
  const { t } = useI18n();
  return (
    <header className="topbar game-topbar">
      <button type="button" className="icon-btn" onClick={onExit} aria-label={t('backToMenu')}>
        <Icon name="back" />
      </button>
      <h1 className="topbar-title">{title}</h1>
      <div className="game-topbar-stat">
        <Icon name={statIcon} />
        <span>{statLabel}</span>
        <b>{statValue}</b>
        {statSuffix}
      </div>
    </header>
  );
}

export function ScoreStrip({
  leftLabel,
  leftMark,
  rightLabel,
  rightMark,
  scores,
  inGameScores,
  inGameUnit,
  turn,
}: {
  leftLabel: string;
  leftMark: string;
  rightLabel: string;
  rightMark: string;
  scores: Record<'X' | 'O', number>;
  inGameScores?: Record<'X' | 'O', number | string>;
  inGameUnit?: string;
  turn?: Player;
}) {
  const { language, t } = useI18n();
  const formatVal = (val: number | string) =>
    typeof val === 'number' ? new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en').format(val) : val;

  return (
    <section className="score-strip">
      <div className={`score-player score-player-x ${scores.X > scores.O ? 'is-leading' : ''}`}>
        <b className={`score-mark x-label ${turn === 'X' ? 'is-active' : ''}`} aria-hidden="true">
          {leftMark}
        </b>
        <span className="score-copy">
          <small>{leftLabel}</small>
          <div className="score-values">
            <strong className="score-round-val" title={t('roundScore')}>
              {formatVal(scores.X)}
            </strong>
            {inGameScores !== undefined && (
              <span className="score-ingame-chip" title={t('inGameScore')}>
                <span className="score-ingame-num">{formatVal(inGameScores.X)}</span>
                {inGameUnit && <span className="score-ingame-unit">{inGameUnit}</span>}
              </span>
            )}
          </div>
        </span>
      </div>
      <div className="score-divider" aria-hidden="true">
        <span>{t('versus')}</span>
      </div>
      <div className={`score-player score-player-o ${scores.O > scores.X ? 'is-leading' : ''}`}>
        <b className={`score-mark o-label ${turn === 'O' ? 'is-active' : ''}`} aria-hidden="true">
          {rightMark}
        </b>
        <span className="score-copy">
          <small>{rightLabel}</small>
          <div className="score-values">
            <strong className="score-round-val" title={t('roundScore')}>
              {formatVal(scores.O)}
            </strong>
            {inGameScores !== undefined && (
              <span className="score-ingame-chip" title={t('inGameScore')}>
                <span className="score-ingame-num">{formatVal(inGameScores.O)}</span>
                {inGameUnit && <span className="score-ingame-unit">{inGameUnit}</span>}
              </span>
            )}
          </div>
        </span>
      </div>
    </section>
  );
}

const MATCH_RESULT_DURATION = 3500;

export function MatchResultToast({ message, gameTitle: _gameTitle, onExit }: { message: string; gameTitle?: string; onExit?: () => void }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    playWinSound();
    const timeout = window.setTimeout(() => {
      if (onExit) {
        onExit();
      } else {
        setVisible(false);
      }
    }, MATCH_RESULT_DURATION);
    return () => window.clearTimeout(timeout);
  }, [onExit]);

  if (!visible) return null;

  return (
    <>
      <CelebrationBurst />
      <div className="match-result-toast" role="status" aria-live="assertive" aria-atomic="true">
        <span className="match-result-toast-spark" aria-hidden="true">
          ✦
        </span>
        <div className="match-result-toast-content">
          <small>{t('matchComplete')}</small>
          <strong>{message}</strong>
        </div>
        <button
          type="button"
          className="match-result-timer-btn"
          onClick={() => {
            playTapSound();
            onExit?.();
          }}
          aria-label={t('backToMenu')}
          title={t('backToMenu')}
        >
          <svg className="timer-ring" viewBox="0 0 36 36" aria-hidden="true">
            <circle className="timer-ring-track" cx="18" cy="18" r="15" />
            <circle className="timer-ring-progress" cx="18" cy="18" r="15" />
          </svg>
          <Icon name="home" />
        </button>
      </div>
    </>
  );
}

export function Tip({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <p className="tip">
      {t('tip')} <span>{children}</span>
    </p>
  );
}

export function GameStatus({
  children,
  role = 'status',
  ariaLive = 'polite',
}: {
  children: ReactNode;
  role?: 'status' | 'alert';
  ariaLive?: 'polite' | 'assertive';
}) {
  return (
    <div className="game-status" role={role} aria-live={ariaLive}>
      {children}
    </div>
  );
}
