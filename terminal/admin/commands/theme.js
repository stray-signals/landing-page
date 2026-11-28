import { hexToHsl, hslToHex } from '/shared/color.js';

const root = document.documentElement;

// Derives a full site palette from a single hue, preserving the
// lightness/saturation relationships of the original green theme.
export function buildPalette(hex) {
  const [h] = hexToHsl(hex);
  return {
    '--color-primary': hslToHex(h, 100, 81),
    '--color-primary-dim': hslToHex(h, 51, 76),
    '--color-bg': hslToHex(h, 14, 5),
    '--color-border': hslToHex(h, 25, 24),
    '--color-accent': hslToHex(h, 47, 46),
    '--color-accent-hi': hslToHex(h, 68, 61),
  };
}

export let currentHex = '#b8ffa0'; // updated on each theme change

export default {
  name: 'theme',
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
