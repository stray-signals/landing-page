// Pixel editor convert panel: replaces the side column while open, previews live on the canvas.
import { MAX_FRAMES, MAX_COLORS } from '/tools/pixel/pixel.core.js';
import { PATTERN_SETS, prepareSource, borderColor, imageColors, adjust, targetColors, convert } from '/tools/pixel/pixel.convert.js';

const DEPTHS = [[1, '1-bit'], [2, '2-bit'], ['palette', 'palette'], ['image', 'image']];
const METHODS = [
  ['none', 'flat'], ['bayer2', 'bayer 2×2'], ['bayer4', 'bayer 4×4'], ['bayer8', 'bayer 8×8'],
  ['fs', 'floyd–steinberg'], ['atkinson', 'atkinson'], ['pattern', 'my patterns'], ['bands', 'bands'],
];
const OUTLINES = [['off', 'off'], ['solid', 'solid'], ['dotted', 'dotted']];

export function defaultConvertSettings() {
  return {
    depth: 1, method: 'bayer4', set: 'bayer', tiles: PATTERN_SETS.bayer.tiles.map(t => t.slice()),
    bands: 5, speck: 0, outline: 'off', bright: 0, contrast: 0,
  };
}

// Accepts saved settings of unknown shape and returns a safe object.
export function cleanConvertSettings(raw) {
  const d = defaultConvertSettings();
  if (!raw || typeof raw !== 'object') return d;
  const num = (v, lo, hi, def) => (Number.isInteger(v) && v >= lo && v <= hi ? v : def);
  if ([1, 2, 'palette', 'image'].includes(raw.depth)) d.depth = raw.depth;
  else if (raw.depth === 'all') d.depth = 'palette';
  if (METHODS.some(m => m[0] === raw.method)) d.method = raw.method;
  if (PATTERN_SETS[raw.set]) { d.set = raw.set; d.tiles = PATTERN_SETS[raw.set].tiles.map(t => t.slice()); }
  if (Array.isArray(raw.tiles) && raw.tiles.length >= 2 && raw.tiles.length <= 8
    && raw.tiles.every(t => Array.isArray(t) && t.length === 16)) {
    d.tiles = raw.tiles.map(t => t.map(v => (v ? 1 : 0)));
  }
  d.bands = num(raw.bands, 2, 6, d.bands);
  d.speck = num(raw.speck, 0, 40, d.speck);
  if (OUTLINES.some(o => o[0] === raw.outline)) d.outline = raw.outline;
  d.bright = num(raw.bright, -60, 60, 0);
  d.contrast = num(raw.contrast, -60, 60, 0);
  return d;
}

export function createConvertPanel({ host, getDoc, getFrameIdx, getColorIdx, onPreview, onApply, onClose, h, settings, onSettings }) {
  void getFrameIdx; void getColorIdx;
  let saved = settings;
  let s = cleanConvertSettings(saved);
  let source = null, base = null, into = 'this', framesMode = 'all', plan = null, raf = 0, root = null, removeBg = true, bgColor = null;
  const cleanups = [];
  const ref = {};

  const rgbMode = () => s.depth === 'palette' || s.depth === 'image';
  const hexOf = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  const multi = () => !!source && source.frames.length > 1;
  const allMode = () => multi() && framesMode === 'all';
  const isEmptyDoc = doc => doc.frames.length === 1 && doc.frames[0].every(v => !v);

  // Palette the image colors would use: existing art keeps its colors, new colors go in free slots.
  function planned() {
    if (plan) return plan;
    const doc = getDoc(), pal = doc.palette.slice(), usedIdx = new Set();
    for (const f of doc.frames) for (const v of f) if (v) usedIdx.add((v & 0x7fff) - 1);
    const unused = [];
    pal.forEach((_, i) => { if (!usedIdx.has(i)) unused.push(i); });
    const freeCount = unused.length + Math.max(0, MAX_COLORS - pal.length);
    const found = imageColors(base.frames.map(f => f.rgb), base.frames.map(f => f.alpha), freeCount);
    const lower = pal.map(x => x.toLowerCase()), reused = new Set(), fresh = [];
    for (const c of found) {
      const at = lower.indexOf(hexOf(c));
      if (at >= 0) reused.add(at); else fresh.push(c);
    }
    const slots = unused.filter(i => !reused.has(i));
    const newIdx = [];
    for (const c of fresh) {
      let i;
      if (slots.length) i = slots.shift();
      else if (pal.length < MAX_COLORS) { i = pal.length; pal.push('#000000'); } else break;
      pal[i] = hexOf(c);
      newIdx.push(i);
    }
    plan = { palette: pal, newIdx, targets: [...reused, ...newIdx].sort((a, b) => a - b) };
    return plan;
  }

  const palFor = () => (s.depth === 'image' && base ? planned().palette : getDoc().palette);
  const targets = () => {
    if (s.depth !== 'image') return targetColors(getDoc().palette, s.depth);
    if (!base) return [];
    const p = planned();
    return p.targets.map(idx => {
      const n = parseInt(p.palette[idx].slice(1), 16);
      return { idx, rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], l: 0 };
    }).sort((a, b) => lumOf(a.rgb) - lumOf(b.rgb));
  };
  const lumOf = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

  function computeFrame(fr, tg) {
    const N = getDoc().w;
    return convert(adjust(fr.rgb, s.bright, s.contrast), fr.alpha, N, tg, {
      method: s.method, tiles: s.tiles, bands: s.bands, speck: s.speck, outline: s.outline, rgb: rgbMode(),
    });
  }

  function compute() {
    if (!source || !base) return null;
    return computeFrame(base.frames[0], targets());
  }

  function schedule() {
    if (raf || !root) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!root) return;
      const v = compute();
      if (v) onPreview(v, s.depth === 'image' ? planned().palette : null);
    });
  }

  function persist() { saved = s; if (onSettings) onSettings(s); }

  function seg(items, get, set, label) {
    const row = h('div', { class: 'px-row', role: 'group', 'aria-label': label });
    const btns = items.map(([val, text]) => {
      const b = h('button', { type: 'button', class: 'px-btn', text, 'aria-pressed': 'false' });
      b.addEventListener('click', () => { if (b.disabled) return; set(val); sync(); schedule(); persist(); });
      row.appendChild(b);
      return [val, b];
    });
    return { row, btns, update() { for (const [val, b] of btns) b.setAttribute('aria-pressed', String(get() === val)); } };
  }

  function range(label, min, max, key, fmt = v => String(v)) {
    const input = h('input', { type: 'range', min: String(min), max: String(max), step: '1', 'aria-label': label });
    const out = h('output', { text: '' });
    const row = h('label', { class: 'px-rng' }, [h('span', { class: 'px-lbl', text: label }), input, out]);
    input.addEventListener('input', () => {
      s[key] = Number(input.value) || 0;
      out.textContent = fmt(s[key]);
      schedule(); persist();
    });
    return { row, update() { input.value = String(s[key]); out.textContent = fmt(s[key]); } };
  }

  function build() {
    ref.depth = seg(DEPTHS, () => s.depth, v => {
      s.depth = v;
      if ((v === 'palette' || v === 'image') && s.method === 'bands') s.method = 'bayer4';
      if (v === 'image') s.method = 'none';
    }, 'color depth');
    ref.swatches = h('div', { class: 'px-cvsw', 'aria-label': 'target colors', role: 'img' });
    ref.method = h('select', { class: 'px-sel', 'aria-label': 'method' },
      METHODS.map(([v, t]) => h('option', { value: v, text: t })));
    ref.method.addEventListener('change', () => { s.method = ref.method.value; sync(); schedule(); persist(); });
    ref.set = h('select', { class: 'px-sel', 'aria-label': 'pattern set' },
      Object.entries(PATTERN_SETS).map(([k, v]) => h('option', { value: k, text: v.label })));
    ref.set.addEventListener('change', () => {
      s.set = ref.set.value; s.tiles = PATTERN_SETS[s.set].tiles.map(t => t.slice());
      sync(); schedule(); persist();
    });
    ref.tiles = h('div', { class: 'px-tiles', role: 'group', 'aria-label': 'pattern tiles' });
    ref.reset = h('button', { type: 'button', class: 'px-btn', text: 'reset tiles' });
    ref.reset.addEventListener('click', () => {
      s.tiles = PATTERN_SETS[s.set].tiles.map(t => t.slice());
      sync(); schedule(); persist();
    });
    ref.patBlock = h('div', { class: 'px-sec' }, [
      h('div', { class: 'px-lbl', text: 'pattern set' }), ref.set, ref.tiles, h('div', { class: 'px-row' }, [ref.reset]),
    ]);
    ref.bands = range('bands', 2, 6, 'bands');
    ref.speck = range('speck', 0, 40, 'speck');
    ref.outline = seg(OUTLINES, () => s.outline, v => { s.outline = v; }, 'outline');
    ref.bandBlock = h('div', { class: 'px-sec' }, [
      ref.bands.row, ref.speck.row, h('div', { class: 'px-lbl', text: 'outline' }), ref.outline.row,
    ]);
    ref.bright = range('bright', -60, 60, 'bright');
    ref.contrast = range('contrast', -60, 60, 'contrast');
    ref.into = seg([['this', 'this frame'], ['new', 'new frame']], () => into, v => { into = v; }, 'apply into');
    ref.frames = seg([['all', 'all'], ['first', 'first']], () => framesMode, v => { framesMode = v; }, 'frames');
    ref.frames.btns[0][1].textContent = `all ${source.frames.length}`;
    ref.bg = seg([['remove', 'remove'], ['keep', 'keep']], () => (removeBg ? 'remove' : 'keep'), v => {
      removeBg = v === 'remove'; plan = null; base = sourceBase();
    }, 'background');
    ref.bgSwatch = h('span', { title: 'background color' });
    ref.bgBlock = h('div', { class: 'px-sec' }, [h('div', { class: 'px-lbl', text: 'background' }), ref.bg.row, h('div', { class: 'px-cvsw' }, [ref.bgSwatch])]);
    ref.bgBlock.hidden = true;
    ref.framesBlock = h('div', { class: 'px-sec' }, [h('div', { class: 'px-lbl', text: 'frames' }), ref.frames.row]);
    ref.framesBlock.hidden = !multi();
    ref.apply = h('button', { type: 'button', class: 'px-btn px-btn-fill', text: 'apply' });
    ref.cancel = h('button', { type: 'button', class: 'px-btn', text: 'cancel' });
    ref.apply.addEventListener('click', apply);
    ref.cancel.addEventListener('click', () => close());
    ref.name = h('span', { class: 'px-cvname' });

    root = h('section', { class: 'px-conv', 'aria-label': 'convert' }, [
      h('div', { class: 'px-row' }, [h('span', { class: 'px-lbl', text: 'convert' }), ref.name]),
      h('div', { class: 'px-sec' }, [h('div', { class: 'px-lbl', text: 'colors' }), ref.depth.row, ref.swatches]),
      h('div', { class: 'px-sec' }, [h('div', { class: 'px-lbl', text: 'method' }), ref.method]),
      ref.patBlock, ref.bandBlock,
      h('div', { class: 'px-sec' }, [ref.bright.row, ref.contrast.row]),
      ref.bgBlock, ref.framesBlock,
      h('div', { class: 'px-sec' }, [h('div', { class: 'px-lbl', text: 'into' }), ref.into.row]),
      h('div', { class: 'px-row' }, [ref.apply, ref.cancel]),
    ]);
  }

  function drawTile(cv, tile, tg) {
    const c = cv.getContext('2d');
    const dark = tg[0] ? tg[0].rgb : [0, 0, 0], light = (tg[1] || tg[0] || { rgb: [255, 255, 255] }).rgb;
    const im = c.createImageData(4, 4);
    for (let i = 0; i < 16; i++) im.data.set([...(tile[i] ? light : dark), 255], i * 4);
    c.putImageData(im, 0, 0);
  }

  function renderTiles(tg) {
    ref.tiles.textContent = '';
    s.tiles.forEach((tile, k) => {
      const cv = h('canvas', { class: 'px-tile', width: '4', height: '4', 'aria-label': `tile ${k + 1}`, role: 'img' });
      drawTile(cv, tile, tg);
      let paintVal = null;
      const cellOf = e => {
        const r = cv.getBoundingClientRect();
        const x = Math.max(0, Math.min(3, Math.floor((e.clientX - r.left) / r.width * 4)));
        const y = Math.max(0, Math.min(3, Math.floor((e.clientY - r.top) / r.height * 4)));
        return y * 4 + x;
      };
      const setCell = c => {
        if (tile[c] === paintVal) return;
        tile[c] = paintVal; drawTile(cv, tile, tg); schedule(); persist();
      };
      cv.addEventListener('pointerdown', e => {
        e.preventDefault();
        const c = cellOf(e);
        paintVal = tile[c] ? 0 : 1;
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        setCell(c);
      });
      cv.addEventListener('pointermove', e => { if (paintVal !== null) setCell(cellOf(e)); });
      const stop = () => { paintVal = null; };
      cv.addEventListener('pointerup', stop);
      cv.addEventListener('pointercancel', stop);
      ref.tiles.appendChild(cv);
    });
  }

  function sync() {
    if (!root) return;
    const doc = getDoc(), tg = targets();
    const full = doc.frames.length >= MAX_FRAMES && !(allMode() && isEmptyDoc(doc));
    if (allMode()) into = 'new';
    else if (full && into === 'new') into = 'this';
    ref.depth.update(); ref.outline.update(); ref.frames.update(); ref.into.update(); ref.bg.update();
    ref.bgBlock.hidden = !bgColor;
    ref.into.btns.find(b => b[0] === 'new')[1].disabled = full;
    ref.into.btns.find(b => b[0] === 'this')[1].disabled = allMode();
    ref.apply.disabled = allMode() && frameCap() < 1;
    ref.bands.update(); ref.speck.update(); ref.bright.update(); ref.contrast.update();
    ref.method.value = s.method; ref.set.value = s.set;
    const bandsOpt = [...ref.method.options].find(o => o.value === 'bands');
    bandsOpt.disabled = rgbMode();
    ref.patBlock.hidden = !(s.method === 'pattern' || s.method === 'bands');
    ref.bandBlock.hidden = s.method !== 'bands';
    ref.swatches.textContent = '';
    const pal = palFor();
    const shown = s.depth === 'image' ? tg.filter(t => planned().newIdx.includes(t.idx)) : tg;
    for (const t of shown) ref.swatches.appendChild(h('span', { style: `background:${pal[t.idx]}`, title: pal[t.idx] }));
    renderTiles(tg);
  }

  function sourceBase() {
    return prepareSource(source.frames, source.w, source.h, getDoc().w, { removeBg });
  }

  function frameCap() {
    const doc = getDoc();
    return MAX_FRAMES - doc.frames.length + (isEmptyDoc(doc) ? 1 : 0);
  }

  function open(src) {
    if (root) { root.remove(); }
    source = src;
    plan = null;
    s = cleanConvertSettings(saved);
    removeBg = true;
    bgColor = null;
    base = sourceBase();
    if (base.pixelArt) bgColor = borderColor(source.frames, source.w, source.h);
    if (base.pixelArt) { s.depth = 'image'; s.method = 'none'; }
    framesMode = 'all';
    into = src.kind === 'image' ? 'new' : 'this';
    build();
    ref.name.textContent = src.name || '';
    if (bgColor) ref.bgSwatch.style.background = `rgb(${bgColor.join(',')})`;
    host.classList.add('px-side-conv');
    host.prepend(root);
    sync();
    const f = root.querySelector('button, select');
    if (f) f.focus({ preventScroll: true });
    schedule();
  }

  function apply() {
    if (!compute()) return;
    const tg = targets();
    let list = allMode() ? base.frames : [base.frames[0]];
    const total = list.length;
    if (allMode()) list = list.slice(0, Math.max(0, frameCap()));
    if (!list.length) return;
    const frames = list.map(fr => computeFrame(fr, tg));
    let fps;
    if (source.delays && frames.length > 1) {
      const d = source.delays.slice(0, frames.length), avg = d.reduce((a, b) => a + b, 0) / d.length;
      fps = avg > 0 ? Math.max(2, Math.min(12, Math.round(100 / avg))) : 10;
    }
    const dest = into, palette = s.depth === 'image' ? planned().palette : null;
    persist();
    onApply({ frames, dest, palette, fps, total });
    close();
  }

  function close() {
    if (!root) return;
    cancelAnimationFrame(raf); raf = 0;
    root.remove(); root = null; source = null; base = null; plan = null;
    host.classList.remove('px-side-conv');
    onClose();
  }

  return {
    open, close,
    get isOpen() { return !!root; },
    destroy() {
      cancelAnimationFrame(raf); raf = 0;
      if (root) root.remove();
      root = null; source = null; base = null;
      host.classList.remove('px-side-conv');
      for (const fn of cleanups) fn();
    },
  };
}
