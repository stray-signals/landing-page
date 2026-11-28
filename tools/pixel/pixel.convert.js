// Pixel editor image conversion: downscale, adjust, dither, tone bands, code parsing.
// Pure functions, no DOM, no imports.

// pattern sets (4x4 tiles, 1 = lighter color)
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

// source pixels
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

// gif frames
// Composites a GifReader's frames onto full-canvas RGBA frames, following disposal rules.
export function gifFrames(reader, max) {
  const w = reader.width, h = reader.height, n = Math.min(reader.numFrames(), max);
  let canvas = new Uint8ClampedArray(w * h * 4);
  const frames = [], delays = [];
  for (let i = 0; i < n; i++) {
    const info = reader.frameInfo(i);
    const before = info.disposal === 3 ? canvas.slice() : null;
    const buf = canvas.slice();
    reader.decodeAndBlitFrameRGBA(i, buf);
    frames.push(buf.slice());
    delays.push(info.delay || 0);
    canvas = buf;
    if (info.disposal === 2) {
      for (let y = info.y; y < Math.min(h, info.y + info.height); y++) {
        canvas.fill(0, (y * w + info.x) * 4, (y * w + Math.min(w, info.x + info.width)) * 4);
      }
    } else if (info.disposal === 3 && before) canvas = before;
  }
  return { w, h, frames, delays };
}

// pixel art detection
const gcd = (a, b) => { while (b) { [a, b] = [b, a % b]; } return a; };
const keyAt = (d, i) => (d[i + 3] === 0 ? 0 : ((d[i] << 24) | (d[i + 1] << 16) | (d[i + 2] << 8) | d[i + 3]) >>> 0 || 1);

// gcd of run lengths (edge-touching runs skipped) and the unique color count (capped at 257)
function runInfo(rgba, w, h) {
  const colors = new Set();
  for (let i = 0; i < w * h && colors.size <= 256; i++) colors.add(keyAt(rgba, i * 4));
  let g = 0;
  if (colors.size > 256) return { g, colors: colors.size };
  for (let y = 0; y < h && g !== 1; y++) {
    let start = 0;
    for (let x = 1; x <= w; x++) {
      if (x < w && keyAt(rgba, (y * w + x) * 4) === keyAt(rgba, (y * w + start) * 4)) continue;
      if (start > 0 && x < w) g = gcd(g, x - start);
      start = x;
    }
  }
  for (let x = 0; x < w && g !== 1; x++) {
    let start = 0;
    for (let y = 1; y <= h; y++) {
      if (y < h && keyAt(rgba, (y * w + x) * 4) === keyAt(rgba, (start * w + x) * 4)) continue;
      if (start > 0 && y < h) g = gcd(g, y - start);
      start = y;
    }
  }
  return { g, colors: colors.size };
}

export function pixelScale(rgba, w, h) {
  const { g, colors } = runInfo(rgba, w, h);
  return colors > 256 || g < 2 ? 1 : g;
}

function opaqueColorCount(rgba, w, h, set = new Set()) {
  for (let i = 0; i < w * h && set.size <= 64; i++) if (rgba[i * 4 + 3] >= 128) set.add(keyAt(rgba, i * 4));
  return set;
}

export function isPixelArt(rgba, w, h) {
  return pixelScale(rgba, w, h) > 1 || opaqueColorCount(rgba, w, h).size <= 64;
}

// The one exact color covering >= 95% of the opaque edge pixels of frame 0, or null.
export function borderColor(frames, w, h) {
  const f = frames && frames[0];
  if (!f || w < 1 || h < 1) return null;
  const counts = new Map();
  let total = 0;
  const add = (x, y) => {
    const i = (y * w + x) * 4;
    if (f[i + 3] < 128) return;
    const k = (f[i] << 16) | (f[i + 1] << 8) | f[i + 2];
    counts.set(k, (counts.get(k) || 0) + 1);
    total++;
  };
  for (let x = 0; x < w; x++) { add(x, 0); if (h > 1) add(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { add(0, y); if (w > 1) add(w - 1, y); }
  if (!total) return null;
  for (const [k, n] of counts) if (n * 100 >= total * 95) return [k >> 16, (k >> 8) & 255, k & 255];
  return null;
}

// Every frame ends up on the same N x N grid with the same crop and scale.
export function prepareSource(frames, w, h, N, { removeBg = false, exact = false } = {}) {
  if (exact && w === N && h === N) {
    // the doc's own frames: map 1:1, no crop or rescale
    return {
      pixelArt: false,
      frames: frames.map(f => {
        const rgb = new Float32Array(N * N * 3), alpha = new Uint8Array(N * N);
        for (let i = 0; i < N * N; i++) {
          rgb[i * 3] = f[i * 4]; rgb[i * 3 + 1] = f[i * 4 + 1]; rgb[i * 3 + 2] = f[i * 4 + 2]; alpha[i] = f[i * 4 + 3];
        }
        return { rgb, alpha };
      }),
    };
  }
  let scale = 0, big = false;
  const uniq = new Set();
  for (const f of frames) {
    const { g, colors } = runInfo(f, w, h);
    if (colors > 256) big = true;
    if (g > 1) scale = scale ? gcd(scale, g) : g;
    opaqueColorCount(f, w, h, uniq);
  }
  scale = big || scale < 2 ? 1 : scale;
  const pixelArt = scale > 1 || uniq.size <= 64;
  if (!pixelArt) return { frames: frames.map(f => downscale(f, w, h, N, { fit: 'crop' })), pixelArt };

  const bg = removeBg ? borderColor(frames, w, h) : null;
  const nw = Math.max(1, Math.floor(w / scale)), nh = Math.max(1, Math.floor(h / scale)), half = scale >> 1;
  const nat = frames.map(f => {
    const o = new Uint8ClampedArray(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const i = ((y * scale + half) * w + x * scale + half) * 4;
        o.set(f.subarray(i, i + 4), (y * nw + x) * 4);
        if (bg) {
          const j = (y * nw + x) * 4;
          if (o[j] === bg[0] && o[j + 1] === bg[1] && o[j + 2] === bg[2]) o[j + 3] = 0;
        }
      }
    }
    return o;
  });
  let x0 = nw, y0 = nh, x1 = -1, y1 = -1;
  for (const f of nat) {
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        if (f[(y * nw + x) * 4 + 3] < 128) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = nw - 1; y1 = nh - 1; }
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(nw - 1, x1 + 1); y1 = Math.min(nh - 1, y1 + 1);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const fits = bw <= N && bh <= N;
  const tw = fits ? bw : (bw >= bh ? N : Math.max(1, Math.round(bw * N / bh)));
  const th = fits ? bh : (bh >= bw ? N : Math.max(1, Math.round(bh * N / bw)));
  const ox = Math.floor((N - tw) / 2), oy = Math.floor((N - th) / 2);
  const out = nat.map(f => {
    const rgb = new Float32Array(N * N * 3), alpha = new Uint8Array(N * N);
    for (let ty = 0; ty < th; ty++) {
      for (let tx = 0; tx < tw; tx++) {
        const sx0 = x0 + Math.floor(tx * bw / tw), sx1 = Math.max(sx0 + 1, x0 + Math.floor((tx + 1) * bw / tw));
        const sy0 = y0 + Math.floor(ty * bh / th), sy1 = Math.max(sy0 + 1, y0 + Math.floor((ty + 1) * bh / th));
        const counts = new Map();
        let opaque = 0, total = 0, best = -1, bc = 0;
        for (let sy = sy0; sy < sy1; sy++) {
          for (let sx = sx0; sx < sx1; sx++) {
            const i = (sy * nw + sx) * 4;
            total++;
            if (f[i + 3] < 128) continue;
            opaque++;
            const k = (f[i] << 16) | (f[i + 1] << 8) | f[i + 2], c = (counts.get(k) || 0) + 1;
            counts.set(k, c);
            if (c > bc) { bc = c; best = k; }
          }
        }
        if (opaque * 2 < total || best < 0) continue;
        const o = (oy + ty) * N + ox + tx;
        rgb[o * 3] = best >> 16; rgb[o * 3 + 1] = (best >> 8) & 255; rgb[o * 3 + 2] = best & 255;
        alpha[o] = 255;
      }
    }
    return { rgb, alpha };
  });
  return { frames: out, pixelArt };
}

// Up to `max` colors from the opaque pixels of all frames. Exact when few enough, else k-means.
export function imageColors(rgbFrames, alphaFrames, max) {
  const counts = new Map();
  rgbFrames.forEach((rgb, fi) => {
    const alpha = alphaFrames[fi];
    for (let i = 0; i < alpha.length; i++) {
      if (alpha[i] < 128) continue;
      const k = (Math.round(rgb[i * 3]) << 16) | (Math.round(rgb[i * 3 + 1]) << 8) | Math.round(rgb[i * 3 + 2]);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  });
  const px = [...counts].map(([k, n]) => ({ c: [k >> 16, (k >> 8) & 255, k & 255], n }));
  if (px.length <= max) return px.map(p => p.c);
  px.forEach(p => { p.l = lum(p.c[0], p.c[1], p.c[2]); });
  px.sort((a, b) => a.l - b.l);
  const total = px.reduce((a, p) => a + p.n, 0), used = new Set();
  let cen = [], acc = 0, j = 0;
  for (let k = 0; k < max; k++) {
    const goal = (k + 0.5) / max * total;
    while (j < px.length - 1 && acc + px[j].n < goal) { acc += px[j].n; j++; }
    let pick = j;
    while (used.has(pick) && pick < px.length - 1) pick++;
    while (used.has(pick) && pick > 0) pick--;
    used.add(pick);
    cen.push(px[pick].c.slice());
  }
  const owner = new Int32Array(px.length);
  for (let it = 0; it < 10; it++) {
    const sum = cen.map(() => [0, 0, 0, 0]);
    px.forEach((p, i) => {
      let bj = 0, bd = Infinity;
      for (let q = 0; q < max; q++) {
        const c = cen[q], d = (p.c[0] - c[0]) ** 2 + (p.c[1] - c[1]) ** 2 + (p.c[2] - c[2]) ** 2;
        if (d < bd) { bd = d; bj = q; }
      }
      owner[i] = bj;
      const s = sum[bj];
      s[0] += p.c[0] * p.n; s[1] += p.c[1] * p.n; s[2] += p.c[2] * p.n; s[3] += p.n;
    });
    cen = cen.map((c, q) => (sum[q][3] ? [sum[q][0] / sum[q][3], sum[q][1] / sum[q][3], sum[q][2] / sum[q][3]] : c));
  }
  return cen.map(c => c.map(v => Math.round(v)));
}

export function adjust(rgb, bright, contrast) {
  const out = new Float32Array(rgb.length);
  const br = bright * 2.2, ct = (contrast + 100) / 100;
  for (let i = 0; i < rgb.length; i++) out[i] = clamp((rgb[i] - 128) * ct + 128 + br);
  return out;
}

// target colors
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
  if (depth === 'palette' || depth === 'image') picked = byL;
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

// convert
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
// opts.rgb: match colors in rgb space (use for 'palette' and 'image'); otherwise dither on brightness.
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

// code import
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
