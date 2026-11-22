// Self-check for pixel.convert.js. Run: node tools/pixel/pixel.convert.check.mjs
import assert from 'node:assert/strict';
import {
  parseCode, targetColors, convert, downscale, PATTERN_SETS, gifFrames, pixelScale, prepareSource, imageColors, borderColor,
} from './pixel.convert.js';
import { GifWriter, GifReader } from '../vendor/omggif.js';

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
assert.equal(targetColors(PAL, 'palette').length, 8);
assert.equal(targetColors(PAL, 'image').length, 8);
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
const all = convert(rgb, alpha, N, targetColors(PAL, 'palette'), { method: 'fs', rgb: true });
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

// pixelScale / prepareSource
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const six = Array.from({ length: 6 }, (_, i) => [i * 40 + 10, 255 - i * 35, (i * 90) % 256]);
const orig = Array.from({ length: 64 }, () => six[Math.floor(rnd() * 6)]);
const big = new Uint8ClampedArray(32 * 32 * 4);
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
  const c = orig[(y >> 2) * 8 + (x >> 2)];
  big.set([...c, 255], (y * 32 + x) * 4);
}
assert.equal(pixelScale(big, 32, 32), 4);
const grad = new Uint8ClampedArray(32 * 32 * 4);
for (let i = 0; i < 1024; i++) grad.set([(i % 32) * 8, (i >> 5) * 8, (i * 7) % 256, 255], i * 4);
assert.equal(pixelScale(grad, 32, 32), 1);
const prep = prepareSource([big], 32, 32, 16);
assert.equal(prep.pixelArt, true);
{
  const { rgb, alpha } = prep.frames[0];
  // art box is 8x8 plus a 1px margin clamped to the edge, so it is centered by the box
  let x0 = 16, y0 = 16, x1 = -1, y1 = -1;
  for (let i = 0; i < 256; i++) if (alpha[i]) { const x = i % 16, y = (i / 16) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  assert.equal(x1 - x0, 7); assert.equal(y1 - y0, 7);
  assert.equal(x0, 4); assert.equal(y0, 4);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const o = (y0 + y) * 16 + x0 + x;
    assert.deepEqual([rgb[o * 3], rgb[o * 3 + 1], rgb[o * 3 + 2]], orig[y * 8 + x]);
  }
}

// background removal
{
  const BGC = [90, 40, 120], sp = [[255, 200, 0], [10, 200, 90], [200, 30, 30], [30, 60, 240]];
  const img = new Uint8ClampedArray(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const gx = x >> 2, gy = y >> 2;
    const inSprite = gx >= 2 && gx < 6 && gy >= 2 && gy < 6;
    img.set([...(inSprite ? sp[(gx + gy) % 4] : BGC), 255], (y * 32 + x) * 4);
  }
  assert.deepEqual(borderColor([img], 32, 32), BGC);
  assert.equal(borderColor([grad], 32, 32), null);
  const keep = prepareSource([img], 32, 32, 16);
  assert.equal(keep.frames[0].alpha.filter(a => a).length, 64);
  const r = prepareSource([img], 32, 32, 16, { removeBg: true }).frames[0];
  let x0 = 16, y0 = 16, x1 = -1, y1 = -1;
  for (let i = 0; i < 256; i++) if (r.alpha[i]) { const x = i % 16, y = (i / 16) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  assert.equal(x1 - x0, 3); assert.equal(y1 - y0, 3);
  assert.equal(x0, 6); assert.equal(y0, 6);
  assert.ok(r.alpha[0] === 0 && r.alpha[255] === 0);
}

// gifFrames
{
  const buf = new Uint8Array(4096);
  const gw = new GifWriter(buf, 4, 4, { palette: [0xff0000, 0x00ff00, 0x0000ff, 0x000000], loop: 0 });
  gw.addFrame(0, 0, 4, 4, new Uint8Array(16).fill(0), { delay: 5, disposal: 0 });
  gw.addFrame(1, 1, 2, 2, new Uint8Array([2, 2, 2, 2]), { delay: 7, disposal: 2 });
  gw.addFrame(0, 0, 1, 1, new Uint8Array([1]), { delay: 3, disposal: 0 });
  const g = gifFrames(new GifReader(buf.subarray(0, gw.end())), 10);
  assert.equal(g.frames.length, 3); assert.deepEqual(g.delays, [5, 7, 3]);
  const px = (f, x, y) => [...g.frames[f].subarray((y * 4 + x) * 4, (y * 4 + x) * 4 + 4)];
  assert.deepEqual(px(0, 3, 3), [255, 0, 0, 255]);
  assert.deepEqual(px(1, 1, 1), [0, 0, 255, 255]); assert.deepEqual(px(1, 0, 0), [255, 0, 0, 255]);
  assert.deepEqual(px(2, 1, 1)[3], 0); assert.deepEqual(px(2, 0, 0), [0, 255, 0, 255]);
  assert.deepEqual(px(2, 3, 3), [255, 0, 0, 255]);
  assert.equal(gifFrames(new GifReader(buf.subarray(0, gw.end())), 2).frames.length, 2);
}

// imageColors
{
  const al = new Uint8Array(64).fill(255), few = new Float32Array(192);
  for (let i = 0; i < 64; i++) few.set(six[i % 6], i * 3);
  const got = imageColors([few], [al], 8);
  assert.equal(got.length, 6);
  assert.deepEqual(new Set(got.map(c => c.join())), new Set(six.map(c => c.join())));
  const many = new Float32Array(192);
  for (let i = 0; i < 192; i++) many[i] = Math.floor(rnd() * 256);
  assert.equal(imageColors([many], [al], 5).length, 5);
}

console.log('ok');
