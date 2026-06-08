const root = document.documentElement;

export default {
  name:        'theme',
  description: 'change primary color  theme <hex>',
  handler: (args) => {
    const hex = args.trim();
    if (!hex) return `current: ${getComputedStyle(root).getPropertyValue('--color-primary').trim()}`;

    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 'invalid hex. format: #rrggbb';

    // Derive a slightly dimmed variant for secondary uses
    const dim = hex + 'cc';
    root.style.setProperty('--color-primary',     hex);
    root.style.setProperty('--color-primary-dim',  dim);

    return `theme updated → ${hex}`;
  },
};
