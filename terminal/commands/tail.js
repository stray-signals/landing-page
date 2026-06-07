import { formatLogEntry } from './_utils.js';

export default {
  name:        'tail',
  description: 'show the most recent log entries',
  usage:       'tail transmissions.log',
  handler: async (args) => {
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
};
