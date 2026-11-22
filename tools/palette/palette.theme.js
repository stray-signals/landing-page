// Apply / reset the site theme from a palette. Shared by the palette tool and the terminal.
const THEME_KEY = 'stray_theme';
const SAVED_KEY = 'stray_palettes';
export const THEME_VARS = [
  '--color-primary', '--color-primary-dim', '--color-bg', '--color-border',
  '--color-accent', '--color-accent-hi', '--color-text-blue',
];

export function applySiteTheme(vars) {
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  try { sessionStorage.setItem(THEME_KEY, JSON.stringify(vars)); } catch (e) { /* ignore */ }
}

export function resetSiteTheme() {
  for (const k of THEME_VARS) document.documentElement.style.removeProperty(k);
  try { sessionStorage.removeItem(THEME_KEY); } catch (e) { /* ignore */ }
}

export function getSavedPalettes() {
  try {
    const a = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(a)
      ? a.filter(x => x && Array.isArray(x.colors) && x.colors.length >= 2 && x.colors.length <= 10
          && x.colors.every(c => /^#[0-9a-f]{6}$/i.test(c)))
      : [];
  } catch (e) { return []; }
}
