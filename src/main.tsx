import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './i18n/config';
import './index.css';

// ─── Polyfill pour crypto.randomUUID (nécessaire pour Electron en file://) ───
if (typeof window !== 'undefined') {
  if (!window.crypto) {
    (window as any).crypto = {};
  }
  if (!window.crypto.randomUUID) {
    window.crypto.randomUUID = function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      }) as `${string}-${string}-${string}-${string}-${string}`;
    };
  }
}
// ──────────────────────────────────────────────────────────────────────────────

// ─── Initialisation des Services Réseau ──────────────────────────────────────
// Ces imports forcent l'instanciation des singletons au démarrage.
// Leurs constructeurs enregistrent les listeners sur peerService dès le lancement.
import './services/swarm.service';
import './services/asset-dispatcher.service';
import './services/activity-log.service';
// ──────────────────────────────────────────────────────────────────────────────


ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
 <App />
);
