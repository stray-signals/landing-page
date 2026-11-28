// Palette color math. Pure, no DOM. Importable in node.

import { normalizeHex, hexToRgb, rgbToHex, hexToHsl, hslToHex } from '../../shared/color.js';

export { normalizeHex, hexToRgb, rgbToHex, hexToHsl, hslToHex };

export const MODES = ['analogous', 'complementary', 'triadic', 'shades', 'random'];
export const CVD_TYPES = ['none', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

// ── Contrast ──────────────────────────────────────────────────────
const toLinear = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const fromLinear = c => { c = clamp(c, 0, 1); return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055); };

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const INK_DARK = '#0c100c', INK_LIGHT = '#f3f6ee';
export function inkFor(hex) {
  return contrast(hex, INK_DARK) >= contrast(hex, INK_LIGHT) ? INK_DARK : INK_LIGHT;
}

// ── Generation ────────────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function hueOffset(mode, i, n) {
  switch (mode) {
    case 'analogous': return n < 2 ? 0 : -45 + (90 * i) / (n - 1);
    case 'complementary': return (i % 2 ? 180 : 0) + rand(-12, 12);
    case 'triadic': return (i % 3) * 120 + rand(-6, 6);
    case 'shades': return rand(-6, 6);
    default: return rand(0, 360); // random
  }
}

export function generatePalette({ count = 5, mode = 'analogous', locked = [], seedHex } = {}) {
  const n = clamp(Math.round(count) || 5, 1, 24);
  if (!MODES.includes(mode)) mode = 'analogous';
  const lockedNorm = Array.from({ length: n }, (_, i) => normalizeHex(locked && locked[i]) || null);
  const seed = normalizeHex(seedHex) || lockedNorm.find(Boolean);
  const baseHue = seed ? hexToHsl(seed)[0] : Math.random() * 360;

  // lightness spread 18-88
  let lights = Array.from({ length: n }, (_, i) => (n < 2 ? 55 : 18 + (70 * i) / (n - 1)));
  if (mode !== 'shades') shuffle(lights);
  const [sLo, sHi] = mode === 'shades' ? [30, 65] : [40, 80];

  return lockedNorm.map((lk, i) => {
    if (lk) return lk;
    const l = clamp(lights[i] + rand(-4, 4), 10, 94);
    const s = rand(sLo, sHi);
    return hslToHex(baseHue + hueOffset(mode, i, n), s, l);
  });
}

export function tints(hex) {
  const [h, s, l] = hexToHsl(hex);
  return [-30, -15, 15, 30].map(d => hslToHex(h, s, clamp(l + d, 4, 96)));
}

// ── Color-vision simulation (Machado 2009, severity 1.0) ──────────
const CVD_MATRICES = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};

export function simulate(hex, type = 'none') {
  const norm = normalizeHex(hex);
  if (!norm) return hex;
  if (type === 'achromatopsia') {
    const v = fromLinear(luminance(norm));
    return rgbToHex(v, v, v);
  }
  const m = CVD_MATRICES[type];
  if (!m) return norm;
  const lin = hexToRgb(norm).map(toLinear);
  const out = m.map(row => row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]);
  return rgbToHex(fromLinear(out[0]), fromLinear(out[1]), fromLinear(out[2]));
}

// ── Extract from image (k-means in RGB) ───────────────────────────
export function extractPalette(imageData, count = 5) {
  const { data, width, height } = imageData;
  const total = width * height;
  const step = Math.max(1, Math.floor(total / 4000));
  const pts = [];
  for (let p = 0; p < total; p += step) {
    const o = p * 4;
    if (data[o + 3] < 128) continue;
    pts.push([data[o], data[o + 1], data[o + 2]]);
  }
  if (!pts.length) return [];
  const k = Math.min(Math.max(1, count), pts.length);
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

  // k-means++ init
  const centers = [pts[Math.floor(Math.random() * pts.length)].slice()];
  while (centers.length < k) {
    const dist = pts.map(p => Math.min(...centers.map(c => d2(p, c))));
    const sum = dist.reduce((a, b) => a + b, 0);
    if (sum === 0) break;
    let r = Math.random() * sum, idx = 0;
    for (; idx < dist.length - 1; idx++) { r -= dist[idx]; if (r <= 0) break; }
    centers.push(pts[idx].slice());
  }

  let sizes = new Array(centers.length).fill(0);
  for (let it = 0; it < 12; it++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = d2(p, centers[c]);
        if (d < bd) { bd = d; best = c; }
      }
      const s = sums[best];
      s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    }
    sizes = sums.map(s => s[3]);
    sums.forEach((s, c) => { if (s[3]) centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }

  const order = centers.map((c, i) => [c, sizes[i]]).sort((a, b) => b[1] - a[1]);
  const out = [];
  for (const [c, size] of order) {
    if (!size) continue;
    const hex = rgbToHex(c[0], c[1], c[2]);
    if (!out.includes(hex)) out.push(hex);
  }
  return out;
}

// ── Serialization ─────────────────────────────────────────────────
export function toHash(palette) {
  return palette.map(h => (normalizeHex(h) || '#000000').slice(1)).join('-');
}

export function fromHash(str) {
  if (typeof str !== 'string') return null;
  const parts = str.replace(/^#/, '').split('-');
  if (parts.length < 2 || parts.length > 10) return null;
  const out = [];
  for (const p of parts) {
    if (!/^[0-9a-fA-F]{6}$/.test(p)) return null;
    out.push('#' + p.toLowerCase());
  }
  return out;
}

// ── Export formats ────────────────────────────────────────────────
export const formatHex = p => p.join('\n');
export const formatCss = p => ':root {\n' + p.map((c, i) => `  --color-${i + 1}: ${c};`).join('\n') + '\n}';
export const formatJson = p => JSON.stringify(p, null, 2);

// ── Site theme from a palette ─────────────────────────────────────
// Maps a whole palette onto the site's 7 theme vars, keeping text readable.
export function paletteToTheme(colors) {
  const list = (Array.isArray(colors) ? colors : []).map(normalizeHex).filter(Boolean);
  while (list.length < 2) list.push(list[0] || '#b8ffa0');
  const notes = [];
  const byLum = list.map((hex, i) => ({ hex, i, lum: luminance(hex) })).sort((a, b) => a.lum - b.lum);
  const dark = byLum[0], light = byLum[byLum.length - 1];

  // lighten until contrast vs bg reaches min (max L 96)
  const lift = (hex, bg, min) => {
    if (contrast(hex, bg) >= min) return hex;
    const [h, s, l] = hexToHsl(hex);
    for (let L = l + 2; L <= 96; L += 2) {
      const out = hslToHex(h, s, L);
      if (contrast(out, bg) >= min) return out;
    }
    return hslToHex(h, s, 96);
  };

  // bg
  let bg = dark.hex;
  if (dark.lum > 0.03) {
    const [h, s] = hexToHsl(dark.hex);
    bg = hslToHex(h, Math.min(s, 40), 6);
    notes.push(`darkened ${dark.hex} for the background`);
  }

  // primary
  const primary = lift(light.hex, bg, 7);
  if (primary !== light.hex) notes.push(`lightened ${light.hex} so text reads`);

  // accent: most saturated of the rest (or the primary when only 2 colors)
  const rest = byLum.slice(1, -1);
  let accentSrc = rest.length
    ? rest.reduce((a, b) => (hexToHsl(b.hex)[1] > hexToHsl(a.hex)[1] ? b : a))
    : light;
  const accent = lift(accentSrc.hex, bg, 3);
  if (accent !== accentSrc.hex) notes.push(`lightened ${accentSrc.hex} so the accent reads`);
  const [ah, as, al] = hexToHsl(accent);
  const accentHi = hslToHex(ah, as, Math.min(92, al + 12));

  // text-blue: another remaining color, readable on bg
  const cands = rest.filter(c => c !== accentSrc);
  let textBlue;
  if (cands.length) {
    const pick = cands.find(c => contrast(c.hex, bg) >= 4.5) || cands.reduce((a, b) => (b.lum > a.lum ? b : a));
    textBlue = lift(pick.hex, bg, 4.5);
    if (textBlue !== pick.hex) notes.push(`lightened ${pick.hex} so secondary text reads`);
  } else {
    const [ph, ps, pl] = hexToHsl(primary);
    textBlue = hslToHex(ph, ps, pl - 10);
  }

  const [ph, ps, pl] = hexToHsl(primary);
  const [bh, bs] = hexToHsl(bg);
  return {
    vars: {
      '--color-primary': primary,
      '--color-primary-dim': hslToHex(ph, ps * 0.6, pl - 5),
      '--color-bg': bg,
      '--color-border': hslToHex(bh, bs ? 25 : 0, 24),
      '--color-accent': accent,
      '--color-accent-hi': accentHi,
      '--color-text-blue': textBlue,
    },
    notes,
  };
}
