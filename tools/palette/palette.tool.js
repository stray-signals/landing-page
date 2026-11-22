// Palette tool UI. mountPaletteTool(container, { mode }) -> { destroy }
import {
  MODES, CVD_TYPES, generatePalette, tints, simulate, inkFor, contrast, normalizeHex,
  hexToHsl, hslToHex, extractPalette, paletteToTheme, toHash, fromHash, formatHex, formatCss, formatJson,
} from './palette.color.js';
import { applySiteTheme, resetSiteTheme, getSavedPalettes } from './palette.theme.js';
import { buildPalette } from '/terminal/admin/commands/theme.js';

const STATE_KEY = 'stray_palette_state';
const SAVED_KEY = 'stray_palettes';
const CSS_HREF = '/tools/palette/palette.tool.css';
const MAX_SAVED = 30;
const CVD_LABELS = {
  none: 'normal vision', protanopia: 'protanopia', deuteranopia: 'deuteranopia',
  tritanopia: 'tritanopia', achromatopsia: 'achromatopsia',
};
const LOCK_SVG = {
  on: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  off: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 7V5a3 3 0 0 1 5.7-1.3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
};

function isHexArray(a) { return Array.isArray(a) && a.length >= 2 && a.length <= 10 && a.every(c => normalizeHex(c)); }

function freshState() {
  const colors = generatePalette({ count: 5, mode: 'analogous', locked: [] });
  return { colors, locked: colors.map(() => false), mode: 'analogous', count: 5, cvd: 'none' };
}

function loadState(mode) {
  let s = null;
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && isHexArray(p.colors)) {
        const colors = p.colors.map(normalizeHex);
        s = {
          colors,
          locked: colors.map((_, i) => !!(p.locked && p.locked[i])),
          mode: MODES.includes(p.mode) ? p.mode : 'analogous',
          count: colors.length,
          cvd: CVD_TYPES.includes(p.cvd) ? p.cvd : 'none',
        };
      }
    }
  } catch (e) { /* storage unavailable */ }
  if (!s) s = freshState();
  if (mode === 'page') {
    const fromUrl = fromHash(location.hash);
    if (fromUrl) {
      s.colors = fromUrl; s.locked = fromUrl.map(() => false); s.count = fromUrl.length;
    }
  }
  return s;
}

const readSaved = getSavedPalettes;
function writeSaved(list) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, MAX_SAVED))); } catch (e) { /* ignore */ }
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function h(tag, props = {}, kids = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style') e.style.cssText = v;
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of [].concat(kids)) if (c) e.appendChild(c);
  return e;
}

export function mountPaletteTool(container, { mode = 'window' } = {}) {
  if (!document.querySelector('link[href="' + CSS_HREF + '"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_HREF;
    document.head.appendChild(link);
  }

  const state = loadState(mode);
  const uid = 'pal' + Math.random().toString(36).slice(2, 7);
  let panel = null;       // 'saved' | 'contrast' | 'export' | null
  let popIndex = -1;      // index of bar with adjust popover, -1 = none
  let msgTimer = 0;

  const root = h('div', { class: 'palette-tool', tabindex: '-1' });
  root.dataset.mode = mode;
  root.innerHTML = `<div class="pal-layout">
    <div class="pal-main" data-role="main">
      <div class="pal-bars" data-role="bars"></div>
      <div class="pal-pop" data-role="pop" role="dialog" aria-label="adjust color" hidden></div>
      <div class="pal-drawer" data-role="drawer-saved" role="region" aria-label="saved palettes" hidden></div>
      <div class="pal-drawer" data-role="drawer-contrast" role="region" aria-label="contrast pairs" hidden></div>
      <div class="pal-drawer pal-menu" data-role="drawer-export" role="menu" aria-label="export" hidden></div>
    </div>
    <div class="pal-band" data-role="band">
      <button type="button" class="pal-btn pal-btn-fill" data-role="gen">generate</button>
      <label class="pal-field" for="${uid}-mode"><span class="pal-lbl">mode</span>
        <select class="pal-sel" id="${uid}-mode" data-role="mode"></select></label>
      <span class="pal-field" role="group" aria-label="color count"><span class="pal-lbl">count</span>
        <span class="pal-count">
          <button type="button" class="pal-btn pal-sq" data-role="minus" aria-label="fewer colors">−</button>
          <span class="pal-n" data-role="n" aria-live="polite"></span>
          <button type="button" class="pal-btn pal-sq" data-role="plus" aria-label="more colors">+</button>
        </span></span>
      <button type="button" class="pal-btn" data-role="photo">from photo</button>
      <input type="file" accept="image/*" data-role="file" aria-label="choose a photo to pull colors from" hidden>
      <label class="pal-field" for="${uid}-cvd"><span class="pal-lbl">color-blind</span>
        <select class="pal-sel" id="${uid}-cvd" data-role="cvd"></select></label>
      <span class="pal-tag" data-role="cvdtag" hidden></span>
      <button type="button" class="pal-btn" data-role="apply">apply to site</button>
      <button type="button" class="pal-btn" data-role="reset" hidden>reset site colors</button>
      <button type="button" class="pal-btn" data-role="t-saved" aria-expanded="false">saved ▴</button>
      <button type="button" class="pal-btn" data-role="t-contrast" aria-expanded="false">contrast ▴</button>
      <button type="button" class="pal-btn" data-role="t-export" aria-expanded="false" aria-haspopup="menu">export ▴</button>
      <span class="pal-msg" data-role="msg" role="status" aria-live="polite"></span>
    </div></div>`;
  container.appendChild(root);

  const $ = r => root.querySelector(`[data-role="${r}"]`);
  const el = {
    main: $('main'), bars: $('bars'), pop: $('pop'), gen: $('gen'), mode: $('mode'), n: $('n'),
    minus: $('minus'), plus: $('plus'), photo: $('photo'), file: $('file'), cvd: $('cvd'),
    cvdtag: $('cvdtag'), msg: $('msg'), apply: $('apply'), reset: $('reset'),
    toggles: { saved: $('t-saved'), contrast: $('t-contrast'), export: $('t-export') },
    drawers: { saved: $('drawer-saved'), contrast: $('drawer-contrast'), export: $('drawer-export') },
  };

  for (const m of MODES) el.mode.appendChild(h('option', { value: m, text: m }));
  for (const c of CVD_TYPES) el.cvd.appendChild(h('option', { value: c, text: CVD_LABELS[c] }));

  // ── state helpers ───────────────────────────────────────────────
  function saveState() {
    try { sessionStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    if (mode === 'page') {
      try { history.replaceState(null, '', '#' + toHash(state.colors)); } catch (e) { /* ignore */ }
    }
  }
  const view = hex => simulate(hex, state.cvd);

  function flash(text) {
    el.msg.textContent = text;
    el.msg.classList.add('on');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { el.msg.classList.remove('on'); }, 2000);
  }

  // ── bars ────────────────────────────────────────────────────────
  function renderBars(restoreLock = -1) {
    el.bars.textContent = '';
    el.bars.style.setProperty('--n', state.colors.length);
    state.colors.forEach((color, i) => {
      const shown = view(color);
      const ink = inkFor(shown);
      const col = h('div', { class: 'pal-col' });
      const bar = h('button', {
        type: 'button', class: 'pal-bar', style: `background:${shown};color:${ink}`,
        'aria-label': `adjust ${color}`, 'aria-haspopup': 'dialog',
        'aria-expanded': String(popIndex === i),
      }, [h('span', { class: 'pal-hex', text: color })]);
      bar.addEventListener('click', () => (popIndex === i ? closePop() : openPop(i, true)));
      const lock = h('button', {
        type: 'button', class: 'pal-lock', style: `color:${ink}`,
        'aria-pressed': String(!!state.locked[i]), 'aria-label': `lock ${color}`,
      });
      lock.innerHTML = state.locked[i] ? LOCK_SVG.on : LOCK_SVG.off;
      lock.addEventListener('click', () => {
        state.locked[i] = !state.locked[i];
        saveState();
        renderBars(i);
      });
      const tintRow = h('div', { class: 'pal-tints' });
      for (const t of tints(color)) {
        const b = h('button', {
          type: 'button', class: 'pal-tint', style: `background:${view(t)}`,
          'aria-label': `use tint ${t} for color ${i + 1}`, title: t,
        });
        b.addEventListener('click', () => { state.colors[i] = t; changed(); });
        tintRow.appendChild(b);
      }
      col.append(bar, lock, tintRow);
      el.bars.appendChild(col);
      if (restoreLock === i) lock.focus();
    });
  }

  // ── adjust popover ──────────────────────────────────────────────
  function closePop() {
    if (popIndex < 0) return;
    const i = popIndex;
    popIndex = -1;
    el.pop.hidden = true;
    el.pop.textContent = '';
    const bar = el.bars.children[i] && el.bars.children[i].querySelector('.pal-bar');
    if (bar) { bar.setAttribute('aria-expanded', 'false'); }
  }

  function placePop() {
    const col = el.bars.children[popIndex];
    if (!col) return;
    const mr = el.main.getBoundingClientRect(), cr = col.getBoundingClientRect();
    const pw = el.pop.offsetWidth || 240;
    const narrow = root.clientWidth < 560;
    let left = narrow ? (mr.width - pw) / 2 : cr.left - mr.left + cr.width / 2 - pw / 2;
    left = Math.max(6, Math.min(left, mr.width - pw - 6));
    let top = narrow ? cr.bottom - mr.top + 4 : 12;
    top = Math.max(6, Math.min(top, mr.height - el.pop.offsetHeight - 6));
    el.pop.style.left = left + 'px';
    el.pop.style.top = top + 'px';
  }

  function openPop(i, focus = false) {
    closePanel();
    closePop();
    popIndex = i;
    let [H, S, L] = hexToHsl(state.colors[i]);
    const pop = el.pop;
    pop.textContent = '';
    const sliders = {};
    const mk = (key, label, max, val) => {
      const id = `${uid}-${key}`;
      const input = h('input', { type: 'range', min: '0', max: String(max), step: '1', value: String(val), id, class: 'pal-range' });
      sliders[key] = input;
      return h('div', { class: 'pal-prow' }, [h('label', { for: id, class: 'pal-lbl', text: label }), input]);
    };
    const hexIn = h('input', { type: 'text', class: 'pal-input', id: `${uid}-hex`, value: state.colors[i], autocomplete: 'off', spellcheck: 'false', 'aria-label': 'hex value', maxlength: '9' });
    const useBtn = h('button', { type: 'button', class: 'pal-btn', text: 'use as site theme' });
    const rmBtn = h('button', { type: 'button', class: 'pal-btn', text: 'remove' });
    rmBtn.disabled = state.colors.length <= 2;
    const closeBtn = h('button', { type: 'button', class: 'pal-btn', text: 'close' });
    pop.append(
      mk('h', 'hue', 360, H), mk('s', 'saturation', 100, S), mk('l', 'lightness', 100, L),
      h('div', { class: 'pal-prow' }, [h('label', { for: `${uid}-hex`, class: 'pal-lbl', text: 'hex' }), hexIn]),
      h('div', { class: 'pal-pbtns' }, [useBtn, rmBtn, closeBtn]),
    );
    pop.hidden = false;
    const barBtn = el.bars.children[i].querySelector('.pal-bar');
    barBtn.setAttribute('aria-expanded', 'true');

    const apply = hex => { state.colors[i] = hex; saveState(); renderBars(); keepBarExpanded(); };
    const keepBarExpanded = () => {
      const b = el.bars.children[i] && el.bars.children[i].querySelector('.pal-bar');
      if (b) b.setAttribute('aria-expanded', 'true');
      refreshPanels();
    };
    const fromSliders = () => {
      H = +sliders.h.value; S = +sliders.s.value; L = +sliders.l.value;
      const hex = hslToHex(H, S, L);
      hexIn.value = hex;
      hexIn.classList.remove('bad');
      apply(hex);
    };
    for (const k of ['h', 's', 'l']) sliders[k].addEventListener('input', fromSliders);
    hexIn.addEventListener('input', () => {
      const hex = normalizeHex(hexIn.value);
      hexIn.classList.toggle('bad', !hex);
      if (!hex) return;
      [H, S, L] = hexToHsl(hex);
      sliders.h.value = H; sliders.s.value = S; sliders.l.value = L;
      apply(hex);
    });
    useBtn.addEventListener('click', () => {
      const hex = state.colors[i];
      applySiteTheme(buildPalette(hex));
      flash(`site theme set to ${hex}`);
    });
    rmBtn.addEventListener('click', () => {
      if (state.colors.length <= 2) return;
      state.colors.splice(i, 1); state.locked.splice(i, 1);
      state.count = state.colors.length;
      closePop();
      changed();
    });
    closeBtn.addEventListener('click', () => { closePop(); barBtn.focus(); });
    placePop();
    if (focus) sliders.h.focus();
  }

  // ── panels (saved / contrast / export) ──────────────────────────
  function closePanel() {
    if (!panel) return;
    el.drawers[panel].hidden = true;
    el.toggles[panel].setAttribute('aria-expanded', 'false');
    panel = null;
  }
  function togglePanel(name) {
    const was = panel;
    closePanel();
    if (was === name) return;
    closePop();
    panel = name;
    el.drawers[name].hidden = false;
    el.toggles[name].setAttribute('aria-expanded', 'true');
    refreshPanels();
    const first = el.drawers[name].querySelector('button, textarea');
    if (name === 'export' && first) first.focus();
  }
  function refreshPanels() {
    if (panel === 'saved') renderSaved();
    else if (panel === 'contrast') renderContrast();
    else if (panel === 'export') renderExport();
  }

  function renderSaved() {
    const d = el.drawers.saved;
    d.textContent = '';
    const save = h('button', { type: 'button', class: 'pal-btn pal-btn-fill', text: 'save this palette' });
    save.addEventListener('click', () => {
      const list = readSaved();
      list.unshift({ colors: state.colors.slice(), savedAt: Date.now() });
      writeSaved(list);
      flash('palette saved');
      renderSaved();
    });
    d.appendChild(save);
    const list = readSaved();
    if (!list.length) { d.appendChild(h('div', { class: 'pal-empty', text: 'nothing saved yet.' })); return; }
    const ul = h('ul', { class: 'pal-saved' });
    list.forEach((p, idx) => {
      const strip = h('button', { type: 'button', class: 'pal-strip', 'aria-label': `load palette ${p.colors.join(' ')}` },
        p.colors.map(c => h('span', { style: `background:${c}` })));
      strip.addEventListener('click', () => {
        state.colors = p.colors.slice(); state.locked = p.colors.map(() => false); state.count = p.colors.length;
        changed(); closePanel();
      });
      const del = h('button', { type: 'button', class: 'pal-btn pal-sq', text: '×', 'aria-label': `delete saved palette ${p.colors.join(' ')}` });
      del.addEventListener('click', () => {
        const cur = readSaved(); cur.splice(idx, 1); writeSaved(cur); renderSaved();
      });
      const ap = h('button', { type: 'button', class: 'pal-btn', text: 'apply', 'aria-label': `apply palette ${p.colors.join(' ')} to site` });
      ap.addEventListener('click', () => {
        const t = paletteToTheme(p.colors);
        applySiteTheme(t.vars);
        el.reset.hidden = false;
        flash(t.notes.length ? `site recolored. ${t.notes[0]}` : 'site recolored');
      });
      ul.appendChild(h('li', {}, [strip, ap, del]));
    });
    d.appendChild(ul);
  }

  function grade(r) { return r >= 7 ? 'aaa' : r >= 4.5 ? 'aa' : r >= 3 ? 'big' : 'no'; }
  const GRADE_TEXT = { aaa: 'passes for any text', aa: 'passes for body text', big: 'large text only', no: 'fails' };

  function renderContrast() {
    const d = el.drawers.contrast;
    d.textContent = '';
    const n = state.colors.length;
    const grid = h('div', { class: 'pal-cgrid', role: 'table', 'aria-label': 'contrast of text color (rows) on background color (columns)' });
    grid.style.gridTemplateColumns = `34px repeat(${n}, minmax(0, 1fr))`;
    grid.appendChild(h('div', { class: 'pal-corner', text: 'text \\ bg', 'aria-hidden': 'true' }));
    state.colors.forEach(c => grid.appendChild(h('div', { class: 'pal-chd', style: `background:${c}`, title: c, 'aria-hidden': 'true' })));
    state.colors.forEach((fg, r) => {
      grid.appendChild(h('div', { class: 'pal-chd pal-rhd', style: `background:${fg}`, title: fg, 'aria-hidden': 'true' }));
      state.colors.forEach((bg, c) => {
        if (r === c) { grid.appendChild(h('div', { class: 'pal-cell same', 'aria-label': `${fg} on itself` })); return; }
        const ratio = contrast(fg, bg);
        const g = grade(ratio);
        grid.appendChild(h('div', {
          class: `pal-cell ${g}`, style: `background:${bg};color:${fg}`,
          'aria-label': `${fg} on ${bg}: ${ratio.toFixed(1)} to 1, ${GRADE_TEXT[g]}`,
        }, [h('span', { class: 'pal-aa', text: 'Aa' }), h('small', { text: ratio.toFixed(1) })]));
      });
    });
    d.appendChild(grid);
    d.appendChild(h('div', { class: 'pal-legend' }, [
      h('span', {}, [h('i', { class: 'aaa' }), document.createTextNode('7+ any text')]),
      h('span', {}, [h('i', { class: 'aa' }), document.createTextNode('4.5+ body')]),
      h('span', {}, [h('i', { class: 'big' }), document.createTextNode('3+ large only')]),
      h('span', {}, [h('i', { class: 'no' }), document.createTextNode('fails')]),
    ]));
  }

  // clipboard with fallback
  function copyText(text, label) {
    const fallback = () => {
      const d = el.drawers.export;
      d.textContent = '';
      const ta = h('textarea', { class: 'pal-fallback', readonly: true, 'aria-label': `${label}, press ctrl+c to copy`, rows: '6' });
      ta.value = text;
      const done = h('button', { type: 'button', class: 'pal-btn', text: 'done' });
      done.addEventListener('click', () => { renderExport(); });
      d.append(h('div', { class: 'pal-lbl', text: 'press ctrl+c to copy' }), ta, done);
      ta.focus(); ta.select();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => flash(`copied ${label}`), fallback);
    } else fallback();
  }

  function downloadPng() {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 400;
    const ctx = c.getContext('2d');
    const n = state.colors.length, w = c.width / n;
    ctx.font = 'bold 26px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    state.colors.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.floor(i * w), 0, Math.ceil(w), c.height);
      ctx.fillStyle = inkFor(col);
      ctx.fillText(col, i * w + w / 2, c.height - 24, w - 8);
    });
    c.toBlob(b => {
      if (!b) return;
      download(b, `palette-${state.colors[0].slice(1)}.png`);
      flash('png downloaded');
    }, 'image/png');
  }

  function renderExport() {
    const d = el.drawers.export;
    d.textContent = '';
    const items = [
      ['copy hex', () => copyText(formatHex(state.colors), 'hex')],
      ['copy css variables', () => copyText(formatCss(state.colors), 'css variables')],
      ['copy json', () => copyText(formatJson(state.colors), 'json')],
      ['download png', () => { downloadPng(); closePanel(); }],
      ['copy share link', () => copyText(location.origin + '/tools/palette/#' + toHash(state.colors), 'share link')],
    ];
    for (const [label, fn] of items) {
      const b = h('button', { type: 'button', class: 'pal-item', role: 'menuitem', text: label });
      b.addEventListener('click', fn);
      d.appendChild(b);
    }
  }

  // ── actions ─────────────────────────────────────────────────────
  function syncControls() {
    el.mode.value = state.mode;
    el.cvd.value = state.cvd;
    el.n.textContent = state.colors.length;
    el.minus.disabled = state.colors.length <= 2;
    el.plus.disabled = state.colors.length >= 10;
    el.cvdtag.hidden = state.cvd === 'none';
    el.cvdtag.textContent = state.cvd === 'none' ? '' : `simulating ${state.cvd}`;
  }

  function changed() {
    state.count = state.colors.length;
    saveState();
    syncControls();
    renderBars();
    if (popIndex >= 0) {
      if (popIndex >= state.colors.length) closePop(); else openPopKeepFocus();
    }
    refreshPanels();
  }
  function openPopKeepFocus() {
    const i = popIndex;
    popIndex = -1;
    openPop(i);
  }

  function generate() {
    const locked = state.colors.map((c, i) => (state.locked[i] ? c : null));
    state.colors = generatePalette({ count: state.colors.length, mode: state.mode, locked });
    changed();
  }

  el.gen.addEventListener('click', generate);
  el.apply.addEventListener('click', () => {
    const t = paletteToTheme(state.colors);
    applySiteTheme(t.vars);
    el.reset.hidden = false;
    flash(t.notes.length ? `site recolored. ${t.notes[0]}` : 'site recolored');
  });
  el.reset.addEventListener('click', () => {
    resetSiteTheme();
    el.reset.hidden = true;
    flash('site colors reset');
  });
  el.mode.addEventListener('change', () => { state.mode = el.mode.value; generate(); });
  el.cvd.addEventListener('change', () => { state.cvd = el.cvd.value; changed(); });
  el.plus.addEventListener('click', () => {
    if (state.colors.length >= 10) return;
    const n = state.colors.length + 1;
    const all = generatePalette({ count: n, mode: state.mode, locked: state.colors });
    state.colors.push(all[n - 1]); state.locked.push(false);
    changed();
  });
  el.minus.addEventListener('click', () => {
    if (state.colors.length <= 2) return;
    let idx = state.locked.lastIndexOf(false);
    if (idx < 0) idx = state.colors.length - 1;
    state.colors.splice(idx, 1); state.locked.splice(idx, 1);
    changed();
  });

  el.photo.addEventListener('click', () => el.file.click());
  el.file.addEventListener('change', () => {
    const file = el.file.files && el.file.files[0];
    el.file.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const big = Math.max(img.naturalWidth, img.naturalHeight) || 1;
      const k = Math.min(1, 160 / big);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const colors = extractPalette(ctx.getImageData(0, 0, c.width, c.height), state.colors.length);
      if (colors.length < 2) { flash("couldn't find colors in that image"); return; }
      state.colors = colors; state.locked = colors.map(() => false);
      changed();
      flash('colors pulled from photo');
    };
    img.onerror = () => { URL.revokeObjectURL(url); flash("couldn't read that image"); };
    img.src = url;
  });

  for (const name of Object.keys(el.toggles)) el.toggles[name].addEventListener('click', () => togglePanel(name));

  // ── keyboard / outside clicks ───────────────────────────────────
  function onKey(e) {
    if (e.key === 'Escape') {
      if (popIndex >= 0) {
        const i = popIndex; closePop();
        const b = el.bars.children[i] && el.bars.children[i].querySelector('.pal-bar');
        if (b) b.focus();
        e.stopPropagation();
      } else if (panel) {
        const t = el.toggles[panel]; closePanel(); t.focus(); e.stopPropagation();
      }
      return;
    }
    if (e.key === ' ' || e.code === 'Space') {
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, button, [contenteditable]')) return;
      e.preventDefault();
      generate();
    }
  }
  const keyTarget = mode === 'page' ? document : root;
  keyTarget.addEventListener('keydown', onKey);
  // Esc should also work inside the tool in page mode (document covers it) and window mode (root covers it).

  const onPointerDown = e => {
    if (!root.contains(e.target)) return;
    if (!e.target.closest('input, textarea, select')) root.focus({ preventScroll: true });
  };
  root.addEventListener('pointerdown', onPointerDown);

  const onDocDown = e => {
    if (!root.contains(e.target)) return;
    const t = e.target;
    if (popIndex >= 0 && !t.closest('.pal-pop, .pal-bar, .pal-tint, .pal-lock')) closePop();
    if (panel && !t.closest('.pal-drawer, .pal-band .pal-btn')) closePanel();
  };
  document.addEventListener('pointerdown', onDocDown);

  const onResize = () => { if (popIndex >= 0) placePop(); };
  let ro = null;
  if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(root); }

  syncControls();
  saveState();
  renderBars();

  return {
    destroy() {
      clearTimeout(msgTimer);
      keyTarget.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDocDown);
      if (ro) ro.disconnect();
      root.remove();
    },
  };
}
