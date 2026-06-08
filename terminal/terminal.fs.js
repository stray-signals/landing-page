import { listTracks } from '../js/player.js';

// ── Virtual filesystem ─────────────────────────────────────────────
// Each node: { type, description?, locked?, children?, listFn? }
// locked    → renders as [signal lost], cd is blocked
// listFn    → called at ls time to produce dynamic child list
// children  → static child nodes keyed by name

const filesystem = {
  type: 'dir',
  children: {
    logs: {
      type:        'dir',
      description: 'field notes',
      children: {
        'transmissions.log': {
          type:        'file',
          kind:        'log',
          description: "stray's drift log",
          src:         'root/transmissions/log.json',
        },
      },
    },
    media: {
      type:        'dir',
      description: 'audio transmissions',
      listFn: () => {
        return Object.fromEntries(
          listTracks().map(t => [t.label, {
            type:        'file',
            kind:        'audio',
            description: t.description ?? null,
            id:          t.id,
          }])
        );
      },
    },
    projects: { type: 'dir', locked: true },
    models:   { type: 'dir', locked: true },
    portals:  { type: 'dir', locked: true },
  },
};

// ── CWD state ──────────────────────────────────────────────────────
let cwd = []; // [] = root, ['logs'] = /logs, etc.

export function getCwd()       { return [...cwd]; }
export function getCwdString() { return cwd.length ? `~/${cwd.join('/')}` : '~'; }

// Resolve a node at a given path array. Returns null if not found.
export function getNode(pathArr = []) {
  let node = filesystem;
  for (const segment of pathArr) {
    const children = node.listFn ? node.listFn() : node.children;
    node = children?.[segment];
    if (!node) return null;
  }
  return node;
}

// Returns null on success, or an error string on failure.
export function setCwd(pathArr) {
  const node = getNode(pathArr);
  if (!node)            return `cd: ${pathArr.at(-1)}: no such directory`;
  if (node.type !== 'dir') return `cd: ${pathArr.at(-1)}: not a directory`;
  if (node.locked)      return `cd: ${pathArr.at(-1)}: [signal lost]`;
  cwd = [...pathArr];
  return null;
}

// Returns the children of the current directory.
export function listCwd() {
  const node = getNode(cwd);
  return node?.listFn ? node.listFn() : node?.children ?? {};
}
