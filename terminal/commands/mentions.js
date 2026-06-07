// ── Webmention.io config ──────────────────────────────────────────
// Read-only token — safe in client-side JS.
const WEBMENTION_TOKEN  = 't_NSa5SYEaAXu6tqCq5A3w';
const WEBMENTION_DOMAIN = 'straysignals.dev';
// ─────────────────────────────────────────────────────────────────

export default {
  name:        'mentions',
  description: 'show incoming transmissions from across the web',
  handler: async () => {
    const url = `https://webmention.io/api/mentions.jf2?domain=${WEBMENTION_DOMAIN}&token=${WEBMENTION_TOKEN}&per-page=10`;
    const res = await fetch(url);
    if (!res.ok) return 'could not reach the signal relay. try again later.';

    const data     = await res.json();
    const mentions = data.children ?? [];

    if (!mentions.length) return 'no transmissions received. the void is quiet.';

    const lines = [`${mentions.length} incoming transmission${mentions.length > 1 ? 's' : ''}:`, ''];
    mentions.forEach(m => {
      const from   = m.author?.name ?? m.url ?? 'unknown origin';
      const source = m.url ?? '';
      const type   = (m['wm-property'] ?? 'mention').replace('-of', '').replace('in-', '');
      const text   = m.content?.text
        ? ` — "${m.content.text.slice(0, 80)}${m.content.text.length > 80 ? '...' : ''}"`
        : '';
      lines.push(`[${type}] ${from}${text}`);
      if (source) lines.push(`        ${source}`);
    });

    return lines.join('\n');
  },
};
