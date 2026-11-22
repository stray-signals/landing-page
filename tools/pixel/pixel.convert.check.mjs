// Self-check for pixel.convert.js. Run: node tools/pixel/pixel.convert.check.mjs
import assert from 'node:assert/strict';
import { parseCode, targetColors, convert, downscale, PATTERN_SETS } from './pixel.convert.js';

// 1. parseCode
const plain = '[\n  "@%.",\n  ".@@",\n]';
const p1 = parseCode(plain);
assert.deepEqual(p1.rows, ['@%.', '.@@']);
assert.equal(p1.w, 3); assert.equal(p1.h, 2); assert.equal(p1.legend, null);
const withLegend = '// legend: . = empty, a = #b8ffa0, b = #0c100c\n// (uppercase = 50%)\n[\n  "aAb",\n  ".Bb",\n]';
const p2 = parseCode(withLegend);
assert.deepEqual(p2.rows, ['aAb', '.Bb']);
assert.equal(p2.legend.get('a'), '#b8ffa0'); assert.equal(p2.legend.get('b'), '#0c100c');
assert.equal(parseCode('["ab","a"]'), null);
assert.equal(parseCode('nothing'), null);

// 2. targetColors
const PAL = ['#b8ffa0', '#0c100c', '#ff5d6c', '#ffb347', '#ffe66d', '#4ecb71', '#4aa3ff', '#b57bff'];
const lumOf = c => 0.299 * c.rgb[0] + 0.587 * c.rgb[1] + 0.114 * c.rgb[2];
const t1 = targetColors(PAL, 1);
assert.equal(t1.length, 2);
assert.equal(t1[0].idx, 1);
const t2 = targetColors(PAL, 2);
assert.equal(t2.length, 4);
assert.equal(new Set(t2.map(c => c.idx)).size, 4);
for (let i = 1; i < t2.length; i++) assert.ok(lumOf(t2[i - 1]) <= lumOf(t2[i]));
assert.equal(targetColors(PAL, 'all').length, 8);
assert.equal(targetColors(['#000000', '#000000'], 2).length, 1);

// 3. convert on a gradient
const N = 16, rgb = new Float32Array(N * N * 3), alpha = new Uint8Array(N * N).fill(255);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) rgb.fill(Math.round(x / (N - 1) * 255), (y * N + x) * 3, (y * N + x) * 3 + 3);
const allowed = new Set(t1.map(c => c.idx + 1));
const flat = convert(rgb, alpha, N, t1, { method: 'none' });
for (const v of flat) assert.ok(allowed.has(v));
for (let y = 0; y < N; y++) {
  assert.equal(flat[y * N], t1[0].idx + 1);
  assert.equal(flat[y * N + N - 1], t1[1].idx + 1);
}
const light = t1[1].idx + 1;
const bay = convert(rgb, alpha, N, t1, { method: 'bayer4' });
const share = (a, b) => { let c = 0; for (let y = 0; y < N; y++) for (let x = a; x < b; x++) if (bay[y * N + x] === light) c++; return c / (N * (b - a)); };
assert.ok(share(0, 5) < share(5, 11) && share(5, 11) < share(11, 16), 'light share rises');
const bnd = convert(rgb, alpha, N, t1, { method: 'bands', bands: 5, speck: 0, tiles: PATTERN_SETS.dots.tiles });
for (const v of bnd) assert.ok(allowed.has(v));
for (const m of ['bayer2', 'bayer8', 'fs', 'atkinson', 'pattern']) {
  for (const v of convert(rgb, alpha, N, t2, { method: m })) assert.ok(v > 0);
}
const all = convert(rgb, alpha, N, targetColors(PAL, 'all'), { method: 'fs', rgb: true });
assert.equal(all.length, N * N);

// 4. alpha
const a2 = alpha.slice(); a2[5] = 127; a2[6] = 128;
const out = convert(rgb, a2, N, t1, { method: 'none' });
assert.equal(out[5], 0); assert.ok(out[6] > 0);

// downscale
const src = new Uint8ClampedArray(4 * 4 * 4).fill(255);
const d = downscale(src, 4, 4, 3);
assert.equal(d.rgb.length, 27); assert.equal(d.alpha[4], 255);
assert.ok(Math.abs(d.rgb[0] - 255) < 1e-3);
const up = downscale(src, 4, 2, 8);
assert.equal(up.alpha.length, 64);

console.log('ok');
