import { getCwd, setCwd } from '../terminal.fs.js';

export default {
  name:        'cd',
  description: 'change directory',
  usage:       'cd <dir> | cd ..',
  handler: (args) => {
    const target = args.trim();
    if (!target) return { action: 'cd', path: [] }; // cd with no args → root

    let newPath;
    if (target === '..') {
      const current = getCwd();
      newPath = current.slice(0, -1); // go up one level
    } else if (target === '~' || target === '/') {
      newPath = [];
    } else {
      newPath = [...getCwd(), target];
    }

    const err = setCwd(newPath);
    if (err) return err; // return error string to terminal

    return { action: 'cd', path: newPath };
  },
};
