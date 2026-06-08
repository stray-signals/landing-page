// ── Command registry ───────────────────────────────────────────────
// To add a new command:
//   1. Create terminal/commands/yourcommand.js
//   2. Import it below and add it to the commands array
// ──────────────────────────────────────────────────────────────────

import whois    from './whois.js';
import status   from './status.js';
import ls       from './ls.js';
import cd       from './cd.js';
import cat      from './cat.js';
import tail     from './tail.js';
import freq     from './freq.js';
import transmit from './transmit.js';
import mentions from './mentions.js';
import clear    from './clear.js';

const commands = [
  whois,
  status,
  ls,
  cd,
  cat,
  tail,
  freq,
  transmit,
  mentions,
  clear,
];

export const REGISTRY = new Map(commands.map(cmd => [cmd.name, cmd]));

// Help is defined here since it needs access to the full registry
REGISTRY.set('help', {
  name:        'help',
  description: 'list available commands',
  handler: () => {
    const lines = [''];
    for (const [name, cmd] of REGISTRY) {
      lines.push(`  ${name.padEnd(10)} ${cmd.description}`);
    }
    return lines.join('\n');
  },
});
