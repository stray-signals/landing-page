import { getTimeBlock, TIME_BLOCKS } from '../js/time.js';
import { play, stop, isPlaying, getNowPlaying } from '../js/player.js';

export const COMMANDS = new Map();

// ─── Manually updated ────────────────────────────────────────────
// Change STATUS whenever Stray's situation changes.
// Set listening: null to hide that line entirely.
export const STATUS = {
  mood:      'wandering',
  doing:     'building this terminal. it\'s not done yet.',
  listening: null,
  last_seen: 'the woods between signals',
};
// ─────────────────────────────────────────────────────────────────

COMMANDS.set('whoami', {
  description: 'Who is StraySignal?',
  run: () => TIME_BLOCKS[getTimeBlock()].whoami,
});

COMMANDS.set('status', {
  description: 'What is Stray up to right now?',
  run: () => [
    `mood:      ${STATUS.mood}`,
    `doing:     ${STATUS.doing}`,
    STATUS.listening ? `listening: ${STATUS.listening}` : null,
    `last_seen: ${STATUS.last_seen}`,
  ].filter(Boolean).join('\n'),
});

COMMANDS.set('ls', {
  description: 'List available locations',
  run: () => [
    'drwxr-xr-x  projects/    — dev work & experiments',
    'drwxr-xr-x  models/      — 3d model showcase',
    'drwxr-xr-x  portals/     — homelab gateways',
    '-rw-r--r--  signal.log   — run "status" to read',
  ].join('\n'),
});

COMMANDS.set('freq', {
  description: 'Play/stop audio transmissions. "freq stop" to end.',
  run: (args) => {
    if (args === 'stop') {
      return stop()
        ? 'transmission ended.'
        : 'nothing is broadcasting.';
    }
    if (isPlaying()) {
      const np = getNowPlaying();
      return `broadcasting: ${np.label}`;
    }
    const result = play();
    return `>> ${result.track.label}\ntransmission active.`;
  },
});

COMMANDS.set('contact', {
  description: "Stray's signal card",
  run: () => [
    '--- SIGNAL CARD ---',
    'entity:  StraySignal',
    'domain:  straysignals.dev',
    'signal:  contact@straysignals.dev',
    'source:  github.com/stray-signals',
    '-------------------',
    'you can also reach me the old-fashioned way.',
  ].join('\n'),
});

COMMANDS.set('links', {
  description: 'Sites Stray recommends',
  run: () => ({ action: 'showLinks' }),
});

COMMANDS.set('msg', {
  description: 'Leave a message for Stray',
  run: () => ({ action: 'startMsg' }),
});

COMMANDS.set('help', {
  description: 'List available commands',
  run: () => `available: ${[...COMMANDS.keys()].join(', ')}`,
});

COMMANDS.set('clear', {
  description: 'Clear the terminal',
  run: () => ({ action: 'clear' }),
});
