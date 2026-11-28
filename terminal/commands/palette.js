import { getSavedPalettes } from '../../tools/palette/palette.theme.js';
import { MODES, generatePalette, normalizeHex } from '../../tools/palette/palette.color.js';

export default {
  name: 'palette',
  description: 'make a color palette  palette [#hex] [mode] | saved | apply <n> | reset',
  usage: 'palette [#hex] [mode] | palette saved | apply <n> | reset',
  handler: (args) => {
    const parts = args.trim().split(/\s+/).filter(Boolean);
    let seedHex;
    let mode = 'analogous';
    const sub = (parts[0] || '').toLowerCase();
    if (sub === 'saved') {
      const palettes = getSavedPalettes();
      if (!palettes.length) return 'no saved palettes yet. save one in the palette tool ("run palette").';
      return { action: 'paletteList', palettes };
    }
    if (sub === 'reset') return { action: 'paletteReset' };
    if (sub === 'apply') {
      if (parts[1] === undefined) {
        let colors = null;
        try { colors = JSON.parse(sessionStorage.getItem('stray_palette_state') || 'null')?.colors; } catch { /* ignore */ }
        if (!Array.isArray(colors) || colors.length < 2 || !colors.every(c => normalizeHex(c))) {
          return 'open the palette tool first ("run palette"), or use "palette apply <n>".';
        }
        return { action: 'paletteApply', colors: colors.map(normalizeHex), label: 'the palette from the tool' };
      }
      const n = /^\d+$/.test(parts[1]) ? Number(parts[1]) : 0;
      const p = getSavedPalettes()[n - 1];
      if (!p) return `palette: no saved palette ${parts[1]}. try "palette saved".`;
      return { action: 'paletteApply', colors: p.colors, label: `saved palette ${n}` };
    }
    if (parts[0]) {
      seedHex = normalizeHex(parts[0]);
      if (!seedHex) return `palette: "${parts[0]}" isn't a color. try palette #b8ffa0`;
    }
    if (parts[1]) {
      const m = parts[1].toLowerCase();
      if (!MODES.includes(m)) return `palette: unknown mode "${parts[1]}". modes: ${MODES.join(', ')}`;
      mode = m;
    }
    const colors = generatePalette({ count: 5, mode, locked: seedHex ? [seedHex] : [], seedHex });
    return { action: 'palette', colors };
  },
};
