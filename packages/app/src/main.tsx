import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { applyDocumentLang, useLang } from './i18n/index.js';
import { useGame } from './state/store.js';
import './styles/global.css';

applyDocumentLang(useLang.getState().lang);

// In development the store is reachable from the console, which makes it possible to
// fast-forward a career while checking how a screen behaves years down the line.
if (import.meta.env.DEV) {
  (window as unknown as { fc: unknown }).fc = { game: useGame, lang: useLang };
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </React.StrictMode>,
);
