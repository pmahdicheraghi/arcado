import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { applySettings, loadSettings, saveSettings, type SettingKey, type Settings } from './settings';
import type { GameSetup, View } from './types';
import { MusicController } from './music';
import { unlockAudio, playTapSound } from './sfx';
import { addEitaaToHomeScreen, checkEitaaHomeScreen, initEitaaSdk, setEitaaBackButton } from './eitaa';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { TicTacToePage } from '../pages/tic-tac-toe/TicTacToePage';
import { MemoryMatchPage } from '../pages/memory-match/MemoryMatchPage';
import { ReactionDuelPage } from '../pages/reaction-duel/ReactionDuelPage';
import { ConnectFourPage } from '../pages/connect-four/ConnectFourPage';
import { DotsBoxesPage } from '../pages/dots-boxes/DotsBoxesPage';
import { OthelloPage } from '../pages/othello/OthelloPage';
import { NimPage } from '../pages/nim/NimPage';
import { TugOfWarPage } from '../pages/tug-of-war/TugOfWarPage';
import { ColorWarPage } from '../pages/color-war/ColorWarPage';
import { GameSetupDialog } from '../components/GameSetupDialog';
import { StatsPage } from '../components/StatsDialog';
import { translate, useI18n, type Language } from './i18n';
import { animateIn } from './animation';
import { Icon } from '../components/react-layout';
import { resolveHeaderAction, usePwaUpdate } from './usePwaUpdate';
import { limitPlayerName, loadPlayerNames, normalizePlayerName, savePlayerNames, type PlayerNames } from './player-names';

type InstallOutcome = 'accepted' | 'dismissed';
type HistoryView = View | 'setup';
const HISTORY_VIEW_KEY = 'sideQuestView';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallOutcome; platform: string }>;
}

const PWA_INSTALLED_KEY = 'pwa_installed';

function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone) ||
    document.referrer.startsWith('android-app://')
  );
}

function getInitialIsInstalled(): boolean {
  if (isStandaloneDisplayMode()) return true;
  try {
    return localStorage.getItem(PWA_INSTALLED_KEY) === 'true';
  } catch {
    return false;
  }
}

function setStorageInstalled(installed: boolean): void {
  try {
    if (installed) localStorage.setItem(PWA_INSTALLED_KEY, 'true');
    else localStorage.removeItem(PWA_INSTALLED_KEY);
  } catch {
    // Storage access may fail in private mode or embedded frames.
  }
}

export function ReactApp(): ReactElement {
  const { language } = useI18n();
  const [view, setView] = useState<View>('menu');
  const [pendingGame, setPendingGame] = useState<Exclude<View, 'menu' | 'settings' | 'stats'> | null>(null);
  const [gameSetup, setGameSetup] = useState<GameSetup>({ mode: 'bot', difficulty: 'normal', rounds: 3 });
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [playerNames, setPlayerNames] = useState<PlayerNames>(() => loadPlayerNames());
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(getInitialIsInstalled);
  const [eitaaCanAddToHomeScreen, setEitaaCanAddToHomeScreen] = useState(false);
  const [dismissedUpdate, setDismissedUpdate] = useState<string | null>(null);
  const musicRef = useRef<MusicController | null>(null);
  const pwaUpdate = usePwaUpdate();

  if (!musicRef.current) musicRef.current = new MusicController(settings.music);

  useEffect(() => {
    initEitaaSdk();
    return checkEitaaHomeScreen(setEitaaCanAddToHomeScreen);
  }, []);

  useEffect(() => {
    applySettings(settings);
    musicRef.current?.setEnabled(settings.music);
  }, [settings]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setIsInstalled(false);
      setStorageInstalled(false);
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      setStorageInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if ('getInstalledRelatedApps' in navigator) {
      (navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> })
        .getInstalledRelatedApps?.()
        .then((apps) => {
          if (Array.isArray(apps) && apps.length > 0) {
            setIsInstalled(true);
            setStorageInstalled(true);
          }
        })
        .catch(() => {});
    }

    const standaloneMedia = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsInstalled(true);
        setStorageInstalled(true);
      }
    };
    standaloneMedia.addEventListener?.('change', handleMediaChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      standaloneMedia.removeEventListener?.('change', handleMediaChange);
    };
  }, []);

  useEffect(() => {
    window.history.replaceState(historyStateFor('menu'), '');
    const handlePopState = (event: PopStateEvent) => {
      const historyView = viewFromHistory(event.state);
      if (historyView === 'setup') {
        return;
      } else if (historyView === 'menu') {
        setPendingGame(null);
        setView('menu');
      } else if (historyView) {
        setPendingGame(null);
        setView(historyView);
      } else {
        setPendingGame(null);
        setView('menu');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const returnToMenu = () => {
    setPendingGame(null);
    if (viewFromHistory(window.history.state) !== 'menu') {
      window.history.back();
      return;
    }
    setView('menu');
  };

  useEffect(() => {
    const isSubPage = view !== 'menu';
    const isModalOpen = Boolean(pendingGame);
    const shouldShowBack = isSubPage || isModalOpen;

    const handleBack = () => {
      if (pendingGame) {
        setPendingGame(null);
        if (viewFromHistory(window.history.state) === 'setup') {
          window.history.back();
        }
      } else if (view !== 'menu') {
        returnToMenu();
      }
    };

    return setEitaaBackButton(shouldShowBack, handleBack);
  }, [view, pendingGame]);

  const updateSetting = (key: SettingKey) => {
    setSettings((current) => {
      const next = { ...current, [key]: !current[key] };
      saveSettings(next);
      return next;
    });
  };

  const updatePlayerName = (player: keyof PlayerNames, name: string) => {
    setPlayerNames((current) => {
      const next = { ...current, [player]: limitPlayerName(name) };
      savePlayerNames(next);
      return next;
    });
  };

  const activePlayerNames: PlayerNames = {
    X: normalizePlayerName(playerNames.X) || translate(language, 'player1'),
    O:
      gameSetup.mode === 'bot'
        ? translate(language, `${gameSetup.difficulty}Bot`)
        : normalizePlayerName(playerNames.O) || translate(language, 'player2'),
  };

  const navigate = (nextView: View) => {
    musicRef.current?.handleGesture();
    unlockAudio();
    if (
      nextView === 'tic' ||
      nextView === 'memory' ||
      nextView === 'reaction' ||
      nextView === 'connect' ||
      nextView === 'dots' ||
      nextView === 'othello' ||
      nextView === 'nim' ||
      nextView === 'tug' ||
      nextView === 'colorwar'
    ) {
      window.history.pushState(historyStateFor('setup'), '');
      setPendingGame(nextView);
      return;
    }
    if (nextView === 'menu') {
      returnToMenu();
      return;
    }
    window.history.pushState(historyStateFor(nextView), '');
    setView(nextView);
  };

  const startGame = (setup: GameSetup) => {
    if (!pendingGame) return;
    const chosenGame = pendingGame;
    setGameSetup(setup);
    window.history.replaceState(historyStateFor(chosenGame), '');
    setView(chosenGame);
    setPendingGame(null);
  };

  const installApp = async () => {
    if (addEitaaToHomeScreen()) {
      return;
    }
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setStorageInstalled(true);
    }
  };

  return (
    <div
      className="react-content"
      onClick={() => {
        musicRef.current?.handleGesture();
        unlockAudio();
      }}
      onPointerDown={() => {
        musicRef.current?.handleGesture();
        unlockAudio();
      }}
    >
      {view === 'menu' && (
        <MenuPage
          onNavigate={navigate}
          isInstalled={isInstalled}
          canInstall={!isInstalled && Boolean(installPrompt || eitaaCanAddToHomeScreen)}
          onInstall={installApp}
          isUpdateAvailable={pwaUpdate.status === 'ready' || pwaUpdate.status === 'applying'}
          updateVersion={pwaUpdate.availableVersion}
          isUpdating={pwaUpdate.status === 'applying'}
          showUpdate={(pwaUpdate.status === 'ready' || pwaUpdate.status === 'applying') && dismissedUpdate !== pwaUpdate.availableVersion}
          onUpdate={pwaUpdate.applyUpdate}
          onDismissUpdate={() => setDismissedUpdate(pwaUpdate.availableVersion)}
        />
      )}
      {view === 'settings' && (
        <SettingsPage
          settings={settings}
          playerNames={playerNames}
          onChange={updateSetting}
          onPlayerNameChange={updatePlayerName}
          onBack={returnToMenu}
        />
      )}
      {view === 'stats' && <StatsPage onBack={returnToMenu} />}
      {view === 'tic' && <TicTacToePage setup={gameSetup} playerNames={activePlayerNames} onExit={returnToMenu} />}
      {view === 'memory' && <MemoryMatchPage setup={gameSetup} playerNames={activePlayerNames} onExit={returnToMenu} />}
      {view === 'reaction' && <ReactionDuelPage setup={gameSetup} playerNames={activePlayerNames} onExit={returnToMenu} />}
      {view === 'connect' && <ConnectFourPage setup={gameSetup} playerNames={activePlayerNames} onExit={returnToMenu} />}
      {view === 'dots' && <DotsBoxesPage setup={gameSetup} playerNames={activePlayerNames} onExit={returnToMenu} />}
      {view === 'othello' && <OthelloPage setup={gameSetup} playerNames={activePlayerNames} onExit={returnToMenu} />}
      {view === 'nim' && <NimPage setup={gameSetup} playerNames={activePlayerNames} onExit={returnToMenu} />}
      {view === 'tug' && <TugOfWarPage setup={gameSetup} playerNames={activePlayerNames} onExit={returnToMenu} />}
      {view === 'colorwar' && <ColorWarPage setup={gameSetup} playerNames={activePlayerNames} onExit={returnToMenu} />}
      {pendingGame && (
        <GameSetupDialog
          gameTitle={gameTitle(pendingGame, language)}
          initialSetup={gameSetup}
          themeClass={`theme-${pendingGame}`}
          onCancel={() => {
            setPendingGame(null);
            if (viewFromHistory(window.history.state) === 'setup') {
              window.history.back();
            }
          }}
          onStart={startGame}
        />
      )}
    </div>
  );
}

function historyStateFor(view: HistoryView): Record<string, unknown> {
  const current = window.history.state;
  const base = current && typeof current === 'object' ? current : {};
  return { ...base, [HISTORY_VIEW_KEY]: view };
}

function viewFromHistory(state: unknown): HistoryView | null {
  if (!state || typeof state !== 'object') return null;
  const value = (state as Record<string, unknown>)[HISTORY_VIEW_KEY];
  if (value === 'reversi') return 'othello';
  return value === 'menu' ||
    value === 'settings' ||
    value === 'tic' ||
    value === 'memory' ||
    value === 'reaction' ||
    value === 'connect' ||
    value === 'dots' ||
    value === 'othello' ||
    value === 'nim' ||
    value === 'tug' ||
    value === 'colorwar' ||
    value === 'setup' ||
    value === 'stats'
    ? (value as HistoryView)
    : null;
}

function gameTitle(view: Exclude<View, 'menu' | 'settings' | 'stats'>, language: Language): string {
  if (view === 'tic') return translate(language, 'ticTacToe');
  if (view === 'memory') return translate(language, 'memoryMatch');
  if (view === 'reaction') return translate(language, 'reactionDuel');
  if (view === 'connect') return translate(language, 'connectFour');
  if (view === 'dots') return translate(language, 'dotsBoxes');
  if (view === 'nim') return translate(language, 'nim');
  if (view === 'tug') return translate(language, 'tugOfWar');
  if (view === 'colorwar') return translate(language, 'colorwar');
  return translate(language, 'othello');
}

const CONNECT_PREVIEW_SLOTS: ReadonlyArray<'x' | 'o' | null> = [
  null,
  null,
  null,
  null,
  'x',
  null,
  null,
  null,
  null,
  null,
  'x',
  'o',
  null,
  null,
  null,
  null,
  'x',
  'o',
  'x',
  null,
  null,
  null,
  'x',
  'o',
  'o',
  'o',
  null,
  null,
];

interface OthelloPreviewCell {
  disc?: 'dark' | 'light';
  hint?: boolean;
}

const OTHELLO_PREVIEW_CELLS: ReadonlyArray<OthelloPreviewCell> = [
  { hint: true },
  { hint: true },
  { hint: true },
  { hint: true },
  { hint: true },
  { hint: true },
  { hint: true },
  { hint: true },
  { disc: 'dark' },
  { disc: 'light' },
  { hint: true },
  { hint: true },
  { hint: true },
  { hint: true },
  { disc: 'light' },
  { disc: 'dark' },
  { hint: true },
  { hint: true },
  { hint: true },
  { hint: true },
  { hint: true },
  { hint: true },
  { hint: true },
  { hint: true },
];

interface ColorWarPreviewCell {
  player?: 'x' | 'o';
  dots?: 1 | 2 | 3;
  shockwave?: boolean;
}

const COLOR_WAR_PREVIEW_CELLS: ReadonlyArray<ColorWarPreviewCell> = [
  {},
  { player: 'x', dots: 1 },
  { player: 'x', dots: 2 },
  {},
  { player: 'o', dots: 1 },
  { player: 'x', dots: 2 },
  { player: 'o', dots: 3, shockwave: true },
  {},
  { player: 'o', dots: 2 },
  {},
  {},
  {},
  { player: 'x', dots: 3 },
  { player: 'o', dots: 1 },
  {},
];

function MenuPage({
  onNavigate,
  isInstalled,
  canInstall,
  onInstall,
  isUpdateAvailable,
  updateVersion,
  isUpdating,
  showUpdate,
  onUpdate,
  onDismissUpdate,
}: {
  onNavigate: (view: View) => void;
  isInstalled: boolean;
  canInstall: boolean;
  onInstall: () => void;
  isUpdateAvailable: boolean;
  updateVersion: string | null;
  isUpdating: boolean;
  showUpdate: boolean;
  onUpdate: () => void;
  onDismissUpdate: () => void;
}) {
  const { language, t } = useI18n();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    animateIn('.welcome > *, .game-card, .menu-footer');
  }, [language]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <main className="shell menu-screen">
      <header className="topbar menu-topbar">
        <button type="button" className="brand" onClick={() => onNavigate('menu')} aria-label={t('backToMenu')}>
          <span className="brand-mark">✦</span>
          <span>{t('appName')}</span>
        </button>
        <div className="menu-topbar-actions">
          <span className={`topbar-meta connection-status ${isOnline ? 'is-online' : 'is-offline'}`} role="status" aria-live="polite">
            <span className="online-dot" aria-hidden="true" />
            {t(isOnline ? 'online' : 'offline')}
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              playTapSound();
              onNavigate('stats');
            }}
            aria-label={t('statsTitle')}
          >
            <Icon name="trophy" />
          </button>
          <button type="button" className="icon-btn" onClick={() => onNavigate('settings')} aria-label={t('openSettings')}>
            <Icon name="settings" />
          </button>
        </div>
      </header>

      {showUpdate && updateVersion && (
        <section className="update-banner" role="status" aria-live="polite">
          <div className="update-copy">
            <strong>{t('updateReady', { version: updateVersion })}</strong>
            <span>{t('updateDescription')}</span>
          </div>
          <div className="update-actions">
            <button type="button" className="update-primary" onClick={onUpdate} disabled={isUpdating}>
              {t(isUpdating ? 'updating' : 'updateNow')}
            </button>
            <button type="button" className="update-later" onClick={onDismissUpdate} disabled={isUpdating}>
              {t('updateLater')}
            </button>
          </div>
        </section>
      )}

      <section className="welcome">
        <div className="eyebrow">
          <span className="eyebrow-line" /> {t('pocketArcade')} <span className="eyebrow-line" />
        </div>
        <h1>
          {t('heroSmallGames')}
          <br />
          <em>{t('heroBigEnergy')}</em>
        </h1>
        <p className="intro">{t('heroIntro')}</p>
      </section>

      <section className="game-list" aria-label={t('chooseGame')}>
        <GameCard
          view="tic"
          number={t('logic')}
          title={t('ticTacToe')}
          description={t('ticDescription')}
          visual={
            <div className="tic-mini-board">
              <span className="tic-mini-cell is-x">×</span>
              <span className="tic-mini-cell" />
              <span className="tic-mini-cell is-o">○</span>
              <span className="tic-mini-cell" />
              <span className="tic-mini-cell is-x">×</span>
              <span className="tic-mini-cell" />
              <span className="tic-mini-cell is-o">○</span>
              <span className="tic-mini-cell" />
              <span className="tic-mini-cell is-x">×</span>
            </div>
          }
          firstMeta={
            <>
              <Icon name="users" /> {t('twoPlayers')}
            </>
          }
          secondMeta={
            <>
              <Icon name="bot" /> {t('vsBot')}
            </>
          }
          onSelect={onNavigate}
        />
        <GameCard
          view="memory"
          number={t('memory')}
          title={t('memoryMatch')}
          description={t('memoryDescription')}
          visual={
            <div className="memory-mini-grid">
              <span className="memory-mini-card is-matched">✦</span>
              <span className="memory-mini-card">●</span>
              <span className="memory-mini-card">☀</span>
              <span className="memory-mini-card">⬟</span>
              <span className="memory-mini-card">✚</span>
              <span className="memory-mini-card is-matched">✦</span>
              <span className="memory-mini-card">◒</span>
              <span className="memory-mini-card">✿</span>
            </div>
          }
          firstMeta={
            <>
              <Icon name="spark" /> {t('eightPairs')}
            </>
          }
          secondMeta={
            <>
              <Icon name="users" /> {t('passAndPlay')}
            </>
          }
          onSelect={onNavigate}
        />
        <GameCard
          view="reaction"
          number={t('reflex')}
          title={t('reactionDuel')}
          description={t('reactionDescription')}
          visual={
            <div className="reaction-mini-arena">
              <span className="reaction-mini-wave two" />
              <span className="reaction-mini-wave one" />
              <div className="reaction-mini-orb"></div>
            </div>
          }
          firstMeta={
            <>
              <Icon name="spark" /> {t('splitSeconds')}
            </>
          }
          secondMeta={
            <>
              <Icon name="users" /> {t('headToHead')}
            </>
          }
          onSelect={onNavigate}
        />
        <GameCard
          view="connect"
          number={t('alignment')}
          title={t('connectFour')}
          description={t('connectDescription')}
          visual={
            <div className="connect-mini-board">
              {CONNECT_PREVIEW_SLOTS.map((slot, index) => (
                <span key={index} className={`connect-mini-slot ${slot ? `is-${slot}` : ''}`} />
              ))}
            </div>
          }
          firstMeta={
            <>
              <Icon name="grid" /> {t('fourToWin')}
            </>
          }
          secondMeta={
            <>
              <Icon name="bot" /> {t('vsBot')}
            </>
          }
          onSelect={onNavigate}
        />
        <GameCard
          view="dots"
          number={t('tactics')}
          title={t('dotsBoxes')}
          description={t('dotsDescription')}
          visual={
            <svg className="dots-mini-svg" viewBox="0 0 180 116" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="10" y1="10" x2="50" y2="10" className="dots-mini-edge is-active" />
              <line x1="50" y1="10" x2="90" y2="10" className="dots-mini-edge is-active" />
              <line x1="90" y1="10" x2="130" y2="10" className="dots-mini-edge" />
              <line x1="130" y1="10" x2="170" y2="10" className="dots-mini-edge" />
              <line x1="10" y1="42" x2="50" y2="42" className="dots-mini-edge is-active" />
              <line x1="50" y1="42" x2="90" y2="42" className="dots-mini-edge" />
              <line x1="90" y1="42" x2="130" y2="42" className="dots-mini-edge is-active" />
              <line x1="130" y1="42" x2="170" y2="42" className="dots-mini-edge" />
              <line x1="10" y1="74" x2="50" y2="74" className="dots-mini-edge" />
              <line x1="50" y1="74" x2="90" y2="74" className="dots-mini-edge is-active" />
              <line x1="90" y1="74" x2="130" y2="74" className="dots-mini-edge is-active" />
              <line x1="130" y1="74" x2="170" y2="74" className="dots-mini-edge is-active" />
              <line x1="10" y1="106" x2="50" y2="106" className="dots-mini-edge is-active" />
              <line x1="50" y1="106" x2="90" y2="106" className="dots-mini-edge" />
              <line x1="90" y1="106" x2="130" y2="106" className="dots-mini-edge is-active" />
              <line x1="130" y1="106" x2="170" y2="106" className="dots-mini-edge is-active" />
              <line x1="10" y1="10" x2="10" y2="42" className="dots-mini-edge is-active" />
              <line x1="50" y1="10" x2="50" y2="42" className="dots-mini-edge is-active" />
              <line x1="90" y1="10" x2="90" y2="42" className="dots-mini-edge is-active" />
              <line x1="130" y1="10" x2="130" y2="42" className="dots-mini-edge" />
              <line x1="170" y1="10" x2="170" y2="42" className="dots-mini-edge" />
              <line x1="10" y1="42" x2="10" y2="74" className="dots-mini-edge" />
              <line x1="50" y1="42" x2="50" y2="74" className="dots-mini-edge" />
              <line x1="90" y1="42" x2="90" y2="74" className="dots-mini-edge is-active" />
              <line x1="130" y1="42" x2="130" y2="74" className="dots-mini-edge is-active" />
              <line x1="170" y1="42" x2="170" y2="74" className="dots-mini-edge is-active" />
              <line x1="10" y1="74" x2="10" y2="106" className="dots-mini-edge is-active" />
              <line x1="50" y1="74" x2="50" y2="106" className="dots-mini-edge" />
              <line x1="90" y1="74" x2="90" y2="106" className="dots-mini-edge" />
              <line x1="130" y1="74" x2="130" y2="106" className="dots-mini-edge is-active" />
              <line x1="170" y1="74" x2="170" y2="106" className="dots-mini-edge is-active" />
              {[10, 42, 74, 106].map((y) =>
                [10, 50, 90, 130, 170].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.8" className="dots-mini-dot" />),
              )}
            </svg>
          }
          firstMeta={
            <>
              <Icon name="grid" /> {t('nineBoxes')}
            </>
          }
          secondMeta={
            <>
              <Icon name="bot" /> {t('chainTactics')}
            </>
          }
          onSelect={onNavigate}
        />
        <GameCard
          view="othello"
          number={t('territory')}
          title={t('othello')}
          description={t('othelloDescription')}
          visual={
            <div className="othello-mini-board">
              {OTHELLO_PREVIEW_CELLS.map((cell, index) => (
                <span key={index} className="othello-mini-cell">
                  {cell.disc && <i className={`othello-mini-disc is-${cell.disc}`} />}
                  {cell.hint && <i className="othello-mini-hint" />}
                </span>
              ))}
            </div>
          }
          firstMeta={
            <>
              <Icon name="grid" /> {t('sixtyFourTiles')}
            </>
          }
          secondMeta={
            <>
              <Icon name="bot" /> {t('vsBot')}
            </>
          }
          onSelect={onNavigate}
        />
        <GameCard
          view="nim"
          number={t('strategy')}
          title={t('nim')}
          description={t('nimDescription')}
          visual={
            <div className="nim-mini-board">
              <div className="nim-mini-row">
                <span className="nim-mini-match">
                  <i />
                  <b />
                </span>
                <span className="nim-mini-match">
                  <i />
                  <b />
                </span>
                <span className="nim-mini-match">
                  <i />
                  <b />
                </span>
              </div>
              <div className="nim-mini-row">
                <span className="nim-mini-match">
                  <i />
                  <b />
                </span>
                <span className="nim-mini-match is-staged">
                  <i />
                  <b />
                </span>
                <span className="nim-mini-match">
                  <i />
                  <b />
                </span>
                <span className="nim-mini-match">
                  <i />
                  <b />
                </span>
              </div>
              <div className="nim-mini-row">
                <span className="nim-mini-match">
                  <i />
                  <b />
                </span>
                <span className="nim-mini-match">
                  <i />
                  <b />
                </span>
                <span className="nim-mini-match">
                  <i />
                  <b />
                </span>
                <span className="nim-mini-match">
                  <i />
                  <b />
                </span>
                <span className="nim-mini-match">
                  <i />
                  <b />
                </span>
              </div>
            </div>
          }
          firstMeta={
            <>
              <Icon name="flame" /> {t('matchesUnit')}
            </>
          }
          secondMeta={
            <>
              <Icon name="bot" /> {t('vsBot')}
            </>
          }
          onSelect={onNavigate}
        />
        <GameCard
          view="tug"
          number={t('action')}
          title={t('tugOfWar')}
          description={t('tugDescription')}
          visual={
            <div className="tug-mini-track">
              <span className="tug-mini-anchor is-left" />
              <div className="tug-mini-rope">
                <span className="tug-mini-tick" />
                <div className="tug-mini-knot">
                  <span>✦</span>
                </div>
              </div>
              <span className="tug-mini-anchor is-right" />
            </div>
          }
          firstMeta={
            <>
              <Icon name="zap" /> {t('pullRope')}
            </>
          }
          secondMeta={
            <>
              <Icon name="users" /> {t('headToHead')}
            </>
          }
          onSelect={onNavigate}
        />
        <GameCard
          view="colorwar"
          number={t('chainReaction')}
          title={t('colorwar')}
          description={t('colorwarDescription')}
          visual={
            <div className="colorwar-mini-board">
              {COLOR_WAR_PREVIEW_CELLS.map((cell, index) => (
                <span key={index} className="colorwar-mini-cell">
                  {cell.dots ? (
                    <i className={`colorwar-mini-disc player-${cell.player} pips-${cell.dots}`}>
                      {Array.from({ length: cell.dots }).map((_, p) => (
                        <b key={p} className="colorwar-mini-pip" />
                      ))}
                    </i>
                  ) : null}
                  {cell.shockwave && <b className="colorwar-mini-shockwave" />}
                </span>
              ))}
            </div>
          }
          firstMeta={
            <>
              <Icon name="grid" /> {t('twentyFiveCells')}
            </>
          }
          secondMeta={
            <>
              <Icon name="bot" /> {t('vsBot')}
            </>
          }
          onSelect={onNavigate}
        />
      </section>

      <footer className="menu-footer">
        <span>
          <Icon name="spark" /> {t('footerTagline')}
        </span>
      </footer>
    </main>
  );
}

function GameCard({
  view,
  number,
  title,
  description,
  visual,
  firstMeta,
  secondMeta,
  onSelect,
}: {
  view: Exclude<View, 'menu' | 'settings'>;
  number: string;
  title: string;
  description: string;
  visual: ReactNode;
  firstMeta: ReactNode;
  secondMeta: ReactNode;
  onSelect: (view: View) => void;
}) {
  const visualClass =
    view === 'tic'
      ? 'tic-visual'
      : view === 'memory'
        ? 'memory-visual'
        : view === 'reaction'
          ? 'reaction-visual'
          : view === 'connect'
            ? 'connect-visual'
            : view === 'dots'
              ? 'dots-visual'
              : view === 'othello'
                ? 'othello-visual'
                : view === 'nim'
                  ? 'nim-visual'
                  : view === 'colorwar'
                    ? 'colorwar-visual'
                    : 'tug-visual';

  return (
    <button
      type="button"
      className={`game-card theme-${view}`}
      onClick={() => {
        playTapSound();
        onSelect(view);
      }}
    >
      <div className="card-top">
        <span className="game-number">{number}</span>
        <span className="card-arrow">
          <Icon name="arrow" />
        </span>
      </div>
      <div className={`card-visual ${visualClass}`} aria-hidden="true">
        {visual}
      </div>
      <div className="card-copy">
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="card-footer">
          <span>{firstMeta}</span>
          <span>{secondMeta}</span>
        </div>
      </div>
    </button>
  );
}
