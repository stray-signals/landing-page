// Arcade: a terminal-style game picker. mountArcade(container, { mode }) -> { destroy }
const CSS_HREF = '/tools/arcade/arcade.tool.css';
const HI_KEY = 'stray_arcade_hi';
const WIN_ID = 'win-arcade';
const THEME_VARS = {
  primary: '--color-primary', primaryDim: '--color-primary-dim', bg: '--color-bg', border: '--color-border',
  accent: '--color-accent', accentHi: '--color-accent-hi', textBlue: '--color-text-blue',
};

export const GAMES = [
  { id: 'larmor', title: 'larmor', load: () => import('./games/larmor/larmor.game.js') },
];
const PLACEHOLDERS = 2;
const FIREBASE_URL = '/scripts/firebase-chat.js';

// Firebase is loaded on demand; if it is blocked or offline these reject and callers carry on.
const backend = () => import(FIREBASE_URL);
const scoreApi = id => ({
  fetchTop: n => backend().then(m => m.fetchTopScores(id, n)),
  submit: (initials, score) => backend().then(m => m.submitScore(id, initials, score)),
});

function readHi() {
  try {
    const o = JSON.parse(localStorage.getItem(HI_KEY) || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch (e) { return {}; }
}
function saveHi(id, score) {
  try {
    const o = readHi();
    if (!(score > (o[id] | 0))) return;
    o[id] = score | 0;
    localStorage.setItem(HI_KEY, JSON.stringify(o));
  } catch (e) { /* storage unavailable */ }
}
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const out = {};
  for (const [k, v] of Object.entries(THEME_VARS)) out[k] = cs.getPropertyValue(v).trim();
  return out;
}

export function mountArcade(container, { mode = 'window' } = {}) {
  if (!document.querySelector('link[href="' + CSS_HREF + '"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_HREF;
    document.head.appendChild(link);
  }

  const root = document.createElement('div');
  root.className = 'arcade-tool';
  root.tabIndex = -1;
  container.appendChild(root);

  let view = 'picker';
  let sel = 0;
  let game = null;
  let gen = 0;
  let destroyed = false;
  let colors = readColors();
  const top = {};            // shared #1 per game id: { initials, score }

  const keyTarget = mode === 'page' ? document : root;

  function focusRoot() { try { root.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }

  // ── game lifecycle ────────────────────────────────────────────────
  function destroyGame() {
    gen++;
    if (game) { try { game.destroy(); } catch (e) { /* ignore */ } game = null; }
  }

  async function launch(canvas, gameMode) {
    const token = ++gen;
    const def = GAMES[sel];
    let mod;
    try { mod = await def.load(); } catch (e) { return; }
    if (destroyed || token !== gen) return;
    const g = mod.createGame(canvas, {
      mode: gameMode,
      colors,
      hiScore: readHi()[def.id] | 0,
      onScore: score => saveHi(def.id, score),
      onExit: () => { showPicker(); refreshTop(); },
      keyTarget,
      scores: scoreApi(def.id),
    });
    game = g;
    g.start();
  }

  function hiLabel(g, hi) {
    const t = top[g.id];
    if (t && t.initials) return String(t.score | 0).padStart(5, '0') + ' ' + t.initials;
    return String(hi[g.id] | 0).padStart(5, '0');
  }

  function refreshTop() {
    GAMES.forEach(g => {
      scoreApi(g.id).fetchTop(1).then(rows => {
        if (destroyed || !rows || !rows[0] || !rows[0].initials) return;
        top[g.id] = rows[0];
        const cell = root.querySelector('li[data-i="' + GAMES.indexOf(g) + '"] .ar-hi');
        if (cell) cell.textContent = hiLabel(g, readHi());
      }).catch(() => { /* offline: keep the local best */ });
    });
  }

  // ── picker ────────────────────────────────────────────────────────
  function showPicker() {
    destroyGame();
    view = 'picker';
    const hi = readHi();
    const rows = GAMES.map((g, i) => {
      const on = i === sel;
      return `<li class="${on ? 'on' : ''}" data-i="${i}"><span>${on ? '&gt; ' : '&nbsp; '}${g.title}</span>` +
        `<span class="ar-hi">${hiLabel(g, hi)}</span></li>`;
    }).join('') + '<li class="off">----------</li>'.repeat(PLACEHOLDERS);
    root.innerHTML =
      '<div class="ar-term">' +
        '<div class="ar-lines"><div>stray@machine:~$ run arcade</div><div class="ar-dim">cartridges found: ' + GAMES.length + ' · more being built</div></div>' +
        '<div class="ar-body"><ul class="ar-list">' + rows + '</ul><div class="ar-prev"><canvas></canvas></div></div>' +
        '<div class="ar-hint">↑↓ choose · enter play <span class="ar-cur">▌</span></div>' +
      '</div>';
    focusRoot();
    launch(root.querySelector('.ar-prev canvas'), 'attract');
  }

  function showPlay() {
    destroyGame();
    view = 'play';
    root.innerHTML = '<div class="ar-play"><canvas></canvas></div>';
    focusRoot();
    launch(root.querySelector('canvas'), 'play');
  }

  function move(delta) {
    const n = GAMES.length;
    const next = (sel + delta + n) % n;
    if (next === sel) return;
    sel = next;
    showPicker();
  }

  // ── input ─────────────────────────────────────────────────────────
  function onKey(e) {
    if (view !== 'picker' || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); move(-1); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); move(1); }
    else if ((k === 'Enter' || k === ' ') && !e.repeat) { e.preventDefault(); showPlay(); }
  }
  keyTarget.addEventListener('keydown', onKey);

  function onClick(e) {
    if (view !== 'picker') return;
    const li = e.target.closest && e.target.closest('li[data-i]');
    if (!li || !root.contains(li)) return;
    sel = +li.dataset.i;
    showPlay();
  }
  root.addEventListener('click', onClick);
  const onPointerDown = () => focusRoot();
  root.addEventListener('pointerdown', onPointerDown);

  // ── lifecycle hooks ───────────────────────────────────────────────
  function refreshColors() {
    colors = readColors();
    if (game) game.setColors(colors);
  }
  const onWinPause = e => { if (e.detail && e.detail.id === WIN_ID && game) game.pause(); };
  const onWinBack = e => {
    if (!e.detail || e.detail.id !== WIN_ID) return;
    refreshColors();
    if (view === 'picker' && game) game.resume();
    focusRoot();
  };
  const onVisibility = () => {
    if (document.hidden) { if (game) game.pause(); }
    else if (view === 'picker' && game) game.resume();
  };
  const onFocus = () => refreshColors();

  document.addEventListener('window:minimize', onWinPause);
  document.addEventListener('window:close', onWinPause);
  document.addEventListener('window:restore', onWinBack);
  document.addEventListener('window:open', onWinBack);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onFocus);

  showPicker();
  refreshTop();

  return {
    destroy() {
      destroyed = true;
      destroyGame();
      keyTarget.removeEventListener('keydown', onKey);
      root.removeEventListener('click', onClick);
      root.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('window:minimize', onWinPause);
      document.removeEventListener('window:close', onWinPause);
      document.removeEventListener('window:restore', onWinBack);
      document.removeEventListener('window:open', onWinBack);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      root.remove();
    },
  };
}
