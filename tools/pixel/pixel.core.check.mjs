// Self-check for pixel.core.js share encoding. Run: node tools/pixel/pixel.core.check.mjs
import assert from 'node:assert/strict';
import { encodeDoc, decodeDoc, HALF } from './pixel.core.js';

const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
const b64 = bytes => Buffer.from(bytes).toString('base64url');
const hex = n => '#' + [n * 11 % 256, n * 37 % 256, n * 73 % 256].map(v => v.toString(16).padStart(2, '0')).join('');

let seed = 3;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

// 128 doc, 3 frames, 20 colors, half pixels, small frame-to-frame differences
const np = 20, S = 128;
const doc = { w: S, h: S, palette: Array.from({ length: np }, (_, i) => hex(i + 1)), frames: [] };
const f0 = new Uint16Array(S * S);
for (let i = 0; i < f0.length; i++) f0[i] = Math.floor(rnd() * 4) === 0 ? 0 : (1 + Math.floor(rnd() * np)) | (rnd() < 0.2 ? HALF : 0);
doc.frames.push(f0);
for (let k = 1; k < 3; k++) {
  const f = doc.frames[k - 1].slice();
  for (let j = 0; j < 40; j++) f[Math.floor(rnd() * f.length)] = Math.floor(rnd() * (np + 1)) | (rnd() < 0.3 ? HALF : 0);
  doc.frames.push(f);
}
const enc = await encodeDoc(doc);
assert.deepEqual(await decodeDoc(enc), doc);

// v1 compatibility
{
  const d = { w: 16, h: 16, palette: [hex(1), hex(2), hex(3)], frames: [new Uint16Array(256), new Uint16Array(256)] };
  for (const f of d.frames) for (let i = 0; i < 256; i++) f[i] = Math.floor(rnd() * 4) | (rnd() < 0.3 ? HALF : 0);
  for (const f of d.frames) for (let i = 0; i < 256; i++) if ((f[i] & 0x7fff) === 0) f[i] = 0;
  const out = [1, d.w, d.h, d.palette.length];
  for (const c of d.palette) out.push(parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16));
  out.push(d.frames.length);
  for (const f of d.frames) for (const v of f) out.push(v & 255, v >> 8);
  const s = b64(await pipe(new Uint8Array(out), new CompressionStream('deflate-raw')));
  assert.deepEqual(await decodeDoc(s), d);
}

// sizes
const flat = { w: 128, h: 128, palette: [hex(1)], frames: [new Uint16Array(128 * 128).fill(1)] };
const noise = { w: 64, h: 64, palette: Array.from({ length: 32 }, (_, i) => hex(i + 1)), frames: [new Uint16Array(64 * 64)] };
for (let i = 0; i < 4096; i++) noise.frames[0][i] = Math.floor(rnd() * 33);
console.log('encoded length, flat 128 doc:', (await encodeDoc(flat)).length);
console.log('encoded length, noise 64 doc:', (await encodeDoc(noise)).length);
console.log('encoded length, round-trip doc (128, 3 frames):', enc.length);

// invalid input
{
  const raw = async bytes => b64(await pipe(new Uint8Array(bytes), new CompressionStream('deflate-raw')));
  const px = new Array(256).fill(0);
  const ok = [2, 16, 16, 1, 1, 2, 3, 1, ...px];
  assert.notEqual(await decodeDoc(await raw(ok)), null);
  assert.equal(await decodeDoc(await raw([9, ...ok.slice(1)])), null);
  assert.equal(await decodeDoc(await raw([...ok.slice(0, 8), 2, ...px.slice(1)])), null);
  assert.equal(await decodeDoc(await raw(ok.slice(0, -5))), null);
  assert.equal(await decodeDoc(enc.slice(0, 40)), null);
  assert.equal(await decodeDoc('!!'), null);
}
console.log('ok');
