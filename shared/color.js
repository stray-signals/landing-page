// Color conversions shared by the palette tool, the terminal theme command and others.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function normalizeHex(str) {
  if (typeof str !== 'string') return null;
  let s = str.trim().toLowerCase().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(s)) s = s.split('').map(c => c + c).join('');
  return /^[0-9a-f]{6}$/.test(s) ? '#' + s : null;
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex) || '#000000';
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}

// returns [h 0-359, s 0-100, l 0-100]
export function hexToHsl(hex) {
  const [R, G, B] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) * 60;
    else if (max === G) h = ((B - R) / d + 2) * 60;
    else h = ((R - G) / d + 4) * 60;
  }
  return [Math.round(h) % 360, Math.round(s * 100), Math.round(l * 100)];
}

export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
