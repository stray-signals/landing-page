import { listCwd, getCwdString } from '../terminal.fs.js';

const COL_WIDTH = 24; // name column width

export default {
  name:        'ls',
  description: 'list current directory',
  handler: () => {
    const entries = Object.entries(listCwd());
    if (!entries.length) return '  (empty)';

    const lines = entries.map(([name, node]) => {
      const label = node.type === 'dir' ? `${name}/` : name;
      if (node.locked) {
        return `  ${label.padEnd(COL_WIDTH)}[signal lost]`;
      }
      return node.description
        ? `  ${label.padEnd(COL_WIDTH)}${node.description}`
        : `  ${label}`;
    });

    return lines.join('\n');
  },
};
