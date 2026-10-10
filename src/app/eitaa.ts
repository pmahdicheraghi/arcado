export interface EitaaBackButton {
  isVisible: boolean;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
  show: () => void;
  hide: () => void;
}

export interface EitaaHapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged: () => void;
}

export interface EitaaWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  addToHomeScreen: () => void;
  checkHomeScreenStatus: (callback?: (status: string) => void) => void;
  requestFullscreen: () => void;
  disableVerticalSwipes: () => void;
  enableVerticalSwipes: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  BackButton: EitaaBackButton;
  HapticFeedback: EitaaHapticFeedback;
  isExpanded?: boolean;
  onEvent: (eventType: string, callback: (...args: unknown[]) => void) => void;
  offEvent: (eventType: string, callback: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    Eitaa?: {
      WebApp?: EitaaWebApp;
    };
  }
}

export function getEitaaWebApp(): EitaaWebApp | null {
  return typeof window !== 'undefined' && window.Eitaa?.WebApp ? window.Eitaa.WebApp : null;
}

export function initEitaaSdk(): void {
  const webApp = getEitaaWebApp();
  if (!webApp) return;
  try {
    webApp.ready();
    webApp.expand();
    webApp.disableVerticalSwipes();
    webApp.setHeaderColor('#121a18');
    webApp.setBackgroundColor('#121a18');
  } catch {
    // Graceful fallback if running outside Eitaa client
  }
}

export function setEitaaBackButton(visible: boolean, onBack?: () => void): () => void {
  const webApp = getEitaaWebApp();
  if (!webApp?.BackButton) return () => {};

  const backButton = webApp.BackButton;

  if (visible) {
    backButton.show();
  } else {
    backButton.hide();
  }

  if (onBack) {
    backButton.onClick(onBack);
    return () => {
      backButton.offClick(onBack);
    };
  }

  return () => {};
}

export function triggerEitaaHaptic(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    getEitaaWebApp()?.HapticFeedback?.impactOccurred(style);
  } catch {
    // Ignore if not supported
  }
}
