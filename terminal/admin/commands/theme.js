const root = document.documentElement;

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
      .toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Derives a full site palette from a single hue, preserving the
// lightness/saturation relationships of the original green theme.
function buildPalette(hex) {
  const [h] = hexToHsl(hex);
  return {
    '--color-primary':     hslToHex(h, 100, 81),
    '--color-primary-dim': hslToHex(h,  51, 76),
    '--color-bg':          hslToHex(h,  14,  5),
    '--color-border':      hslToHex(h,  25, 24),
    '--color-accent':      hslToHex(h,  47, 46),
    '--color-accent-hi':   hslToHex(h,  68, 61),
  };
}

export let currentHex = '#b8ffa0'; // updated on each theme change

export default {
  name:        'theme',
  description: 'change site color theme  theme <hex>',
  handler: (args) => {
    const hex = args.trim().toLowerCase();
    if (!hex) return `current theme: ${currentHex}`;
    if (!/^#[0-9a-f]{6}$/.test(hex)) return 'invalid hex. format: #rrggbb';

    const palette = buildPalette(hex);
    for (const [key, val] of Object.entries(palette)) {
      root.style.setProperty(key, val);
    }
    currentHex = hex;
    return `theme updated → ${hex}`;
  },
};
