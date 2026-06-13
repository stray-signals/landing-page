import { CRTWindow, WindowManager } from './window.js';

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
