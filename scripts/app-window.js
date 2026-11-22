import { CRTWindow, WindowManager } from './window.js';
import { APPS } from './apps.js';

const wins = new Map(); // appId -> CRTWindow
const pending = new Map(); // appId -> Promise (creation in flight)

const THEME_VARS = [
  '--color-primary', '--color-primary-dim', '--color-bg',
  '--color-border', '--color-accent', '--color-accent-hi',
];
const DEFAULT_PRIMARY = '#b8ffa0';

function buildWindowMarkup(app) {
  const div = document.createElement('div');
  div.className = 'crt-window';
  div.id = app.windowId;
  div.dataset.title = app.title;
  div.dataset.page = app.pageUrl;
  div.innerHTML = `
    <div class="window-titlebar">
      <span class="window-title">${app.title}</span>
      <div class="window-controls">
        <button class="win-btn win-min"   title="minimize">−</button>
        <button class="win-btn win-max"   title="open as page">○</button>
        <button class="win-btn win-close" title="close">×</button>
      </div>
    </div>
    <div class="window-body"><div class="app-body"></div></div>
    <div class="rz rz-n"  data-dir="n"></div>
    <div class="rz rz-s"  data-dir="s"></div>
    <div class="rz rz-e"  data-dir="e"></div>
    <div class="rz rz-w"  data-dir="w"></div>
    <div class="rz rz-nw" data-dir="nw"></div>
    <div class="rz rz-ne" data-dir="ne"></div>
    <div class="rz rz-sw" data-dir="sw"></div>
    <div class="rz rz-se" data-dir="se"></div>
  `;
  return div;
}

async function createWindow(app) {
  const el = buildWindowMarkup(app);
  document.getElementById('desktop').appendChild(el);
  const win = new CRTWindow(app.windowId);
  wins.set(app.id, win);
  const bodyEl = el.querySelector('.app-body');
  try {
    await app.mount(bodyEl);
  } catch {
    bodyEl.textContent = `couldn't load ${app.title}. refresh and try again.`;
  }
  return win;
}

export function appForWindow(win) {
  return Object.values(APPS).find(a => a.windowId === win.id) ?? null;
}

export function goToAppPage(app, winEl = null) {
  try {
    const cs = getComputedStyle(document.documentElement);
    const theme = {};
    THEME_VARS.forEach(v => { theme[v] = cs.getPropertyValue(v).trim(); });
    if (theme['--color-primary'].toLowerCase() !== DEFAULT_PRIMARY) {
      sessionStorage.setItem('stray_theme', JSON.stringify(theme));
    } else {
      sessionStorage.removeItem('stray_theme');
    }
  } catch { /* storage unavailable */ }

  if (winEl) winEl.style.viewTransitionName = 'app-surface';
  try { sessionStorage.setItem('stray_ref', 'desktop'); } catch { /* ignore */ }
  location.href = app.pageUrl;
}

export async function openApp(appId) {
  const app = APPS[appId];
  if (!app) return false;

  if (window.matchMedia('(max-width: 700px)').matches) {
    goToAppPage(app);
    return;
  }

  let win = wins.get(appId);
  if (!win) {
    if (!pending.has(appId)) {
      pending.set(appId, createWindow(app).finally(() => pending.delete(appId)));
    }
    win = await pending.get(appId);
  }
  win.open();
  WindowManager.focus(win);
}

CRTWindow.onPageExpand = (win) => {
  const app = appForWindow(win);
  if (app) goToAppPage(app, win.el);
};
