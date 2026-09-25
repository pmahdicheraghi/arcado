import { useEffect, useState, type ReactElement } from 'react';
import { useI18n } from '../app/i18n';
import { Icon } from './react-layout';
import { GAME_KEYS, loadStats, resetAllStats, type AllStats, type GameKey } from '../app/stats';
import { playTapSound } from '../app/sfx';
import { animateIn } from '../app/animation';
import type { GameDifficulty } from '../app/types';

const DIFFICULTIES: readonly GameDifficulty[] = ['easy', 'normal', 'hard'];

function gameTitle(key: GameKey, t: ReturnType<typeof useI18n>['t']): string {
  switch (key) {
    case 'tic':
      return t('ticTacToe');
    case 'memory':
      return t('memoryMatch');
    case 'reaction':
      return t('reactionDuel');
    case 'connect':
      return t('connectFour');
    case 'dots':
      return t('dotsBoxes');
    case 'othello':
      return t('othello');
    case 'nim':
      return t('nim');
    case 'tug':
      return t('tugOfWar');
    case 'colorwar':
      return t('colorwar');
  }
}

function gameIcon(key: GameKey): string {
  switch (key) {
    case 'tic':
      return 'spark';
    case 'memory':
      return 'spark';
    case 'reaction':
      return 'spark';
    case 'connect':
      return 'grid';
    case 'dots':
      return 'grid';
    case 'othello':
      return 'grid';
    case 'nim':
      return 'flame';
    case 'tug':
      return 'zap';
    case 'colorwar':
      return 'spark';
  }
}

export function StatsPage({ onBack }: { onBack: () => void }): ReactElement {
  const { language, t } = useI18n();
  const [stats, setStats] = useState<AllStats>(() => loadStats());
  const [confirmReset, setConfirmReset] = useState(false);
  const numberFormatter = new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en');

  useEffect(() => animateIn('.stats-page-intro > *, .stats-overview, .stats-game-row'), []);

  const totalPlayed = GAME_KEYS.reduce((acc, k) => acc + stats[k].played, 0);
  const totalWins = GAME_KEYS.reduce((acc, k) => acc + stats[k].wins, 0);
  const overallWinRate = totalPlayed > 0 ? Math.round((totalWins / totalPlayed) * 100) : 0;
  const bestOverallStreak = Math.max(0, ...GAME_KEYS.map((k) => stats[k].bestStreak));

  const handleReset = () => {
    playTapSound();
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    const fresh = resetAllStats();
    setStats(fresh);
    setConfirmReset(false);
  };

  return (
    <main className="shell stats-screen">
      <header className="topbar subpage-topbar">
        <button
          type="button"
          className="icon-btn"
          onClick={() => {
            playTapSound();
            onBack();
          }}
          aria-label={t('backToMenu')}
        >
          <Icon name="back" />
        </button>
        <span className="topbar-title">{t('statsTitle')}</span>
        <span className="topbar-spacer" aria-hidden="true" />
      </header>

      <section className="stats-page-intro">
        <div className="eyebrow align-left">
          <Icon name="trophy" /> {t('stats')}
        </div>
        <h1>{t('statsTitle')}</h1>
        <p>{t('statsIntro')}</p>
      </section>

      <section className="stats-page-content">
        {totalPlayed === 0 ? (
          <div className="stats-empty-state">
            <span className="stats-empty-icon" aria-hidden="true">
              <Icon name="trophy" />
            </span>
            <p>{t('noStatsYet')}</p>
          </div>
        ) : (
          <>
            <div className="stats-overview">
              <div
                className="stats-win-ring"
                style={{ background: `conic-gradient(var(--acid) ${overallWinRate}%, var(--surface-tint) 0)` }}
              >
                <div>
                  <strong>{numberFormatter.format(overallWinRate)}%</strong>
                  <span>{t('winRate')}</span>
                </div>
              </div>
              <div className="stats-summary-grid">
                <div className="stats-summary-card">
                  <span className="stats-summary-val">{numberFormatter.format(totalPlayed)}</span>
                  <span className="stats-summary-label">{t('totalMatches')}</span>
                </div>
                <div className="stats-summary-card">
                  <span className="stats-summary-val stats-highlight">{numberFormatter.format(totalWins)}</span>
                  <span className="stats-summary-label">{t('totalWins')}</span>
                </div>
                <div className="stats-summary-card">
                  <span className="stats-summary-val">{numberFormatter.format(bestOverallStreak)}</span>
                  <span className="stats-summary-label">{t('bestStreak')}</span>
                </div>
              </div>
            </div>

            <div className="stats-games-list">
              {GAME_KEYS.map((key) => {
                const s = stats[key];
                const winPct = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
                return (
                  <div className={`stats-game-row theme-${key}`} key={key}>
                    <div className="stats-game-header">
                      <div className="stats-game-name">
                        <Icon name={gameIcon(key)} />
                        <strong>{gameTitle(key, t)}</strong>
                      </div>
                      <span className="stats-game-winrate">
                        {numberFormatter.format(winPct)}% {t('winRate')}
                      </span>
                    </div>
                    <div className="stats-game-progress" aria-hidden="true">
                      <span style={{ width: `${winPct}%` }} />
                    </div>

                    <div className="stats-game-metrics">
                      <div className="stats-metric">
                        <small>{t('gamesPlayed')}</small>
                        <b>{numberFormatter.format(s.played)}</b>
                      </div>
                      <div className="stats-metric">
                        <small>{t('winsLabel')}</small>
                        <b className="stats-wins-val">{numberFormatter.format(s.wins)}</b>
                      </div>
                      <div className="stats-metric">
                        <small>{t('lossesLabel')}</small>
                        <b>{numberFormatter.format(s.losses)}</b>
                      </div>
                      <div className="stats-metric">
                        <small>{t('drawsLabel')}</small>
                        <b>{numberFormatter.format(s.draws)}</b>
                      </div>
                      <div className="stats-metric">
                        <small>{t('bestStreak')}</small>
                        <b>{numberFormatter.format(s.bestStreak)}</b>
                      </div>
                      {key === 'reaction' && s.bestReactionMs !== undefined && (
                        <div className="stats-metric stats-metric-reflex">
                          <small>{t('fastestReaction')}</small>
                          <b>
                            {numberFormatter.format(s.bestReactionMs)} {t('milliseconds')}
                          </b>
                        </div>
                      )}
                    </div>
                    <div className="stats-difficulty-wins">
                      <span className="stats-difficulty-label">{t('winsByDifficulty')}</span>
                      <div>
                        {DIFFICULTIES.map((difficulty) => (
                          <span className={`stats-difficulty-chip difficulty-${difficulty}`} key={difficulty}>
                            <small>{t(difficulty)}</small>
                            <b>{numberFormatter.format(s.winsByDifficulty[difficulty])}</b>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="stats-actions">
          {totalPlayed > 0 && (
            <button type="button" className={`stats-reset-btn ${confirmReset ? 'is-confirming' : ''}`} onClick={handleReset}>
              <Icon name="trash" />
              <span>{t(confirmReset ? 'confirmResetStats' : 'resetStats')}</span>
            </button>
          )}
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              playTapSound();
              onBack();
            }}
          >
            {t('backToMenuAction')}
          </button>
        </div>
      </section>
    </main>
  );
}
