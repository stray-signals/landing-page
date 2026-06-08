import { getCwd, getNode } from '../terminal.fs.js';

// ── Log entry formatting ───────────────────────────────────────────
export function formatLogEntry(e) {
  const header = `[${e.date}] [${e.type}]${e.target ? ' ' + e.target : ''}`;
  const lines  = [header, e.copy];
  if (e.url) {
    const statusMap = {
      sent:        '→ signal sent',
      pending:     '→ signal pending',
      no_endpoint: '→ signal failed: no endpoint found',
      failed:      '→ signal failed',
    };
    lines.push(statusMap[e.signal_status] ?? '→ signal pending');
  }
  return lines.join('\n');
}

// ── File resolution ────────────────────────────────────────────────
// Returns { node } on success or { error } on failure.
export const KIND_ERRORS = {
  audio: "binary transmission. use `freq` to play it.",
};

export function resolveFile(fileArg) {
  if (!fileArg) return { error: 'missing filename' };

  const node = getNode([...getCwd(), fileArg]);
  if (!node)               return { error: `${fileArg}: no such file` };
  if (node.type === 'dir') return { error: `${fileArg}: is a directory` };
  const readable = node.kind === 'log' || node.kind === 'project-log';
  if (!readable)           return { error: KIND_ERRORS[node.kind] ?? `${fileArg}: unreadable` };

  return { node };
}

// Returns the content of a project-log node as a formatted string.
export function readProjectLog(node) {
  return node.content.join('\n');
}

// ── Log fetching ───────────────────────────────────────────────────
// Fetches and returns entries sorted newest-first, or null on failure.
export async function fetchLogEntries(node) {
  const res = await fetch(node.src);
  if (!res.ok) return null;
  return (await res.json()).sort((a, b) => b.date.localeCompare(a.date));
}
