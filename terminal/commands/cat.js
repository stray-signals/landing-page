import { formatLogEntry } from './_utils.js';

export default {
  name:        'cat',
  description: 'read a log file',
  usage:       'cat transmissions.log [| grep <type>]',
  handler: async (args) => {
    const [file, ...rest] = args.split('|').map(s => s.trim());
    const grepMatch = rest[0]?.match(/^grep\s+(\S+)$/);
    const filter    = grepMatch?.[1] ?? null;

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
};
