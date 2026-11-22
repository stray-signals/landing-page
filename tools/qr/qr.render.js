// Pure QR -> SVG renderer. No DOM access.
import qrcode from '../vendor/qrcode-generator.js';

qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

export const DOT_STYLES = ['square', 'rounded', 'dots', 'pixel'];
export const CORNER_STYLES = ['square', 'rounded', 'circle'];
export const LOGOS = ['none', 'stray', 'upload'];

// Stray's default face (eyes "normal" + mouth "flat"), cropped from the 64x32 avatar grid.
const FACE = (() => {
  const blank = '.'.repeat(64);
  const eye = [
    '................@@@@@@@.................@@@@@@@.................',
    '................@@@@@@@@................@@@@@@@@................',
    '................@@@@@@@@................@@@@@@@@................',
    '................@@@@@@@@................@@@@@@@@................',
    '................@@@@@@@@................@@@@@@@@................',
    '................@@@@@@@@................@@@@@@@@................',
    '................@@@@@@@@................@@@@@@@@................',
    '.................@@@@@@@.................@@@@@@@................',
  ];
  const mouth = [
    '..................@@@@@@@@@@@@@@@@@@@@@@@@@@@@..................',
    '................@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@..................',
  ];
  return [blank, ...eye, blank, blank, blank, blank, blank, ...mouth, blank, blank].map(r => r.slice(12, 52));
})();

const f = v => +v.toFixed(3);

export function parseColor(s, fallback) {
  s = String(s || '').trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return '#' + m[1].split('').map(ch => ch + ch).join('').toLowerCase();
  m = /^#([0-9a-f]{6})/i.exec(s);
  if (m) return '#' + m[1].toLowerCase();
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(s);
  if (m) return '#' + [m[1], m[2], m[3]].map(v => Math.min(255, +v).toString(16).padStart(2, '0')).join('');
  return fallback;
}

function luminance(hex) {
  const ch = [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function renderQrSvg(text, opts = {}) {
  const dots = DOT_STYLES.includes(opts.dots) ? opts.dots : 'rounded';
  const corners = CORNER_STYLES.includes(opts.corners) ? opts.corners : 'rounded';
  const dotColor = parseColor(opts.dotColor, '#0c100c');
  const cornerColor = parseColor(opts.cornerColor, dotColor);
  const bgColor = parseColor(opts.bgColor, '#b8ffa0');
  const margin = Math.max(0, Math.min(8, Math.round(Number.isFinite(+opts.margin) ? +opts.margin : 4)));
  const logoImage = typeof opts.logoImage === 'string' && /^data:image\//i.test(opts.logoImage) ? opts.logoImage : null;
  const logo = opts.logo === 'stray' ? 'stray' : (opts.logo === 'upload' && logoImage ? 'upload' : 'none');
  const ecl = logo !== 'none' ? 'H' : (['L', 'M', 'Q', 'H'].includes(opts.ecl) ? opts.ecl : 'Q');

  const l1 = luminance(dotColor), l2 = luminance(bgColor);
  const contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  const warnings = [];
  if (contrast < 4) warnings.push('low contrast — phones may not read it');
  if (l1 > l2) warnings.push("light dots on dark — some scanners can't read this");
  if (margin < 2) warnings.push('small margin — leave room around it when printing');

  const out = { svg: null, modules: 0, ecl, warnings, contrast };
  if (!text || !String(text).trim()) return out;

  let n, m = [];
  try {
    const q = qrcode(0, ecl);
    q.addData(String(text));
    q.make();
    n = q.getModuleCount();
    for (let r = 0; r < n; r++) { m.push([]); for (let c = 0; c < n; c++) m[r].push(q.isDark(r, c)); }
  } catch (e) {
    warnings.unshift('too much text for one code — shorten it');
    return out;
  }
  out.modules = n;

  const M = margin, T = n + 2 * M;
  let hole = null;
  if (logo !== 'none') { let s = Math.round(n * 0.27); if (s % 2 === 0) s++; hole = { a: (n - s) / 2, s }; }
  const finder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const inHole = (r, c) => hole && r >= hole.a && r < hole.a + hole.s && c >= hole.a && c < hole.a + hole.s;
  const on = (r, c) => r >= 0 && c >= 0 && r < n && c < n && m[r][c] && !finder(r, c) && !inHole(r, c);

  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!on(r, c)) continue;
    const x = c + M, y = r + M;
    switch (dots) {
      case 'dots': { const R = 0.46; d += `M${f(x + 0.5 - R)} ${f(y + 0.5)}a${R} ${R} 0 1 0 ${f(2 * R)} 0a${R} ${R} 0 1 0 ${f(-2 * R)} 0Z`; break; }
      case 'pixel': d += `M${f(x + 0.09)} ${f(y + 0.09)}h0.82v0.82h-0.82Z`; break;
      case 'rounded': {
        const u = on(r - 1, c), dn = on(r + 1, c), l = on(r, c - 1), rt = on(r, c + 1), R = 0.5;
        const tl = !u && !l ? R : 0, tr = !u && !rt ? R : 0, br = !dn && !rt ? R : 0, bl = !dn && !l ? R : 0;
        d += `M${f(x + tl)} ${y}H${f(x + 1 - tr)}` + (tr ? `A${R} ${R} 0 0 1 ${x + 1} ${f(y + tr)}` : '') +
             `V${f(y + 1 - br)}` + (br ? `A${R} ${R} 0 0 1 ${f(x + 1 - br)} ${y + 1}` : '') +
             `H${f(x + bl)}` + (bl ? `A${R} ${R} 0 0 1 ${x} ${f(y + 1 - bl)}` : '') +
             `V${f(y + tl)}` + (tl ? `A${R} ${R} 0 0 1 ${f(x + tl)} ${y}` : '') + 'Z';
        break;
      }
      default: d += `M${x} ${y}h1v1h-1Z`;
    }
  }

  let eyes = '';
  const rr = (X, Y, w, rad) => rad ? `M${f(X + rad)} ${Y}H${f(X + w - rad)}A${rad} ${rad} 0 0 1 ${X + w} ${f(Y + rad)}V${f(Y + w - rad)}A${rad} ${rad} 0 0 1 ${f(X + w - rad)} ${Y + w}H${f(X + rad)}A${rad} ${rad} 0 0 1 ${X} ${f(Y + w - rad)}V${f(Y + rad)}A${rad} ${rad} 0 0 1 ${f(X + rad)} ${Y}Z` : `M${X} ${Y}h${w}v${w}h${-w}Z`;
  const circ = (cx, cy, R) => `M${f(cx - R)} ${cy}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z`;
  for (const [er, ec] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const x = ec + M, y = er + M;
    let ring, dot;
    switch (corners) {
      case 'rounded': ring = rr(x, y, 7, 2.2) + rr(x + 1, y + 1, 5, 1.4); dot = rr(x + 2, y + 2, 3, 0.9); break;
      case 'circle': ring = circ(x + 3.5, y + 3.5, 3.5) + circ(x + 3.5, y + 3.5, 2.5); dot = circ(x + 3.5, y + 3.5, 1.5); break;
      default: ring = rr(x, y, 7, 0) + rr(x + 1, y + 1, 5, 0); dot = rr(x + 2, y + 2, 3, 0);
    }
    eyes += `<path d="${ring}" fill-rule="evenodd" fill="${cornerColor}"/><path d="${dot}" fill="${cornerColor}"/>`;
  }

  let logoSvg = '';
  if (hole) {
    const X = hole.a + M, s = hole.s, pad = 0.35, b = f(s - 2 * pad);
    if (logo === 'stray') {
      logoSvg += `<rect x="${f(X + pad)}" y="${f(X + pad)}" width="${b}" height="${b}" rx="0.9" fill="${dotColor}" stroke="${bgColor}" stroke-width="0.18"/>`;
      const cell = (s - 2 * pad) * 0.8 / 40, ox = X + (s - 40 * cell) / 2, oy = X + (s - FACE.length * cell) / 2;
      let fd = '';
      FACE.forEach((row, ri) => { let c = 0; while (c < 40) { if (row[c] === '@') { let e = c; while (e < 40 && row[e] === '@') e++; fd += `M${f(ox + c * cell)} ${f(oy + ri * cell)}h${f((e - c) * cell)}v${f(cell)}h${f(-(e - c) * cell)}Z`; c = e; } else c++; } });
      logoSvg += `<path d="${fd}" fill="${bgColor}"/>`;
    } else {
      const inset = 0.7, iw = f(s - 2 * pad - 2 * inset);
      const href = logoImage.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      logoSvg += `<rect x="${f(X + pad)}" y="${f(X + pad)}" width="${b}" height="${b}" rx="0.9" fill="${bgColor}"/>` +
        `<image href="${href}" x="${f(X + pad + inset)}" y="${f(X + pad + inset)}" width="${iw}" height="${iw}" preserveAspectRatio="xMidYMid meet"/>`;
    }
  }

  const crisp = dots === 'square' && corners === 'square';
  out.svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${T} ${T}" shape-rendering="${crisp ? 'crispEdges' : 'geometricPrecision'}">` +
    `<rect width="${T}" height="${T}" fill="${bgColor}"/>` +
    `<path d="${d}" fill="${dotColor}"/>${eyes}${logoSvg}</svg>`;
  return out;
}
