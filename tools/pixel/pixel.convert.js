// Pixel editor image conversion: downscale, adjust, dither, tone bands, code parsing.
// Pure functions, no DOM, no imports.

// ── pattern sets (4x4 tiles, 1 = lighter color) ──────────────────
function bayer(n) {
  let m = [[0]];
  while (m.length < n) {
    const s = m.length, out = [];
    for (let y = 0; y < s * 2; y++) {
      out.push([]);
      for (let x = 0; x < s * 2; x++) {
        const v = m[y % s][x % s] * 4;
        out[y].push(v + [[0, 2], [3, 1]][(y / s) | 0][(x / s) | 0]);
      }
    }
    m = out;
  }
  return m.flat().map(v => (v + 0.5) / (n * n));
}
const BAYER = { 2: bayer(2), 4: bayer(4), 8: bayer(8) };
const B4IDX = bayer(4).map(t => Math.round(t * 16 - 0.5));

const tileFrom = fn => {
  const t = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) t.push(fn(x, y) ? 1 : 0);
  return t;
};

export const PATTERN_SETS = {
  bayer: { label: 'bayer ramp', tiles: [0, 4, 8, 12, 16].map(k => tileFrom((x, y) => B4IDX[y * 4 + x] < k)) },
  checker: { label: 'checker', tiles: [tileFrom(() => 0), tileFrom((x, y) => (x + y) % 2 === 0), tileFrom(() => 1)] },
  dots: {
    label: 'dots',
    tiles: [
      tileFrom(() => 0),
      tileFrom((x, y) => x === 0 && y === 0),
      tileFrom((x, y) => (x === 0 && y === 0) || (x === 2 && y === 2)),
      tileFrom((x, y) => x % 2 === 0 && y % 2 === 0),
      tileFrom((x, y) => (x + y) % 2 === 0),
      tileFrom((x, y) => !(x % 2 === 1 && y % 2 === 1)),
      tileFrom(() => 1),
    ],
  },
  lines: {
    label: 'scanlines',
    tiles: [tileFrom(() => 0), tileFrom((x, y) => y === 0), tileFrom((x, y) => y % 2 === 0), tileFrom((x, y) => y !== 3), tileFrom(() => 1)],
  },
  hatch: {
    label: 'diagonal hatch',
    tiles: [
      tileFrom(() => 0), tileFrom((x, y) => (x + y) % 4 === 0), tileFrom((x, y) => (x + y) % 4 < 2),
      tileFrom((x, y) => (x + y) % 4 < 3), tileFrom(() => 1),
    ],
  },
};

const clamp = v => (v < 0 ? 0 : v > 255 ? 255 : v);
const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

// ── source pixels ────────────────────────────────────────────────
// Center-crop to a square, then area-average to N x N. Color is weighted by alpha
// so transparent pixels do not darken the result.
export function downscale(rgba, sw, sh, N, { fit = 'crop' } = {}) {
  void fit;
  const s = Math.min(sw, sh), ox = Math.floor((sw - s) / 2), oy = Math.floor((sh - s) / 2);
  const rgb = new Float32Array(N * N * 3), alpha = new Uint8Array(N * N);
  const k = s / N;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const o = y * N + x;
      if (k <= 1) {
        // upscaling or 1:1: nearest
        const sx = ox + Math.min(s - 1, Math.floor((x + 0.5) * k)), sy = oy + Math.min(s - 1, Math.floor((y + 0.5) * k));
        const i = (sy * sw + sx) * 4;
        rgb[o * 3] = rgba[i]; rgb[o * 3 + 1] = rgba[i + 1]; rgb[o * 3 + 2] = rgba[i + 2];
        alpha[o] = rgba[i + 3];
        continue;
      }
      const x0 = x * k, x1 = (x + 1) * k, y0 = y * k, y1 = (y + 1) * k;
      let r = 0, g = 0, b = 0, a = 0, wsum = 0, pr = 0, pg = 0, pb = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(yy + 1, y1) - Math.max(yy, y0);
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const w = wy * (Math.min(xx + 1, x1) - Math.max(xx, x0));
          const i = ((oy + yy) * sw + ox + xx) * 4, al = rgba[i + 3];
          pr += rgba[i] * w; pg += rgba[i + 1] * w; pb += rgba[i + 2] * w;
          r += rgba[i] * w * al; g += rgba[i + 1] * w * al; b += rgba[i + 2] * w * al;
          a += al * w; wsum += w;
        }
      }
      const aw = a; // sum of alpha*weight
      if (aw > 0) {
        rgb[o * 3] = r / aw; rgb[o * 3 + 1] = g / aw; rgb[o * 3 + 2] = b / aw;
      } else {
        rgb[o * 3] = pr / wsum; rgb[o * 3 + 1] = pg / wsum; rgb[o * 3 + 2] = pb / wsum;
      }
      alpha[o] = Math.round(a / wsum);
    }
  }
  return { rgb, alpha };
}

export function adjust(rgb, bright, contrast) {
  const out = new Float32Array(rgb.length);
  const br = bright * 2.2, ct = (contrast + 100) / 100;
  for (let i = 0; i < rgb.length; i++) out[i] = clamp((rgb[i] - 128) * ct + 128 + br);
  return out;
}

// ── target colors ────────────────────────────────────────────────
export function targetColors(paletteHex, depth) {
  const seen = new Set(), all = [];
  paletteHex.forEach((hex, idx) => {
    const key = hex.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const rgb = hexRgb(hex);
    all.push({ idx, rgb, l: lum(rgb[0], rgb[1], rgb[2]) });
  });
  if (!all.length) return [];
  const byL = all.slice().sort((a, b) => a.l - b.l);
  let picked;
  if (depth === 'all') picked = byL;
  else {
    const dark = byL[0], light = byL[byL.length - 1];
    picked = dark === light ? [dark] : [dark, light];
    if (depth === 2) {
      for (const goal of [1 / 3, 2 / 3]) {
        let best = null;
        for (const c of byL) {
          if (picked.includes(c)) continue;
          if (!best || Math.abs(c.l - goal) < Math.abs(best.l - goal)) best = c;
        }
        if (best) picked.push(best);
      }
    }
  }
  return picked.sort((a, b) => a.l - b.l).map(c => ({ idx: c.idx, rgb: c.rgb }));
}

// ── convert ──────────────────────────────────────────────────────
function nearest(pal, r, g, b) {
  let best = 0, bd = Infinity;
  for (let j = 0; j < pal.length; j++) {
    const c = pal[j].rgb;
    const d = 0.3 * (r - c[0]) ** 2 + 0.59 * (g - c[1]) ** 2 + 0.11 * (b - c[2]) ** 2;
    if (d < bd) { bd = d; best = j; }
  }
  return best;
}

function threshFromTiles(tiles) {
  const T = tiles.length, t = new Float32Array(16);
  for (let c = 0; c < 16; c++) {
    let off = 0;
    for (const tl of tiles) if (!tl[c]) off++;
    t[c] = (off - 0.5) / Math.max(1, T - 1);
  }
  return t;
}

const TAPS = {
  fs: [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]],
  atkinson: [[1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]],
};

function bandRender(rgb, N, K, tiles, { bands, speck, outline }) {
  const n = N * N, L0 = new Float32Array(n), L = new Float32Array(n);
  for (let i = 0; i < n; i++) L0[i] = lum(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
  // light blur so bands follow shapes, not noise
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let s = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
          s += L0[yy * N + xx]; c++;
        }
      }
      L[y * N + x] = s / c;
    }
  }
  const B = Math.max(1, Math.min(bands | 0 || 4, n));
  const sorted = Array.from(L).sort((a, b) => a - b);
  let cen = [];
  for (let j = 0; j < B; j++) cen.push(sorted[Math.floor((j + 0.5) / B * n)]);
  const band = new Uint8Array(n);
  const assign = () => {
    for (let i = 0; i < n; i++) {
      let bj = 0, bd = 9;
      for (let j = 0; j < B; j++) { const d = Math.abs(L[i] - cen[j]); if (d < bd) { bd = d; bj = j; } }
      band[i] = bj;
    }
  };
  for (let it = 0; it < 12; it++) {
    assign();
    const s = new Float64Array(B), c = new Uint32Array(B);
    for (let i = 0; i < n; i++) { s[band[i]] += L[i]; c[band[i]]++; }
    cen = cen.map((v, j) => (c[j] ? s[j] / c[j] : v));
  }
  const order = cen.map((v, j) => j).sort((a, b) => cen[a] - cen[b]), rank = new Uint8Array(B);
  order.forEach((j, r) => { rank[j] = r; });
  assign();
  for (let i = 0; i < n; i++) band[i] = rank[band[i]];
  cen = order.map(j => cen[j]);

  const cleanup = speck > 0;
  if (cleanup) {
    // merge regions smaller than the speck size into their most common neighbor band
    const minSize = Math.max(1, Math.round(speck * (N / 64) ** 2));
    const seen = new Int32Array(n).fill(-1), stack = [];
    for (let s0 = 0; s0 < n; s0++) {
      if (seen[s0] >= 0) continue;
      const reg = [], b0 = band[s0], nb = new Uint32Array(B);
      stack.push(s0); seen[s0] = s0;
      while (stack.length) {
        const i = stack.pop(); reg.push(i);
        const x = i % N, y = (i / N) | 0;
        for (const [xx, yy] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
          const j = yy * N + xx;
          if (band[j] !== b0) { nb[band[j]]++; continue; }
          if (seen[j] < 0) { seen[j] = s0; stack.push(j); }
        }
      }
      if (reg.length < minSize) {
        let best = b0, bc = 0;
        for (let j = 0; j < B; j++) if (nb[j] > bc) { bc = nb[j]; best = j; }
        for (const i of reg) band[i] = best;
      }
    }
  }

  const T = tiles.length;
  const base = cen.map(c => Math.min(K - 1, Math.floor(Math.max(0, Math.min(1, c)) * (K - 1))));
  const tileOf = cen.map((c, j) => {
    const v = Math.max(0, Math.min(1, c)) * (K - 1);
    return Math.round((v - base[j]) * (T - 1));
  });
  const out = new Uint8Array(n);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x, bj = band[i];
      out[i] = Math.min(K - 1, base[bj] + tiles[tileOf[bj]][(y % 4) * 4 + x % 4]);
    }
  }
  if (outline === 'solid' || outline === 'dotted') {
    const edge = new Uint8Array(n);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x, b = band[i];
        if ((x > 0 && band[i - 1] < b) || (x < N - 1 && band[i + 1] < b) || (y > 0 && band[i - N] < b) || (y < N - 1 && band[i + N] < b)) {
          if (outline === 'dotted' && (x + y) % 2) continue;
          edge[i] = 1;
        }
      }
    }
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        if (!edge[i]) continue;
        if (cleanup && outline === 'solid') {
          let nbr = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx, yy = y + dy;
              if ((dx || dy) && xx >= 0 && yy >= 0 && xx < N && yy < N && edge[yy * N + xx]) nbr++;
            }
          }
          if (!nbr) continue;
        }
        out[i] = cen[band[i]] >= 0.5 ? 0 : K - 1;
      }
    }
  }
  return out;
}

// rgb/alpha are the adjusted source at N x N. Returns doc values (idx + 1, 0 = empty).
// opts.rgb: match colors in rgb space (use for 'all'); otherwise dither on brightness.
export function convert(rgb, alpha, N, targets, opts = {}) {
  const { method = 'bayer4', tiles = PATTERN_SETS.bayer.tiles, bands = 5, speck = 0, outline = 'off' } = opts;
  const n = N * N, K = targets.length, res = new Uint16Array(n);
  if (!K) return res;
  let q = new Uint8Array(n);
  if (K > 1 && !opts.rgb) {
    const L = new Float32Array(n);
    for (let i = 0; i < n; i++) L[i] = lum(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) * (K - 1);
    if (method === 'none') for (let i = 0; i < n; i++) q[i] = Math.round(L[i]);
    else if (method.startsWith('bayer')) {
      const s = +method.slice(5), m = BAYER[s] || BAYER[4], ss = BAYER[s] ? s : 4;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const v = L[y * N + x], b = Math.floor(v);
          q[y * N + x] = Math.min(K - 1, b + (v - b > m[(y % ss) * ss + x % ss] ? 1 : 0));
        }
      }
    } else if (method === 'pattern') {
      const T = tiles.length;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const v = L[y * N + x], b = Math.min(K - 1, Math.floor(v)), f = v - b;
          q[y * N + x] = Math.min(K - 1, b + tiles[Math.round(f * (T - 1))][(y % 4) * 4 + x % 4]);
        }
      }
    } else if (method === 'bands') {
      q = bandRender(rgb, N, K, tiles, { bands, speck, outline });
    } else {
      const E = L.slice(), taps = TAPS[method] || TAPS.fs;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const i = y * N + x, v = Math.max(0, Math.min(K - 1, Math.round(E[i]))), err = E[i] - v;
          q[i] = v;
          for (const [dx, dy, w] of taps) {
            const xx = x + dx, yy = y + dy;
            if (xx >= 0 && xx < N && yy < N) E[yy * N + xx] += err * w;
          }
        }
      }
    }
  } else if (K > 1) {
    const spread = 255 / Math.max(1, K - 1);
    if (method === 'none' || method === 'bands') {
      for (let i = 0; i < n; i++) q[i] = nearest(targets, rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    } else if (method.startsWith('bayer') || method === 'pattern') {
      const pat = method === 'pattern', s = pat ? 4 : (BAYER[+method.slice(5)] ? +method.slice(5) : 4);
      const m = pat ? threshFromTiles(tiles) : BAYER[s];
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const i = y * N + x, o = (Math.min(1, m[(y % s) * s + x % s]) - 0.5) * spread;
          q[i] = nearest(targets, rgb[i * 3] + o, rgb[i * 3 + 1] + o, rgb[i * 3 + 2] + o);
        }
      }
    } else {
      const E = Float32Array.from(rgb), taps = TAPS[method] || TAPS.fs;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const i = y * N + x, j = nearest(targets, E[i * 3], E[i * 3 + 1], E[i * 3 + 2]);
          q[i] = j;
          for (let c = 0; c < 3; c++) {
            const err = E[i * 3 + c] - targets[j].rgb[c];
            for (const [dx, dy, w] of taps) {
              const xx = x + dx, yy = y + dy;
              if (xx >= 0 && xx < N && yy < N) E[(yy * N + xx) * 3 + c] += err * w;
            }
          }
        }
      }
    }
  }
  for (let i = 0; i < n; i++) res[i] = alpha[i] < 128 ? 0 : targets[q[i]].idx + 1;
  return res;
}

// ── code import ──────────────────────────────────────────────────
// Reads toCode() output. Returns { w, h, rows, legend } or null.
// legend is a Map of lowercase char -> '#rrggbb' (null for the @ % . format).
// With a legend, an uppercase row letter means that color at 50%.
export function parseCode(text) {
  if (typeof text !== 'string') return null;
  let legend = null;
  const kept = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith('//')) {
      const m = /^\/\/\s*legend:\s*(.*)$/i.exec(t);
      if (m) {
        legend = legend || new Map();
        for (const e of m[1].matchAll(/([A-Za-z0-9])\s*=\s*(#[0-9a-fA-F]{6})\b/g)) legend.set(e[1].toLowerCase(), e[2].toLowerCase());
      }
    } else kept.push(line);
  }
  const rows = [...kept.join('\n').matchAll(/"([^"\n]*)"/g)].map(m => m[1]);
  if (!rows.length) return null;
  const w = rows[0].length;
  if (!w || rows.some(r => r.length !== w)) return null;
  for (const r of rows) {
    for (const c of r) {
      if (c === '.') continue;
      if (legend ? !legend.has(c.toLowerCase()) : c !== '@' && c !== '%') return null;
    }
  }
  return { w, h: rows.length, rows, legend };
}
