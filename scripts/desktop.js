import { CRTWindow, WindowManager } from './window.js';
import { APPS } from './apps.js';
import { openApp } from './app-window.js';

const avatarWin   = new CRTWindow('win-avatar');
const terminalWin = new CRTWindow('win-terminal');

// Terminal starts on top
WindowManager.focus(terminalWin);

// ── Avatar window: auto-reopen after 3s with annoyed face ─────────
document.addEventListener('window:close', ({ detail }) => {
  if (detail.id !== 'win-avatar') return;
  setTimeout(() => {
    avatarWin.open();
    document.dispatchEvent(new CustomEvent('avatar:reopened'));
  }, 3000);
});

// ── Triple-tap Stray: reopen terminal if it was closed ────────────
document.addEventListener('avatar:overtapped', () => {
  if (terminalWin.state === 'closed') terminalWin.open();
});

// ── Admin mode: hide avatar window ────────────────────────────────
document.addEventListener('terminal:adminlogin', () => {
  avatarWin.minimize();
});

// ── Round trip from an app page: restore theme, reopen the app window ──
try {
  const theme = JSON.parse(sessionStorage.getItem('stray_theme') || 'null');
  if (theme && typeof theme === 'object') {
    Object.entries(theme).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  }
} catch { /* ignore */ }

try {
  const reopen = sessionStorage.getItem('stray_reopen');
  if (reopen && APPS[reopen]) {
    sessionStorage.removeItem('stray_reopen');
    // Phones open apps as pages, so reopening here would bounce straight back.
    if (!window.matchMedia('(max-width: 700px)').matches) openApp(reopen);
  }
} catch { /* ignore */ }
