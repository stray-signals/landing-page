import { STATUS } from '../status.data.js';

export default {
  name:        'status',
  description: 'current diagnostics',
  handler: () => [
    `mood:      ${STATUS.mood}`,
    `doing:     ${STATUS.doing}`,
    STATUS.listening ? `listening: ${STATUS.listening}` : null,
    `last_seen: ${STATUS.last_seen}`,
  ].filter(Boolean).join('\n'),
};
