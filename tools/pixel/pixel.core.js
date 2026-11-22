// Pixel editor core: document model, drawing, history, frames, export. Pure, no DOM.
import { GifWriter } from '../vendor/omggif.js';

export const SIZES = [16, 32, 64, 128];
export const MAX_FRAMES = 24;
export const MAX_COLORS = 32;
export const HALF = 0x8000;
export const BG_HEX = '#0c100c';
export const DEFAULT_PALETTE = [
  '#b8ffa0', '#0c100c', '#ff5d6c', '#ffb347', '#ffe66d', '#4ecb71', '#4aa3ff', '#b57bff',
];

export function createDoc(size = 32, palette = DEFAULT_PALETTE) {
  const s = SIZES.includes(size) ? size : 32;
  return { w: s, h: s, palette: palette.slice(), frames: [new Uint16Array(s * s)] };
}

// ── drawing ──────────────────────────────────────────────────────
export function setPixel(frame, w, h, x, y, value, { mirror = false } = {}) {
  if (x >= 0 && y >= 0 && x < w && y < h) frame[y * w + x] = value;
  if (mirror) {
    const mx = w - 1 - x;
    if (mx >= 0 && y >= 0 && mx < w && y < h) frame[y * w + mx] = value;
  }
}

export function line(frame, w, h, x0, y0, x1, y1, value, opts = {}) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    setPixel(frame, w, h, x0, y0, value, opts);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function rect(frame, w, h, x0, y0, x1, y1, value, { mirror = false, filled = false } = {}) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
  const ay = Math.min(y0, y1), by = Math.max(y0, y1);
  const o = { mirror };
  for (let y = ay; y <= by; y++) {
    const edgeY = y === ay || y === by;
    for (let x = ax; x <= bx; x++) {
      if (filled || edgeY || x === ax || x === bx) setPixel(frame, w, h, x, y, value, o);
    }
  }
}

function fillFrom(frame, w, h, x, y, value) {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const target = frame[y * w + x];
  if (target === value) return;
  const stack = [x, y];
  while (stack.length) {
    const cy = stack.pop(), cx = stack.pop();
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    if (frame[cy * w + cx] !== target) continue;
    frame[cy * w + cx] = value;
    stack.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1);
  }
}

export function floodFill(frame, w, h, x, y, value, { mirror = false } = {}) {
  fillFrom(frame, w, h, x, y, value);
  if (mirror) fillFrom(frame, w, h, w - 1 - x, y, value);
}

// ── history ──────────────────────────────────────────────────────
export function snapshotOf(doc) {
  return { w: doc.w, h: doc.h, palette: doc.palette.slice(), frames: doc.frames.map(f => f.slice()) };
}

export function createHistory(limit = 100) {
  const undoS = [], redoS = [];
  return {
    push(snapshot) {
      undoS.push(snapshot);
      if (undoS.length > limit) undoS.shift();
      redoS.length = 0;
    },
    undo(current) {
      if (!undoS.length) return null;
      redoS.push(current);
      return undoS.pop();
    },
    redo(current) {
      if (!redoS.length) return null;
      undoS.push(current);
      return redoS.pop();
    },
    get canUndo() { return undoS.length > 0; },
    get canRedo() { return redoS.length > 0; },
  };
}

// ── frames ───────────────────────────────────────────────────────
export function addFrame(doc, afterIdx) {
  if (doc.frames.length >= MAX_FRAMES) return -1;
  const i = Math.max(-1, Math.min(afterIdx, doc.frames.length - 1)) + 1;
  doc.frames.splice(i, 0, new Uint16Array(doc.w * doc.h));
  return i;
}

export function duplicateFrame(doc, idx) {
  if (doc.frames.length >= MAX_FRAMES || !doc.frames[idx]) return -1;
  doc.frames.splice(idx + 1, 0, doc.frames[idx].slice());
  return idx + 1;
}

export function deleteFrame(doc, idx) {
  if (doc.frames.length <= 1 || !doc.frames[idx]) return Math.min(idx, doc.frames.length - 1);
  doc.frames.splice(idx, 1);
  return Math.min(idx, doc.frames.length - 1);
}

export function moveFrame(doc, from, to) {
  if (from < 0 || from >= doc.frames.length || to < 0 || to >= doc.frames.length) return from;
  const [f] = doc.frames.splice(from, 1);
  doc.frames.splice(to, 0, f);
  return to;
}

// Resize every frame; art is kept top-left, cropped if smaller.
export function resizeDoc(doc, size) {
  if (!SIZES.includes(size)) return;
  const nf = doc.frames.map(old => {
    const f = new Uint16Array(size * size);
    const m = Math.min(size, doc.w);
    for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) f[y * size + x] = old[y * doc.w + x];
    return f;
  });
  doc.w = doc.h = size;
  doc.frames = nf;
}

// ── rendering ────────────────────────────────────────────────────
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function frameToRGBA(doc, idx) {
  const out = new Uint8ClampedArray(doc.w * doc.h * 4);
  const rgb = doc.palette.map(hexToRgb);
  const f = doc.frames[idx];
  for (let i = 0; i < f.length; i++) {
    const v = f[i];
    if (!v) continue;
    const c = rgb[(v & 0x7fff) - 1];
    if (!c) continue;
    out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2];
    out[i * 4 + 3] = v & HALF ? 128 : 255;
  }
  return out;
}

export function toSpritesheetRGBA(doc) {
  const n = doc.frames.length, width = doc.w * n, height = doc.h;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < n; i++) {
    const fr = frameToRGBA(doc, i);
    for (let y = 0; y < doc.h; y++) {
      data.set(fr.subarray(y * doc.w * 4, (y + 1) * doc.w * 4), (y * width + i * doc.w) * 4);
    }
  }
  return { data, width, height };
}

// ── share ────────────────────────────────────────────────────────
const VERSION = 2;

async function pipe(bytes, stream) {
  const s = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(s).arrayBuffer());
}

function toB64Url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

export async function encodeDoc(doc) {
  const np = doc.palette.length, nf = doc.frames.length, cells = doc.w * doc.h;
  const bytes = new Uint8Array(5 + np * 3 + 1 + nf * cells);
  let p = 0;
  bytes[p++] = VERSION; bytes[p++] = doc.w; bytes[p++] = doc.h; bytes[p++] = np;
  for (const hex of doc.palette) for (const c of hexToRgb(hex)) bytes[p++] = c;
  bytes[p++] = nf;
  // 1 byte per pixel (index | 0x80 for half); later frames store the XOR with the previous frame
  let prev = null;
  for (const f of doc.frames) {
    const raw = new Uint8Array(cells);
    for (let i = 0; i < cells; i++) {
      const v = (f[i] & 0x7f) | (f[i] & HALF ? 0x80 : 0);
      raw[i] = v;
      bytes[p + i] = prev ? v ^ prev[i] : v;
    }
    prev = raw;
    p += cells;
  }
  return toB64Url(await pipe(bytes.subarray(0, p), new CompressionStream('deflate-raw')));
}

export async function decodeDoc(str) {
  try {
    if (typeof str !== 'string' || !/^[A-Za-z0-9_-]+$/.test(str) || str.length > 3000000) return null;
    const b = await pipe(fromB64Url(str), new DecompressionStream('deflate-raw'));
    let p = 0;
    if (b.length < 6) return null;
    const ver = b[p++];
    if (ver !== 1 && ver !== 2) return null;
    const w = b[p++], h = b[p++], np = b[p++];
    if (w !== h || !SIZES.includes(w) || np < 1 || np > MAX_COLORS) return null;
    const palette = [];
    for (let i = 0; i < np; i++) {
      if (p + 3 > b.length) return null;
      palette.push('#' + [b[p], b[p + 1], b[p + 2]].map(n => n.toString(16).padStart(2, '0')).join(''));
      p += 3;
    }
    if (p >= b.length) return null;
    const nf = b[p++];
    if (nf < 1 || nf > MAX_FRAMES) return null;
    const cells = w * h;
    const frames = [];
    if (ver === 1) {
      if (b.length !== p + nf * cells * 2) return null;
      for (let k = 0; k < nf; k++) {
        const f = new Uint16Array(cells);
        for (let i = 0; i < cells; i++) {
          const v = b[p] | (b[p + 1] << 8);
          p += 2;
          if ((v & 0x7fff) > np) return null;
          f[i] = v;
        }
        frames.push(f);
      }
    } else {
      if (b.length !== p + nf * cells) return null;
      let prev = null;
      for (let k = 0; k < nf; k++) {
        const raw = new Uint8Array(cells), f = new Uint16Array(cells);
        for (let i = 0; i < cells; i++) {
          const v = prev ? b[p + i] ^ prev[i] : b[p + i];
          if ((v & 0x7f) > np) return null;
          raw[i] = v;
          f[i] = (v & 0x7f) | (v & 0x80 ? HALF : 0);
        }
        p += cells;
        prev = raw;
        frames.push(f);
      }
    }
    return { w, h, palette, frames };
  } catch (e) { return null; }
}

// ── code export ──────────────────────────────────────────────────
export function toCode(doc, idx) {
  const f = doc.frames[idx], { w, h } = doc;
  const used = new Set();
  for (let i = 0; i < f.length; i++) if (f[i]) used.add(f[i] & 0x7fff);
  const quote = rows => '[\n' + rows.map(r => '  "' + r + '",').join('\n') + '\n]';
  const rows = [];
  if (used.size <= 1) {
    for (let y = 0; y < h; y++) {
      let r = '';
      for (let x = 0; x < w; x++) { const v = f[y * w + x]; r += !v ? '.' : v & HALF ? '%' : '@'; }
      rows.push(r);
    }
    return quote(rows);
  }
  // a-z for palette indexes 1-26; indexes 27-32 use digits 0-5 (no separate half-tone, shown full)
  const ch = n => n <= 26 ? String.fromCharCode(96 + n) : String(n - 27);
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const v = f[y * w + x];
      if (!v) { r += '.'; continue; }
      const n = v & 0x7fff, c = ch(n);
      r += v & HALF && n <= 26 ? c.toUpperCase() : c;
    }
    rows.push(r);
  }
  const legend = ['. = empty', ...[...used].sort((a, b) => a - b).map(n => `${ch(n)} = ${doc.palette[n - 1]}`)];
  return `// legend: ${legend.join(', ')}\n// (uppercase = 50%)\n` + quote(rows);
}

// ── gif ──────────────────────────────────────────────────────────
export function toGif(doc, { scale = doc.w >= 128 ? 4 : 8, fps = 6 } = {}) {
  const np = doc.palette.length, bg = hexToRgb(BG_HEX);
  const colors = doc.palette.map(hexToRgb);
  const table = colors.map(c => (c[0] << 16) | (c[1] << 8) | c[2]);
  for (const c of colors) table.push((((c[0] + bg[0]) >> 1) << 16) | (((c[1] + bg[1]) >> 1) << 8) | ((c[2] + bg[2]) >> 1));
  const transparent = table.length;
  table.push(0);
  let size = 2;
  while (size < table.length) size <<= 1;
  while (table.length < size) table.push(0);

  const W = doc.w * scale, H = doc.h * scale;
  const buf = new Uint8Array(Math.max(1024, W * H * doc.frames.length + 4096 + 1024));
  const gw = new GifWriter(buf, W, H, { palette: table, loop: 0 });
  const delay = Math.max(1, Math.round(100 / fps));
  for (const f of doc.frames) {
    const px = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const sy = (y / scale) | 0;
      for (let x = 0; x < W; x++) {
        const v = f[sy * doc.w + ((x / scale) | 0)];
        px[y * W + x] = !v ? transparent : (v & 0x7fff) - 1 + (v & HALF ? np : 0);
      }
    }
    gw.addFrame(0, 0, W, H, px, { delay, transparent, disposal: 2 });
  }
  return buf.slice(0, gw.end());
}
