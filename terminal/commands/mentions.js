// ── Webmention.io config ──────────────────────────────────────────
// Read-only token - safe in client-side JS.
const WEBMENTION_TOKEN  = 't_NSa5SYEaAXu6tqCq5A3w';
const WEBMENTION_DOMAIN = 'straysignals.dev';
// ─────────────────────────────────────────────────────────────────

const TYPE_LABEL = {
  'in-reply-to':  'reply',
  'like-of':      'like',
  'repost-of':    'repost',
  'bookmark-of':  'bookmark',
  'mention-of':   'mention',
};

export default {
  name:        'mentions',
  description: 'show incoming transmissions',
  handler: async () => {
    const url = `https://webmention.io/api/mentions.jf2?domain=${WEBMENTION_DOMAIN}&token=${WEBMENTION_TOKEN}&per-page=10`;
    const res = await fetch(url);
    if (!res.ok) return 'could not reach the signal relay. try again later.';

    const data     = await res.json();
    const mentions = data.children ?? [];

    if (!mentions.length) return 'no transmissions received. the void is quiet.';

    const blocks = mentions.map(m => {
      const author = m.author?.name ?? m.author?.url ?? 'unknown';
      const type   = TYPE_LABEL[m['wm-property']] ?? 'mention';
      const text   = m.content?.text
        ? `"${m.content.text.slice(0, 120)}${m.content.text.length > 120 ? '...' : ''}"`
        : null;
      const source = m.url ?? null;

      const lines = [`@${author} [${type}]`];
      if (text)   lines.push(text);
      if (source) lines.push(`↳ ${source}`);
      return lines.join('\n');
    });

    return `${mentions.length} incoming transmission${mentions.length > 1 ? 's' : ''}:\n\n${blocks.join('\n\n')}`;
  },
};
