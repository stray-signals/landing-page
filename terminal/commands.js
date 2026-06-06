import { getTimeBlock, TIME_BLOCKS } from '../js/time.js';
import { play, stop, isPlaying, getNowPlaying } from '../js/player.js';

// ── Webmention.io config ──────────────────────────────────────────
// Paste your token from webmention.io here.
// It's a read-only token so it's safe in client-side JS.
const WEBMENTION_TOKEN  = 't_NSa5SYEaAXu6tqCq5A3w';
const WEBMENTION_DOMAIN = 'straysignals.dev';
// ─────────────────────────────────────────────────────────────────

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

COMMANDS.set('cat', {
  description: 'Read a log file. try: cat transmissions.log',
  run: async (args) => {
    // Parse optional pipe: cat transmissions.log | grep [type]
    const [file, ...rest] = args.split('|').map(s => s.trim());
    const grepMatch = rest[0]?.match(/^grep\s+(\S+)$/);
    const filter = grepMatch?.[1] ?? null;

    if (file !== 'transmissions.log') {
      return `cat: ${file || '?'}: no such file in this signal`;
    }

    const res = await fetch('transmissions/log.json');
    if (!res.ok) return 'log corrupted. could not read.';

    let entries = (await res.json())
      .sort((a, b) => b.date.localeCompare(a.date));

    if (filter) {
      entries = entries.filter(e =>
        e.type === filter ||
        (filter === 'signal' && e.signal_sent)
      );
    }

    if (!entries.length) return filter
      ? `no entries matching [${filter}].`
      : 'log is empty.';

    return entries.map(formatLogEntry).join('\n\n');
  },
});

COMMANDS.set('tail', {
  description: 'Show most recent log entries. try: tail transmissions.log',
  run: async (args) => {
    if (args.trim() !== 'transmissions.log') {
      return `tail: ${args.trim() || '?'}: no such file in this signal`;
    }

    const res = await fetch('transmissions/log.json');
    if (!res.ok) return 'log corrupted. could not read.';

    const entries = (await res.json())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);

    if (!entries.length) return 'log is empty.';
    return entries.map(formatLogEntry).join('\n\n');
  },
});

function formatLogEntry(e) {
  const header = `[${e.date}] [${e.type}]${e.target ? ' ' + e.target : ''}`;
  const lines  = [header, e.copy];
  if (e.url) lines.push(e.signal_sent ? '→ signal sent' : '→ signal pending');
  return lines.join('\n');
}

COMMANDS.set('msg', {
  description: 'Leave a message for Stray',
  run: () => ({ action: 'startMsg' }),
});

COMMANDS.set('mentions', {
  description: 'Show incoming transmissions from across the web',
  run: async () => {
    const url = `https://webmention.io/api/mentions.jf2?domain=${WEBMENTION_DOMAIN}&token=${WEBMENTION_TOKEN}&per-page=10`;
    const res = await fetch(url);
    if (!res.ok) return 'could not reach the signal relay. try again later.';

    const data = await res.json();
    const mentions = data.children ?? [];

    if (!mentions.length) return 'no transmissions received. the void is quiet.';

    const lines = [`${mentions.length} incoming transmission${mentions.length > 1 ? 's' : ''}:`, ''];
    mentions.forEach(m => {
      const from   = m.author?.name ?? m.url ?? 'unknown origin';
      const source = m.url ?? '';
      const type   = (m['wm-property'] ?? 'mention').replace('-of', '').replace('in-', '');
      const text   = m.content?.text ? ` — "${m.content.text.slice(0, 80)}${m.content.text.length > 80 ? '...' : ''}"` : '';
      lines.push(`[${type}] ${from}${text}`);
      if (source) lines.push(`        ${source}`);
    });

    return lines.join('\n');
  },
});

COMMANDS.set('help', {
  description: 'List available commands',
  run: () => `available: ${[...COMMANDS.keys()].join(', ')}`,
});

COMMANDS.set('clear', {
  description: 'Clear the terminal',
  run: () => ({ action: 'clear' }),
});
