import { formatLogEntry, resolveFile, fetchLogEntries, readProjectLog } from './_utils.js';

export default {
  name:        'tail',
  description: 'read the latest entry in a file',
  usage:       'tail <file>',
  handler: async (args) => {
    const { node, error } = resolveFile(args.trim());
    if (error) return `tail: ${error}`;

    if (node.kind === 'project-log') {
      return readProjectLog(node);
    }

    const entries = await fetchLogEntries(node);
    if (!entries) return 'log corrupted. could not read.';
    if (!entries.length) return 'log is empty.';

    return formatLogEntry(entries[0]);
  },
};
