import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/design-system.css';
import './styles/global.css';
import './styles/components.css';
import { ReactApp } from './app/react-app';
import { I18nProvider } from './app/i18n';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(`./sw.js?v=${__APP_BUILD__}`);
}

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('App root element was not found.');

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <ReactApp />
    </I18nProvider>
  </StrictMode>,
);
