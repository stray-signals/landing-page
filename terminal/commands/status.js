// ── Update this whenever Stray's situation changes ─────────────────
// Set listening: null to hide that line entirely.
export const STATUS = {
  mood:      'wandering',
  doing:     'building this terminal. it\'s not done yet.',
  listening: null,
  last_seen: 'the woods between signals',
};
// ───────────────────────────────────────────────────────────────────

export default {
  name:        'status',
  description: 'what stray is up to right now',
  handler: () => [
    `mood:      ${STATUS.mood}`,
    `doing:     ${STATUS.doing}`,
    STATUS.listening ? `listening: ${STATUS.listening}` : null,
    `last_seen: ${STATUS.last_seen}`,
  ].filter(Boolean).join('\n'),
};
