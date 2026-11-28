// Pixel art editor UI. mountPixelTool(container, { mode }) -> { destroy }
import { ensureCss, download } from '/shared/dom.js';
import {
  SIZES, MAX_FRAMES, MAX_COLORS, HALF, createDoc, setPixel, line, rect, floodFill,
  createHistory, snapshotOf, addFrame, duplicateFrame, deleteFrame, moveFrame, resizeDoc,
  frameToRGBA, toSpritesheetRGBA, encodeDoc, decodeDoc, toCode, toGif, hexToRgb,
} from '/tools/pixel/pixel.core.js';
import { parseCode, gifFrames } from '/tools/pixel/pixel.convert.js';
import { GifReader } from '/tools/vendor/omggif.js';
import { createConvertPanel, cleanConvertSettings } from '/tools/pixel/pixel.convert.panel.js';
import { getSavedPalettes } from '/tools/palette/palette.theme.js';

const STATE_KEY = 'stray_pixel_state';
const CSS_HREF = '/tools/pixel/pixel.tool.css';
const TOOLS = ['pencil', 'eraser', 'line', 'box', 'fill'];
const TOOL_KEYS = { b: 'pencil', e: 'eraser', l: 'line', r: 'box', g: 'fill' };
const SCALES = [1, 8, 16];
const MAX_IMPORT_EDGE = 1024;

const ICONS = {
  pencil: '<path d="M3 13l1-3.5L11 2.5l2.5 2.5-7 7L3 13z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
  eraser: '<path d="M3 10l5-6 5 4-4 5H5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6 14h8" stroke="currentColor" stroke-width="1.4"/>',
  line: '<path d="M3 13L13 3" stroke="currentColor" stroke-width="1.8"/>',
  box: '<rect x="3" y="4" width="10" height="8" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  boxfill: '<rect x="3" y="4" width="10" height="8" fill="currentColor"/>',
  fill: '<path d="M3 9l5-5 5 5-4 4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M13.5 10.5c1 1.4 1 2.3 0 2.8-1 .2-1.4-1-0-2.8z" fill="currentColor"/>',
  mirror: '<path d="M8 2v12" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"/><path d="M6 4L2 8l4 4zM10 4l4 4-4 4z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  half: '<rect x="3" y="3" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3 3h5v10H3z" fill="currentColor"/>',
  dup: '<rect x="2" y="5" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="6" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  del: '<path d="M3 4h10M6 4V2.5h4V4M4.5 4l.8 9.5h5.4l.8-9.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
  clear: '<rect x="2.5" y="2.5" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4.5 11.5l7-7" stroke="currentColor" stroke-width="1.4"/>',
  selall: '<rect x="2.5" y="2.5" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"/>',
  left: '<path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  right: '<path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  onion: '<rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".5"/><rect x="6" y="6" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  undo: '<path d="M6 4L3 7l3 3M3 7h6a4 4 0 0 1 0 8H7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" transform="translate(0 -2)"/>',
  redo: '<path d="M10 4l3 3-3 3M13 7H7a4 4 0 0 0 0 8h2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" transform="translate(0 -2)"/>',
};
const icon = name => `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${ICONS[name]}</svg>`;

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

function readSession() {
  try {
    const p = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null');
    return p && typeof p === 'object' && typeof p.d === 'string' ? p : null;
  } catch (e) { return null; }
}

export function mountPixelTool(container, { mode = 'window' } = {}) {
  ensureCss(CSS_HREF);

  const state = {
    doc: createDoc(32), frameIdx: 0, tool: 'pencil', colorIdx: 0, half: false, mirror: false,
    filled: false, onion: true, fps: 6, playing: true, zoom: 8, cv: null,
  };
  const history = createHistory(100);
  let touched = false;        // user changed the doc, so a late async load must not replace it
  let msgTimer = 0, saveTimer = 0, hashTimer = 0, playTimer = 0, playIdx = 0;
  let menu = null;            // 'export' | 'import' | 'palettes' | null
  let preview = null;         // convert preview values drawn in place of the current frame
  let previewPal = null;      // palette to draw the convert preview with (image colors)
  let convPanel = null;       // created on first use
  let pendingSize = 0;        // size awaiting confirmation
  let bigPlay = false;        // animation playing full size on the main canvas
  let sel = new Set();        // extra selected frames (shift/ctrl-click); the current frame is always selected
  let destroyed = false;
  let stroke = null;          // active pointer stroke
  let colorEditSnap = false;  // snapshot already taken for the current color-input edit

  const root = h('div', { class: 'pixel-tool app-surface', tabindex: '-1' });
  root.dataset.mode = mode;
  root.innerHTML = `<div class="px-layout">
    <div class="px-strip">
      <div class="px-frames" data-role="frames" role="group" aria-label="frames"></div>
      <div class="px-fbar" role="toolbar" aria-label="frame actions">
        <button type="button" class="px-tool" data-role="dup">${icon('dup')}</button>
        <button type="button" class="px-tool" data-role="del">${icon('del')}</button>
        <button type="button" class="px-tool" data-role="clear">${icon('clear')}</button>
        <button type="button" class="px-tool" data-role="selall" aria-pressed="false" aria-label="select all frames" title="select all frames (shift-click a range, ctrl-click to add)">${icon('selall')}</button>
        <button type="button" class="px-tool" data-role="left" aria-label="move frame left" title="move frame left">${icon('left')}</button>
        <button type="button" class="px-tool" data-role="right" aria-label="move frame right" title="move frame right">${icon('right')}</button>
        <button type="button" class="px-tool" data-role="onion" aria-pressed="true" aria-label="onion skin" title="onion skin: show the previous frame faintly while you draw">${icon('onion')}</button>
      </div>
      <div class="px-play">
        <canvas class="px-playcv" data-role="play" aria-label="play animation full size" role="button" tabindex="0" title="play full size"></canvas>
        <div class="px-playctl">
          <button type="button" class="px-btn px-sq" data-role="playbtn" aria-pressed="true" aria-label="play animation" title="play / pause (space)">⏸</button>
          <label class="px-fps"><span class="px-lbl">fps</span>
            <input type="range" min="2" max="12" step="1" data-role="fps" aria-label="frames per second"><output data-role="fpsout"></output></label>
        </div>
      </div>
    </div>
    <div class="px-tools" data-role="tools" role="toolbar" aria-label="drawing tools"></div>
    <div class="px-stage" data-role="stage"><canvas class="px-canvas" data-role="canvas" role="img"></canvas></div>
    <div class="px-side" data-role="side">
      <section class="px-sec" aria-label="colors">
        <div class="px-cur"><div class="px-big" data-role="big"></div>
          <div class="px-curinfo"><span data-role="hex" class="px-hex"></span>
            <input type="color" data-role="colorin" aria-label="edit selected color"></div></div>
        <div class="px-swatches" data-role="swatches" role="group" aria-label="palette"></div>
        <div class="px-row">
          <button type="button" class="px-btn" data-role="loadpal" aria-expanded="false" aria-haspopup="menu">load palette ▾</button>
          <button type="button" class="px-btn" data-role="prune" title="remove colors no frame uses">remove unused</button>
        </div>
        <div class="px-list" data-role="pallist" role="menu" aria-label="saved palettes" hidden></div>
      </section>
    </div>
    <div class="px-bar" data-role="bar">
      <div class="px-row px-sizewrap">
        <div class="px-row" data-role="sizes" role="group" aria-label="canvas size"></div>
        <div class="px-confirm" data-role="confirm" role="alertdialog" aria-label="confirm resize" hidden>
          <span data-role="confirmtext"></span>
          <button type="button" class="px-btn px-btn-fill" data-role="yes">resize</button>
          <button type="button" class="px-btn" data-role="no">cancel</button>
        </div>
      </div>
      <span class="px-msg" data-role="msg" role="status" aria-live="polite"></span>
      <div class="px-row px-exportwrap">
        <div class="px-menu" data-role="exportmenu" role="menu" aria-label="export" hidden></div>
        <div class="px-menu" data-role="importmenu" role="menu" aria-label="import" hidden></div>
        <button type="button" class="px-btn" data-role="reduce" title="reduce the selected frames to fewer colors">reduce colors</button>
        <button type="button" class="px-btn" data-role="importbtn" aria-expanded="false" aria-haspopup="menu">import ▾</button>
        <button type="button" class="px-btn" data-role="exportbtn" aria-expanded="false" aria-haspopup="menu">export ▴</button>
      </div>
    </div>
  </div>`;
  container.appendChild(root);

  const $ = r => root.querySelector(`[data-role="${r}"]`);
  const el = {
    frames: $('frames'), play: $('play'), playbtn: $('playbtn'), fps: $('fps'), fpsout: $('fpsout'),
    tools: $('tools'), stage: $('stage'), canvas: $('canvas'), big: $('big'), hex: $('hex'), colorin: $('colorin'),
    swatches: $('swatches'), loadpal: $('loadpal'), pallist: $('pallist'),
    dup: $('dup'), del: $('del'), selall: $('selall'), prune: $('prune'), left: $('left'), right: $('right'), onion: $('onion'), clear: $('clear'),
    sizes: $('sizes'), confirm: $('confirm'), confirmtext: $('confirmtext'), yes: $('yes'), no: $('no'),
    exportmenu: $('exportmenu'), exportbtn: $('exportbtn'), msg: $('msg'),
    importmenu: $('importmenu'), importbtn: $('importbtn'), reduce: $('reduce'), side: $('side'),
  };
  const ctx = el.canvas.getContext('2d');
  const playCtx = el.play.getContext('2d');
  const scratch = document.createElement('canvas');
  const sctx = scratch.getContext('2d');

  // ── helpers ─────────────────────────────────────────────────────
  const cur = () => state.doc.frames[state.frameIdx];
  const valueNow = () => (state.colorIdx + 1) | (state.half ? HALF : 0);
  const toolValue = () => (state.tool === 'eraser' ? 0 : valueNow());

  function flash(text) {
    el.msg.textContent = text;
    el.msg.classList.add('on');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { el.msg.classList.remove('on'); }, 2200);
  }

  function putRGBA(canvas, c, rgba, w, h) {
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    c.putImageData(new ImageData(rgba, w, h), 0, 0);
  }

  // ── persistence ─────────────────────────────────────────────────
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 200);
    if (mode === 'page') {
      clearTimeout(hashTimer);
      hashTimer = setTimeout(async () => {
        try {
          const enc = await encodeDoc(state.doc);
          if (!destroyed && enc.length <= 2000000) history_replace(enc);
        } catch (e) { /* ignore */ }
      }, 500);
    }
  }
  function history_replace(enc) {
    try { window.history.replaceState(null, '', '#' + enc); } catch (e) { /* ignore */ }
  }
  async function saveNow() {
    try {
      const d = await encodeDoc(state.doc);
      sessionStorage.setItem(STATE_KEY, JSON.stringify({
        d, fi: state.frameIdx, tool: state.tool, ci: state.colorIdx, half: state.half,
        mirror: state.mirror, filled: state.filled, onion: state.onion, fps: state.fps, cv: state.cv,
      }));
    } catch (e) { /* ignore */ }
  }

  async function loadInitial() {
    let doc = null, sess = readSession();
    if (mode === 'page' && location.hash.length > 1) doc = await decodeDoc(location.hash.slice(1));
    if (!doc && sess) doc = await decodeDoc(sess.d);
    if (!doc || touched || destroyed) return;
    state.doc = doc;
    if (sess) {
      if (TOOLS.includes(sess.tool)) state.tool = sess.tool;
      if (Number.isInteger(sess.fi) && sess.fi >= 0 && sess.fi < doc.frames.length) state.frameIdx = sess.fi;
      if (Number.isInteger(sess.ci) && sess.ci >= 0 && sess.ci < doc.palette.length) state.colorIdx = sess.ci;
      state.half = !!sess.half; state.mirror = !!sess.mirror; state.filled = !!sess.filled;
      if (typeof sess.onion === 'boolean') state.onion = sess.onion;
      if (Number.isInteger(sess.fps) && sess.fps >= 2 && sess.fps <= 12) state.fps = sess.fps;
      if (sess.cv && !convPanel) state.cv = cleanConvertSettings(sess.cv);
    }
    fitZoom();
    refreshAll();
  }

  // ── doc mutation ────────────────────────────────────────────────
  function snapshot() { history.push(snapshotOf(state.doc)); touched = true; }
  function changed() { refreshAll(); scheduleSave(); }

  function applySnapshot(s) {
    if (!s) return;
    state.doc.w = s.w; state.doc.h = s.h; state.doc.palette = s.palette; state.doc.frames = s.frames;
    state.frameIdx = Math.min(state.frameIdx, s.frames.length - 1);
    sel.clear();
    state.colorIdx = Math.min(state.colorIdx, s.palette.length - 1);
    pendingSize = 0;
    fitZoom();
    changed();
  }
  function undo() { if (convPanel && convPanel.isOpen) convPanel.close(); if (history.canUndo) { touched = true; applySnapshot(history.undo(snapshotOf(state.doc))); } }
  function redo() { if (convPanel && convPanel.isOpen) convPanel.close(); if (history.canRedo) { touched = true; applySnapshot(history.redo(snapshotOf(state.doc))); } }

  // ── tools column ────────────────────────────────────────────────
  const toolDefs = [
    { id: 'pencil', icon: 'pencil', label: 'pencil', key: 'B' },
    { id: 'eraser', icon: 'eraser', label: 'eraser', key: 'E' },
    { id: 'line', icon: 'line', label: 'line', key: 'L' },
    { id: 'box', icon: 'box', label: 'box', key: 'R' },
    { id: 'filled', icon: 'boxfill', label: 'filled box', key: 'shift+R', toggle: true },
    { id: 'fill', icon: 'fill', label: 'fill', key: 'G' },
    { sep: true },
    { id: 'mirror', icon: 'mirror', label: 'mirror', key: 'M', toggle: true },
    { id: 'half', icon: 'half', label: 'half-tone (50% alpha)', key: 'H', toggle: true },
    { sep: true },
    { id: 'undo', icon: 'undo', label: 'undo', key: 'ctrl+Z', action: true },
    { id: 'redo', icon: 'redo', label: 'redo', key: 'ctrl+shift+Z / ctrl+Y', action: true },
  ];
  const toolBtns = {};
  for (const d of toolDefs) {
    if (d.sep) { el.tools.appendChild(h('span', { class: 'px-sep', 'aria-hidden': 'true' })); continue; }
    const b = h('button', { type: 'button', class: 'px-tool', 'aria-label': d.label, title: `${d.label} (${d.key})` });
    if (!d.action) b.setAttribute('aria-pressed', 'false');
    b.innerHTML = icon(d.icon);
    b.addEventListener('click', () => toolAction(d.id));
    toolBtns[d.id] = b;
    el.tools.appendChild(b);
  }
  function toolAction(id) {
    if (TOOLS.includes(id)) state.tool = id;
    else if (id === 'filled') { state.filled = !state.filled; if (state.filled) state.tool = 'box'; }
    else if (id === 'mirror') state.mirror = !state.mirror;
    else if (id === 'half') state.half = !state.half;
    else if (id === 'undo') return undo();
    else if (id === 'redo') return redo();
    syncControls(); renderCanvas(); scheduleSave();
  }

  // ── rendering ───────────────────────────────────────────────────
  function syncControls() {
    for (const t of TOOLS) toolBtns[t].setAttribute('aria-pressed', String(state.tool === t));
    toolBtns.filled.setAttribute('aria-pressed', String(state.filled));
    toolBtns.mirror.setAttribute('aria-pressed', String(state.mirror));
    toolBtns.half.setAttribute('aria-pressed', String(state.half));
    toolBtns.undo.disabled = !history.canUndo;
    toolBtns.redo.disabled = !history.canRedo;
    el.onion.setAttribute('aria-pressed', String(state.onion));
    el.onion.disabled = state.frameIdx === 0;
    el.playbtn.setAttribute('aria-pressed', String(state.playing));
    el.playbtn.textContent = state.playing ? '⏸' : '▶';
    el.playbtn.setAttribute('aria-label', state.playing ? 'pause animation' : 'play animation');
    el.fps.value = String(state.fps);
    el.fpsout.textContent = String(state.fps);
    const n = state.doc.frames.length;
    for (const i of [...sel]) if (i >= n || i === state.frameIdx) sel.delete(i);
    const ns = sel.size + 1, multiSel = ns > 1;
    el.dup.disabled = n + ns > MAX_FRAMES;
    el.del.disabled = n <= 1 && state.doc.frames[0].every(v => !v);
    const tip = (b, t) => { b.title = t; b.setAttribute('aria-label', t); };
    tip(el.dup, multiSel ? `duplicate ${ns} frames` : 'duplicate frame');
    tip(el.del, ns >= n && n > 1 ? 'delete all frames' : multiSel ? `delete ${ns} frames` : 'delete frame');
    tip(el.clear, multiSel ? `clear ${ns} frames` : 'clear frame');
    root.style.setProperty('--px-nsel', `"${multiSel ? ns : ''}"`);
    el.selall.setAttribute('aria-pressed', String(n > 1 && ns >= n));
    el.selall.disabled = n <= 1;
    el.left.disabled = multiSel || state.frameIdx <= 0;
    el.right.disabled = multiSel || state.frameIdx >= n - 1;
  }

  function renderCanvas() {
    const { w, h: ht } = state.doc;
    const z = state.zoom;
    const cw = w * z, ch = ht * z;
    if (el.canvas.width !== cw || el.canvas.height !== ch) { el.canvas.width = cw; el.canvas.height = ch; }
    el.canvas.style.width = cw + 'px';
    el.canvas.style.height = ch + 'px';
    el.canvas.style.setProperty('--z', z + 'px');
    el.canvas.setAttribute('aria-label', `pixel canvas, frame ${state.frameIdx + 1} of ${state.doc.frames.length}`);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cw, ch);
    scratch.width = w; scratch.height = ht;
    if (bigPlay) {
      const i = state.playing ? playIdx % state.doc.frames.length : state.frameIdx;
      sctx.putImageData(new ImageData(frameToRGBA(state.doc, i), w, ht), 0, 0);
      ctx.drawImage(scratch, 0, 0, cw, ch);
      return;
    }
    if (state.onion && state.frameIdx > 0) {
      sctx.putImageData(new ImageData(frameToRGBA(state.doc, state.frameIdx - 1), w, ht), 0, 0);
      ctx.globalAlpha = 0.25;
      ctx.drawImage(scratch, 0, 0, cw, ch);
      ctx.globalAlpha = 1;
    }
    const shown = preview && preview.length === w * ht
      ? frameToRGBA({ w, h: ht, palette: previewPal || state.doc.palette, frames: [preview] }, 0)
      : frameToRGBA(state.doc, state.frameIdx);
    sctx.putImageData(new ImageData(shown, w, ht), 0, 0);
    ctx.drawImage(scratch, 0, 0, cw, ch);
    if (z >= 8) {
      ctx.strokeStyle = 'rgba(184, 255, 160, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < w; i++) { ctx.moveTo(i * z + 0.5, 0); ctx.lineTo(i * z + 0.5, ch); }
      for (let i = 1; i < ht; i++) { ctx.moveTo(0, i * z + 0.5); ctx.lineTo(cw, i * z + 0.5); }
      ctx.stroke();
    }
    if (state.mirror) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(cw / 2, 0); ctx.lineTo(cw / 2, ch); ctx.stroke();
      ctx.restore();
    }
    updateThumb(state.frameIdx);
  }

  let thumbRaf = 0;
  function updateThumb(i) {
    cancelAnimationFrame(thumbRaf);
    thumbRaf = requestAnimationFrame(() => {
      const b = el.frames.children[i];
      const cv = b && b.querySelector && b.querySelector('canvas');
      if (cv && state.doc.frames[i]) putRGBA(cv, cv.getContext('2d'), frameToRGBA(state.doc, i), state.doc.w, state.doc.h);
    });
  }

  function renderStrip() {
    el.frames.textContent = '';
    const { doc } = state;
    doc.frames.forEach((_, i) => {
      const cv = h('canvas', { class: 'px-thumb', width: String(doc.w), height: String(doc.h), 'aria-hidden': 'true' });
      putRGBA(cv, cv.getContext('2d'), frameToRGBA(doc, i), doc.w, doc.h);
      const picked = i === state.frameIdx || sel.has(i);
      const b = h('button', {
        type: 'button', class: 'px-fr' + (i === state.frameIdx ? ' on' : picked ? ' sel' : ''),
        'aria-label': `frame ${i + 1}`, 'aria-pressed': String(picked),
        title: 'shift-click: select a range · ctrl-click: add or remove',
      }, [cv, h('span', { text: String(i + 1) })]);
      b.addEventListener('click', e => {
        if (e.shiftKey) {
          const a = Math.min(i, state.frameIdx), z = Math.max(i, state.frameIdx);
          for (let k = a; k <= z; k++) sel.add(k);
        } else if (e.ctrlKey || e.metaKey) {
          if (i === state.frameIdx) {
            const rest = [...sel].filter(k => k !== i);
            if (rest.length) { state.frameIdx = rest[rest.length - 1]; sel.delete(state.frameIdx); }
          } else if (sel.has(i)) sel.delete(i);
          else { sel.add(state.frameIdx); sel.add(i); }
        } else sel.clear();
        if (!e.ctrlKey && !e.metaKey) state.frameIdx = i;
        sel.delete(state.frameIdx);
        refreshAll(); scheduleSave();
      });
      el.frames.appendChild(b);
    });
    const add = h('button', { type: 'button', class: 'px-fr px-add', 'aria-label': 'add frame', title: 'add frame after current', text: '+' });
    add.disabled = doc.frames.length >= MAX_FRAMES;
    add.addEventListener('click', () => {
      snapshot();
      const i = addFrame(state.doc, state.frameIdx);
      if (i >= 0) state.frameIdx = i;
      sel.clear();
      changed();
    });
    el.frames.appendChild(add);
    const on = el.frames.children[state.frameIdx];
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // palette indexes (0-based) used in the given frames, or in every frame when idxs is omitted
  function usedColors(idxs) {
    const used = new Set(), { frames } = state.doc;
    for (const fi of idxs || frames.map((_, i) => i)) {
      const f = frames[fi]; if (!f) continue;
      for (let i = 0; i < f.length; i++) if (f[i]) used.add((f[i] & 0x7fff) - 1);
    }
    return used;
  }

  // drop palette colors no frame uses and remap the art; returns how many were removed
  function pruneUnused() {
    const doc = state.doc, used = usedColors();
    if (!used.size) return 0;
    const map = new Map(), pal = [];
    doc.palette.forEach((hex, i) => { if (used.has(i)) { map.set(i, pal.length); pal.push(hex); } });
    const removed = doc.palette.length - pal.length;
    if (!removed) return 0;
    for (const f of doc.frames) {
      for (let i = 0; i < f.length; i++) if (f[i]) f[i] = (map.get((f[i] & 0x7fff) - 1) + 1) | (f[i] & HALF);
    }
    doc.palette = pal;
    state.colorIdx = map.has(state.colorIdx) ? map.get(state.colorIdx) : 0;
    return removed;
  }

  function renderColors() {
    const { palette } = state.doc;
    const inSel = usedColors(selected());
    el.swatches.textContent = '';
    palette.forEach((hex, i) => {
      const b = h('button', {
        type: 'button', class: 'px-sw' + (i === state.colorIdx ? ' on' : '') + (inSel.has(i) ? ' used' : ''), style: `background:${hex}`,
        'aria-label': `color ${i + 1}, ${hex}${inSel.has(i) ? ', used in selected frames' : ''}`, 'aria-pressed': String(i === state.colorIdx),
        title: (i < 9 ? `${hex} (${i + 1})` : hex) + (inSel.has(i) ? ' · used here' : ''),
      });
      b.addEventListener('click', () => {
        state.colorIdx = i; if (state.tool === 'eraser') state.tool = 'pencil'; syncControls(); renderColors(); scheduleSave();
      });
      el.swatches.appendChild(b);
    });
    const add = h('button', { type: 'button', class: 'px-sw px-swadd', text: '+', 'aria-label': 'add color', title: 'add color' });
    add.disabled = palette.length >= MAX_COLORS;
    add.addEventListener('click', addColor);
    el.swatches.appendChild(add);
    const hex = palette[state.colorIdx];
    el.big.style.background = hex;
    el.hex.textContent = hex;
    el.colorin.value = hex;
  }

  function renderSizes() {
    el.sizes.textContent = '';
    for (const s of SIZES) {
      const b = h('button', {
        type: 'button', class: 'px-btn', text: `${s}`, 'aria-label': `canvas size ${s} by ${s}`,
        'aria-pressed': String(state.doc.w === s),
      });
      b.addEventListener('click', () => {
        if (s === state.doc.w) { pendingSize = 0; renderConfirm(); return; }
        pendingSize = s; renderConfirm();
        el.yes.focus();
      });
      el.sizes.appendChild(b);
    }
    renderConfirm();
  }
  function renderConfirm() {
    el.confirm.hidden = !pendingSize;
    if (pendingSize) el.confirmtext.textContent = `resize to ${pendingSize}×${pendingSize}? art is kept top-left / cropped.`;
  }

  function refreshAll() {
    if (destroyed) return;
    syncControls(); renderStrip(); renderColors(); renderSizes(); renderCanvas(); restartPlay();
  }

  // ── zoom to fit ─────────────────────────────────────────────────
  function fitZoom() {
    const aw = el.stage.clientWidth - 16, ah = el.stage.clientHeight - 16;
    if (aw <= 0 || ah <= 0) return;
    const z = Math.max(1, Math.min(24, Math.floor(Math.min(aw, ah) / state.doc.w)));
    if (z !== state.zoom) { state.zoom = z; renderCanvas(); }
  }
  let ro = null;
  if (window.ResizeObserver) { ro = new ResizeObserver(() => fitZoom()); ro.observe(el.stage); }

  // ── play preview ────────────────────────────────────────────────
  function drawPlay() {
    const { doc } = state;
    const i = state.playing ? playIdx % doc.frames.length : state.frameIdx;
    putRGBA(el.play, playCtx, frameToRGBA(doc, i), doc.w, doc.h);
    if (bigPlay) renderCanvas();
  }
  function setBigPlay(on) {
    if (on && convPanel && convPanel.isOpen) return;
    bigPlay = on;
    el.stage.classList.toggle('px-bigplay', on);
    el.play.setAttribute('aria-pressed', String(on));
    renderCanvas();
  }
  el.play.addEventListener('click', () => setBigPlay(!bigPlay));
  el.play.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setBigPlay(!bigPlay); }
  });
  function restartPlay() {
    clearTimeout(playTimer);
    playIdx = state.playing ? playIdx % state.doc.frames.length : 0;
    drawPlay();
    if (!state.playing || state.doc.frames.length < 2) return;
    const tick = () => {
      playIdx = (playIdx + 1) % state.doc.frames.length;
      drawPlay();
      playTimer = setTimeout(tick, 1000 / state.fps);
    };
    playTimer = setTimeout(tick, 1000 / state.fps);
  }
  function togglePlay() { state.playing = !state.playing; syncControls(); restartPlay(); scheduleSave(); }
  el.playbtn.addEventListener('click', togglePlay);
  el.fps.addEventListener('input', () => {
    state.fps = Math.max(2, Math.min(12, Number(el.fps.value) || 6));
    el.fpsout.textContent = String(state.fps);
    restartPlay(); scheduleSave();
  });
  // keep the preview animating while the current frame is edited
  const playRefreshTimer = setInterval(() => { if (state.playing) drawPlay(); }, 400);

  // ── drawing on the canvas ───────────────────────────────────────
  function cellAt(e) {
    const r = el.canvas.getBoundingClientRect();
    const { w, h: ht } = state.doc;
    return [
      Math.max(0, Math.min(w - 1, Math.floor((e.clientX - r.left) / r.width * w))),
      Math.max(0, Math.min(ht - 1, Math.floor((e.clientY - r.top) / r.height * ht))),
    ];
  }

  function pick(x, y) {
    const v = cur()[y * state.doc.w + x];
    if (!v) return;
    state.colorIdx = (v & 0x7fff) - 1;
    state.half = !!(v & HALF);
    if (state.tool === 'eraser') state.tool = 'pencil';
    syncControls(); renderColors(); scheduleSave();
  }

  function drawShape(s, x, y) {
    const f = cur(), { w, h: ht } = state.doc;
    f.set(s.base);
    const o = { mirror: state.mirror };
    if (state.tool === 'line') line(f, w, ht, s.x0, s.y0, x, y, s.value, o);
    else rect(f, w, ht, s.x0, s.y0, x, y, s.value, { mirror: state.mirror, filled: state.filled });
  }

  el.canvas.addEventListener('contextmenu', e => e.preventDefault());
  el.canvas.addEventListener('pointerdown', e => {
    if (bigPlay) { e.preventDefault(); setBigPlay(false); return; }
    if (stroke || (convPanel && convPanel.isOpen)) return;
    const [x, y] = cellAt(e);
    if (e.button === 2 || (e.button === 0 && e.altKey)) { e.preventDefault(); pick(x, y); return; }
    if (e.button !== 0) return;
    e.preventDefault();
    closeMenus();
    const { w, h: ht } = state.doc, f = cur(), value = toolValue();
    stroke = { id: e.pointerId, before: snapshotOf(state.doc), x0: x, y0: y, lx: x, ly: y, value, base: f.slice() };
    try { el.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (state.tool === 'pencil' || state.tool === 'eraser') setPixel(f, w, ht, x, y, value, { mirror: state.mirror });
    else if (state.tool === 'fill') floodFill(f, w, ht, x, y, value, { mirror: state.mirror });
    else drawShape(stroke, x, y);
    renderCanvas();
    if (state.tool === 'fill') endStroke();
  });
  el.canvas.addEventListener('pointermove', e => {
    if (!stroke || e.pointerId !== stroke.id) return;
    const [x, y] = cellAt(e);
    if (x === stroke.lx && y === stroke.ly) return;
    const { w, h: ht } = state.doc;
    if (state.tool === 'pencil' || state.tool === 'eraser') {
      line(cur(), w, ht, stroke.lx, stroke.ly, x, y, stroke.value, { mirror: state.mirror });
    } else if (state.tool === 'line' || state.tool === 'box') drawShape(stroke, x, y);
    stroke.lx = x; stroke.ly = y;
    renderCanvas();
  });
  function endStroke() {
    if (!stroke) return;
    const s = stroke; stroke = null;
    const f = cur();
    let diff = false;
    for (let i = 0; i < f.length; i++) if (f[i] !== s.base[i]) { diff = true; break; }
    if (diff) { history.push(s.before); touched = true; }
    syncControls(); renderCanvas(); renderColors(); restartPlay(); scheduleSave();
  }
  el.canvas.addEventListener('pointerup', e => { if (stroke && e.pointerId === stroke.id) endStroke(); });
  el.canvas.addEventListener('pointercancel', e => { if (stroke && e.pointerId === stroke.id) endStroke(); });
  el.canvas.addEventListener('lostpointercapture', e => { if (stroke && e.pointerId === stroke.id) endStroke(); });

  // ── right column actions ────────────────────────────────────────
  el.colorin.addEventListener('input', () => {
    if (!colorEditSnap) { snapshot(); colorEditSnap = true; }
    state.doc.palette[state.colorIdx] = el.colorin.value.toLowerCase();
    syncControls(); renderColors(); renderCanvas(); renderStrip(); drawPlay(); scheduleSave();
  });
  el.colorin.addEventListener('change', () => { colorEditSnap = false; });

  el.prune.addEventListener('click', () => {
    const before = snapshotOf(state.doc);
    const n = pruneUnused();
    if (!n) { flash('no unused colors'); return; }
    history.push(before); touched = true;
    changed();
    flash(`removed ${n} color${n > 1 ? 's' : ''}`);
  });
  function addColor() {
    if (state.doc.palette.length >= MAX_COLORS) return;
    snapshot();
    state.doc.palette.push(state.doc.palette[state.colorIdx]);
    state.colorIdx = state.doc.palette.length - 1;
    changed();
    el.colorin.focus();
  }

  function renderPalList() {
    el.pallist.textContent = '';
    const saved = getSavedPalettes();
    if (!saved.length) {
      el.pallist.appendChild(h('div', { class: 'px-empty', text: 'no saved palettes. make one with run palette.' }));
      return;
    }
    for (const p of saved) {
      const strip = h('button', {
        type: 'button', class: 'px-strippal', role: 'menuitem',
        'aria-label': 'load palette ' + p.colors.join(' '),
      }, p.colors.map(c => h('span', { style: `background:${c}` })));
      strip.addEventListener('click', () => {
        snapshot();
        const n = p.colors.length;
        state.doc.palette = p.colors.map(c => c.toLowerCase());
        for (const f of state.doc.frames) {
          for (let i = 0; i < f.length; i++) {
            const v = f[i];
            if (v && (v & 0x7fff) > n) f[i] = n | (v & HALF);
          }
        }
        state.colorIdx = Math.min(state.colorIdx, n - 1);
        closeMenus();
        changed();
        flash('palette loaded');
      });
      el.pallist.appendChild(strip);
    }
  }

  // selected frame indexes, ascending (always includes the current frame)
  function selected() { return [...new Set([...sel, state.frameIdx])].filter(i => i < state.doc.frames.length).sort((a, b) => a - b); }
  el.selall.addEventListener('click', () => {
    const n = state.doc.frames.length;
    if (selected().length >= n) sel.clear();
    else for (let i = 0; i < n; i++) sel.add(i);
    sel.delete(state.frameIdx);
    refreshAll();
  });
  el.dup.addEventListener('click', () => {
    const idx = selected(), doc = state.doc;
    if (doc.frames.length + idx.length > MAX_FRAMES) { flash(`max ${MAX_FRAMES} frames`); return; }
    snapshot();
    const copies = idx.map(i => doc.frames[i].slice()), at = idx[idx.length - 1] + 1;
    doc.frames.splice(at, 0, ...copies);
    sel.clear();
    for (let k = 1; k < copies.length; k++) sel.add(at + k);
    state.frameIdx = at;
    changed();
  });
  el.del.addEventListener('click', () => {
    const idx = selected(), doc = state.doc;
    if (idx.length >= doc.frames.length) {
      if (doc.frames.length <= 1 && doc.frames[0].every(v => !v)) return;
      snapshot();
      doc.frames = [new Uint16Array(doc.w * doc.h)];
      state.frameIdx = 0;
    } else {
      snapshot();
      for (let k = idx.length - 1; k >= 0; k--) doc.frames.splice(idx[k], 1);
      state.frameIdx = Math.min(idx[0], doc.frames.length - 1);
    }
    sel.clear();
    changed();
    if (idx.length > 1) flash(`deleted ${idx.length} frames`);
  });
  el.left.addEventListener('click', () => {
    if (state.frameIdx <= 0) return;
    snapshot(); state.frameIdx = moveFrame(state.doc, state.frameIdx, state.frameIdx - 1); changed();
  });
  el.right.addEventListener('click', () => {
    if (state.frameIdx >= state.doc.frames.length - 1) return;
    snapshot(); state.frameIdx = moveFrame(state.doc, state.frameIdx, state.frameIdx + 1); changed();
  });
  el.onion.addEventListener('click', () => { state.onion = !state.onion; syncControls(); renderCanvas(); scheduleSave(); });
  el.clear.addEventListener('click', () => {
    const idx = selected();
    snapshot();
    for (const i of idx) state.doc.frames[i].fill(0);
    changed();
  });
  el.yes.addEventListener('click', () => {
    if (!pendingSize) return;
    snapshot();
    resizeDoc(state.doc, pendingSize);
    pendingSize = 0;
    fitZoom();
    changed();
  });
  el.no.addEventListener('click', () => { pendingSize = 0; renderConfirm(); });

  // ── menus: load palette, export ─────────────────────────────────
  function closeMenus() {
    menu = null;
    el.pallist.hidden = true; el.exportmenu.hidden = true; el.importmenu.hidden = true;
    el.loadpal.setAttribute('aria-expanded', 'false');
    el.exportbtn.setAttribute('aria-expanded', 'false');
    el.importbtn.setAttribute('aria-expanded', 'false');
  }
  function openMenu(name) {
    const was = menu;
    closeMenus();
    if (was === name) return;
    menu = name;
    if (name === 'palettes') {
      renderPalList(); el.pallist.hidden = false; el.loadpal.setAttribute('aria-expanded', 'true');
      const f = el.pallist.querySelector('button'); if (f) f.focus();
    } else if (name === 'import') {
      renderImportMenu(); el.importmenu.hidden = false; el.importbtn.setAttribute('aria-expanded', 'true');
      const f = el.importmenu.querySelector('button'); if (f) f.focus();
    } else {
      renderExportMenu(); el.exportmenu.hidden = false; el.exportbtn.setAttribute('aria-expanded', 'true');
      const f = el.exportmenu.querySelector('button'); if (f) f.focus();
    }
  }
  el.loadpal.addEventListener('click', () => openMenu('palettes'));
  el.exportbtn.addEventListener('click', () => openMenu('export'));
  el.importbtn.addEventListener('click', () => openMenu('import'));

  let pngScale = 8;
  function renderExportMenu() {
    const m = el.exportmenu;
    m.textContent = '';
    const scaleSel = h('select', { class: 'px-sel', 'aria-label': 'png scale' },
      SCALES.map(s => h('option', { value: String(s), text: `${s}×`, selected: s === pngScale })));
    scaleSel.addEventListener('change', () => { pngScale = Number(scaleSel.value) || 8; });
    m.appendChild(h('label', { class: 'px-scalerow' }, [h('span', { class: 'px-lbl', text: 'png scale' }), scaleSel]));
    const items = [
      ['download png', downloadPng],
      ['download spritesheet png', downloadSheet],
      ['download gif', downloadGif],
      ['copy as code', () => copyText(toCode(state.doc, state.frameIdx), 'code')],
      ['copy share link', copyShare],
    ];
    for (const [label, fn] of items) {
      const b = h('button', { type: 'button', class: 'px-item', role: 'menuitem', text: label });
      b.addEventListener('click', () => { closeMenus(); fn(); });
      m.appendChild(b);
    }
  }

  function copyText(text, label) {
    const fallback = () => {
      const m = el.exportmenu;
      m.textContent = '';
      const ta = h('textarea', { class: 'px-fallback', readonly: true, 'aria-label': `${label}, press ctrl+c to copy`, rows: '6' });
      ta.value = text;
      const done = h('button', { type: 'button', class: 'px-btn', text: 'done' });
      done.addEventListener('click', () => closeMenus());
      m.append(h('div', { class: 'px-lbl', text: 'press ctrl+c to copy' }), ta, done);
      m.hidden = false; menu = 'export';
      el.exportbtn.setAttribute('aria-expanded', 'true');
      ta.focus(); ta.select();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => flash(`copied ${label}`), fallback);
    } else fallback();
  }

  function canvasBlob(rgba, w, hgt, scale, name) {
    const src = document.createElement('canvas');
    src.width = w; src.height = hgt;
    src.getContext('2d').putImageData(new ImageData(rgba, w, hgt), 0, 0);
    const out = document.createElement('canvas');
    out.width = w * scale; out.height = hgt * scale;
    const c = out.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(src, 0, 0, out.width, out.height);
    out.toBlob(b => { if (b) { download(b, name); flash('downloaded ' + name); } }, 'image/png');
  }
  function downloadPng() {
    const { doc } = state;
    canvasBlob(frameToRGBA(doc, state.frameIdx), doc.w, doc.h, pngScale, `pixel-frame${state.frameIdx + 1}-${pngScale}x.png`);
  }
  function downloadSheet() {
    const s = toSpritesheetRGBA(state.doc);
    const sc = state.doc.w >= 128 ? 4 : 8;
    canvasBlob(s.data, s.width, s.height, sc, `pixel-spritesheet-${sc}x.png`);
  }
  function downloadGif() {
    try {
      const bytes = toGif(state.doc, { scale: state.doc.w >= 128 ? 4 : 8, fps: state.fps });
      download(new Blob([bytes], { type: 'image/gif' }), 'pixel.gif');
      flash('downloaded pixel.gif');
    } catch (e) { flash('gif failed'); }
  }
  async function copyShare() {
    try {
      const enc = await encodeDoc(state.doc);
      if (enc.length > 2000000) { flash('too big for a link, use export'); return; }
      const link = location.origin + '/tools/pixel/#' + enc;
      copyText(link, 'share link' + (link.length > 8000 ? ` (long: ${Math.round(link.length / 1024)} KB)` : ''));
    } catch (e) { flash('share failed'); }
  }


  // ── import: image, code, share link ─────────────────────────────
  const fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-hidden': 'true', tabindex: '-1' });
  root.appendChild(fileIn);

  function getConv() {
    if (!convPanel) {
      convPanel = createConvertPanel({
        host: el.side, h, settings: state.cv,
        getDoc: () => state.doc, getFrameIdx: () => state.frameIdx, getColorIdx: () => state.colorIdx,
        onSettings: cv => { state.cv = cv; scheduleSave(); },
        onPreview: (vals, pal) => { preview = vals; previewPal = pal || null; renderCanvas(); },
        onApply: applyConvert,
        onClose: () => { preview = null; previewPal = null; syncControls(); renderCanvas(); },
      });
    }
    return convPanel;
  }

  function applyConvert({ frames, dest, palette, fps, total, indices, prune }) {
    snapshot();
    const doc = state.doc;
    if (palette) doc.palette = palette.slice();
    const emptyOne = doc.frames.length === 1 && doc.frames[0].every(v => !v);
    let first = state.frameIdx, added = 0;
    if (dest === 'new') {
      let at = state.frameIdx;
      frames.forEach((vals, k) => {
        if (k === 0 && frames.length > 1 && emptyOne) { doc.frames[0].set(vals); first = 0; at = 0; added++; return; }
        const i = addFrame(doc, at);
        if (i < 0) return;
        doc.frames[i].set(vals);
        if (added === 0) first = i;
        at = i; added++;
      });
    } else if (dest === 'replace') {
      frames.forEach((vals, k) => { const fi = indices ? indices[k] : k; if (doc.frames[fi]) doc.frames[fi].set(vals); });
      added = frames.length;
    } else { doc.frames[state.frameIdx].set(frames[0]); added = 1; }
    state.frameIdx = first;
    if (dest === 'new') sel.clear();
    const pruned = prune ? pruneUnused() : 0;
    preview = null; previewPal = null;
    if (fps) { state.fps = fps; }
    changed();
    restartPlay();
    flash(dest === 'new' ? (total > added ? `added ${added} of ${total} frames` : `added ${added} frames`)
      : dest === 'replace' ? `converted ${added} frames` : 'converted');
    if (pruned) setTimeout(() => flash(`removed ${pruned} unused color${pruned > 1 ? 's' : ''}`), 1200);
  }

  function openConvert(src) {
    if (bigPlay) setBigPlay(false);
    closeMenus();
    getConv().open(src);
  }

  async function decodeGif(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length < 4 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'GIF8') return null;
    const reader = new GifReader(bytes);
    if (Math.max(reader.width, reader.height) > MAX_IMPORT_EDGE) return null;
    const g = gifFrames(reader, MAX_FRAMES);
    return { frames: g.frames, w: g.w, h: g.h, delays: g.delays };
  }

  async function decodeImageFile(file) {
    if (file.type === 'image/gif' || /\.gif$/i.test(file.name || '')) {
      try {
        const g = await decodeGif(file);
        if (g) return g;
      } catch (e) { /* fall back to a single frame */ }
    }
    let bmp = null, url = '';
    try {
      if (window.createImageBitmap) bmp = await createImageBitmap(file);
    } catch (e) { bmp = null; }
    let src = bmp;
    if (!src) {
      url = URL.createObjectURL(file);
      src = await new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => rej(new Error('decode'));
        img.src = url;
      });
    }
    try {
      const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
      if (!sw || !sh) throw new Error('empty');
      const k = Math.min(1, MAX_IMPORT_EDGE / Math.max(sw, sh));
      const w = Math.max(1, Math.round(sw * k)), hh = Math.max(1, Math.round(sh * k));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = hh;
      const c = cv.getContext('2d', { willReadFrequently: true });
      c.imageSmoothingQuality = 'high';
      c.drawImage(src, 0, 0, w, hh);
      return { frames: [c.getImageData(0, 0, w, hh).data], w, h: hh };
    } finally {
      if (bmp && bmp.close) bmp.close();
      if (url) URL.revokeObjectURL(url);
    }
  }

  async function importImageFile(file) {
    if (!file || !/^image\//.test(file.type)) { flash('not an image'); return; }
    try {
      const img = await decodeImageFile(file);
      if (destroyed) return;
      openConvert({ kind: 'image', frames: img.frames, w: img.w, h: img.h, delays: img.delays, name: file.name || 'image' });
    } catch (e) { flash('could not read image'); }
  }
  fileIn.addEventListener('change', () => {
    const f = fileIn.files && fileIn.files[0];
    fileIn.value = '';
    if (f) importImageFile(f);
  });

  function nearestPaletteIdx(hex) {
    const c = hexToRgb(hex);
    let best = 0, bd = Infinity;
    state.doc.palette.forEach((p, i) => {
      const q = hexToRgb(p);
      const d = 0.3 * (c[0] - q[0]) ** 2 + 0.59 * (c[1] - q[1]) ** 2 + 0.11 * (c[2] - q[2]) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  function importCode(text) {
    const parsed = parseCode(text);
    if (!parsed) { flash('not valid code'); return false; }
    const need = Math.max(parsed.w, parsed.h);
    // grow the canvas if the code needs more room, never shrink it (that would crop other frames)
    const size = Math.max(state.doc.w, SIZES.find(s => s >= need) || SIZES[SIZES.length - 1]);
    const exact = parsed.w === size && parsed.h === size;
    const useCurrent = cur().every(v => !v);
    if (!useCurrent && state.doc.frames.length >= MAX_FRAMES) { flash('no free frame'); return false; }
    snapshot(); sel.clear();
    if (state.doc.w !== size) { resizeDoc(state.doc, size); pendingSize = 0; fitZoom(); }
    const { doc } = state;
    const map = new Map();
    if (parsed.legend) {
      for (const [ch, hex] of parsed.legend) {
        let i = doc.palette.findIndex(p => p.toLowerCase() === hex);
        if (i < 0) {
          if (doc.palette.length < MAX_COLORS) { doc.palette.push(hex); i = doc.palette.length - 1; }
          else i = nearestPaletteIdx(hex);
        }
        map.set(ch, i);
      }
    }
    if (useCurrent) { state.frameIdx = Math.min(state.frameIdx, doc.frames.length - 1); }
    else state.frameIdx = addFrame(doc, state.frameIdx);
    const f = cur();
    f.fill(0);
    for (let y = 0; y < Math.min(parsed.h, size); y++) {
      for (let x = 0; x < Math.min(parsed.w, size); x++) {
        const ch = parsed.rows[y][x];
        if (ch === '.') continue;
        let v;
        if (parsed.legend) {
          const lower = ch.toLowerCase();
          v = map.get(lower) + 1;
          if (ch !== lower) v |= HALF;
        } else v = (state.colorIdx + 1) | (ch === '%' ? HALF : 0);
        f[y * size + x] = v;
      }
    }
    changed();
    flash(exact ? 'imported' : `resized to ${size}`);
    return true;
  }

  async function importShare(text) {
    const raw = text.trim();
    const hash = raw.includes('#') ? raw.slice(raw.indexOf('#') + 1) : raw;
    const decoded = await decodeDoc(hash.trim());
    if (destroyed) return false;
    if (!decoded) { flash('not a pixel link'); return false; }
    snapshot(); sel.clear();
    state.doc.w = decoded.w; state.doc.h = decoded.h;
    state.doc.palette = decoded.palette; state.doc.frames = decoded.frames;
    state.frameIdx = 0;
    state.colorIdx = Math.min(state.colorIdx, decoded.palette.length - 1);
    pendingSize = 0;
    fitZoom();
    changed();
    flash('imported');
    return true;
  }

  function renderImportMenu(mode = 'list') {
    const m = el.importmenu;
    m.textContent = '';
    if (mode === 'list') {
      const items = [
        ['image file…', () => fileIn.click(), true],
        ['paste code', () => renderImportMenu('code')],
        ['share link', () => renderImportMenu('link')],
      ];
      for (const [label, fn, closes] of items) {
        const b = h('button', { type: 'button', class: 'px-item', role: 'menuitem', text: label });
        b.addEventListener('click', () => { if (closes) closeMenus(); fn(); });
        m.appendChild(b);
      }
      return;
    }
    const label = mode === 'code' ? 'paste code' : 'share link';
    const ta = h('textarea', { class: 'px-fallback', 'aria-label': label, rows: '6', spellcheck: 'false' });
    const go = h('button', { type: 'button', class: 'px-btn px-btn-fill', text: 'import' });
    const no = h('button', { type: 'button', class: 'px-btn', text: 'cancel' });
    go.addEventListener('click', async () => {
      const ok = mode === 'code' ? importCode(ta.value) : await importShare(ta.value);
      if (ok) closeMenus();
    });
    no.addEventListener('click', () => closeMenus());
    m.append(h('div', { class: 'px-lbl', text: label }), ta, go, no);
    ta.focus();
  }

  el.reduce.addEventListener('click', () => {
    const { doc } = state;
    openConvert({
      kind: 'frame', frames: doc.frames.map((_, i) => frameToRGBA(doc, i)), startIdx: state.frameIdx, selIdx: selected(),
      w: doc.w, h: doc.h, name: `frame ${state.frameIdx + 1}`,
    });
  });

  const imageOf = dt => {
    if (!dt || !dt.files) return null;
    return [...dt.files].find(f => /^image\//.test(f.type)) || null;
  };
  const onPaste = e => {
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
    const f = imageOf(e.clipboardData);
    if (!f) return;
    e.preventDefault();
    importImageFile(f);
  };
  const onDragOver = e => {
    if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')) e.preventDefault();
  };
  const onDrop = e => {
    const f = imageOf(e.dataTransfer);
    if (!f) return;
    e.preventDefault();
    importImageFile(f);
  };

  // ── keyboard / outside clicks ───────────────────────────────────
  function onKey(e) {
    const t = e.target;
    const inField = t && t.closest && t.closest('input, textarea, select, [contenteditable]');
    if (e.key === 'Escape') {
      if (bigPlay) { setBigPlay(false); e.stopPropagation(); return; }
      if (convPanel && convPanel.isOpen) { convPanel.close(); e.stopPropagation(); return; }
      if (menu || pendingSize) {
        const b = menu === 'palettes' ? el.loadpal : menu === 'import' ? el.importbtn : el.exportbtn;
        const hadMenu = !!menu;
        pendingSize = 0; renderConfirm(); closeMenus();
        if (hadMenu) b.focus();
        e.stopPropagation();
      }
      return;
    }
    if (e.key === ' ' || e.code === 'Space') {
      if (t && t.closest && t.closest('input, textarea, select, button, [contenteditable]')) return;
      e.preventDefault();
      togglePlay();
      return;
    }
    if (inField) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (k === 'y') { e.preventDefault(); redo(); }
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (k === 'r' && e.shiftKey) { e.preventDefault(); state.filled = !state.filled; state.tool = 'box'; syncControls(); renderCanvas(); scheduleSave(); return; }
    if (TOOL_KEYS[k] && !e.shiftKey) { e.preventDefault(); toolAction(TOOL_KEYS[k]); return; }
    if (k === 'm') { e.preventDefault(); toolAction('mirror'); return; }
    if (k === 'h') { e.preventDefault(); toolAction('half'); return; }
    if (/^[1-9]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (i < state.doc.palette.length) {
        e.preventDefault();
        state.colorIdx = i; if (state.tool === 'eraser') state.tool = 'pencil';
        syncControls(); renderColors(); scheduleSave();
      }
    }
  }
  const keyTarget = mode === 'page' ? document : root;
  keyTarget.addEventListener('keydown', onKey);
  keyTarget.addEventListener('paste', onPaste);
  el.stage.addEventListener('dragover', onDragOver);
  el.stage.addEventListener('drop', onDrop);

  const onPointerDown = e => {
    if (!root.contains(e.target)) return;
    if (!e.target.closest('input, textarea, select')) root.focus({ preventScroll: true });
  };
  root.addEventListener('pointerdown', onPointerDown);

  const onDocDown = e => {
    if (!menu || !root.contains(e.target)) return;
    if (!e.target.closest('.px-menu, .px-list, [data-role="exportbtn"], [data-role="importbtn"], [data-role="loadpal"]')) closeMenus();
  };
  document.addEventListener('pointerdown', onDocDown);

  const onHide = () => { saveNow(); };
  window.addEventListener('pagehide', onHide);

  // ── start ───────────────────────────────────────────────────────
  refreshAll();
  fitZoom();
  loadInitial().then(() => { if (!destroyed) { fitZoom(); saveNow(); } });

  return {
    destroy() {
      saveNow();
      destroyed = true;
      clearTimeout(msgTimer); clearTimeout(saveTimer); clearTimeout(hashTimer); clearTimeout(playTimer);
      clearInterval(playRefreshTimer);
      cancelAnimationFrame(thumbRaf);
      keyTarget.removeEventListener('keydown', onKey);
      keyTarget.removeEventListener('paste', onPaste);
      el.stage.removeEventListener('dragover', onDragOver);
      el.stage.removeEventListener('drop', onDrop);
      if (convPanel) convPanel.destroy();
      document.removeEventListener('pointerdown', onDocDown);
      window.removeEventListener('pagehide', onHide);
      if (ro) ro.disconnect();
      root.remove();
    },
  };
}
