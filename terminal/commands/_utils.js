// Shared utilities for commands that read transmissions/log.json

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
