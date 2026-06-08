// ── Stray console runner ───────────────────────────────────────────
// Logs staggered messages to the browser console.
// Called by each project page's inline module script.

const GREEN = 'color: #7fff7f; font-weight: bold';

export function runConsole(terminalMessages, directMessages) {
  const fromTerminal = sessionStorage.getItem('stray_ref') === 'terminal';
  sessionStorage.removeItem('stray_ref');

  const messages = fromTerminal ? terminalMessages : directMessages;

  messages.forEach((msg, i) => {
    setTimeout(() => {
      console.log('%c[stray]%c ' + msg, GREEN, '');
    }, i * 400);
  });
}
