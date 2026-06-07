// Shared utilities for commands that read transmissions/log.json

export function formatLogEntry(e) {
  const header = `[${e.date}] [${e.type}]${e.target ? ' ' + e.target : ''}`;
  const lines  = [header, e.copy];
  if (e.url) lines.push(e.signal_sent ? '→ signal sent' : '→ signal pending');
  return lines.join('\n');
}
