import { formatLogEntry, resolveFile, fetchLogEntries } from './_utils.js';

export default {
  name:        'cat',
  description: 'read a file',
  usage:       'cat <file> [| grep <type>]',
  handler: async (args) => {
    const [fileArg, ...rest] = args.split('|').map(s => s.trim());
    const grepMatch = rest[0]?.match(/^grep\s+(\S+)$/);
    const filter    = grepMatch?.[1] ?? null;

    const { node, error } = resolveFile(fileArg);
    if (error) return `cat: ${error}`;

    const entries = await fetchLogEntries(node);
    if (!entries) return 'log corrupted. could not read.';

    const filtered = filter
      ? entries.filter(e => e.type === filter || e.signal_status === filter)
      : entries;

    if (!filtered.length) return filter
      ? `no entries matching [${filter}].`
      : 'log is empty.';

    return filtered.map(formatLogEntry).join('\n\n');
  },
};
