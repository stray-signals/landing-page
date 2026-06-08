// ── Stray console runner ───────────────────────────────────────────
// Logs staggered messages to the browser console.
// Called by each project page's inline module script.

const GREEN = 'color: #7fff7f; font-weight: bold';

export function runConsole(terminalMessages, directMessages) {
  const params = new URLSearchParams(window.location.search);
  const fromTerminal = params.get('ref') === 'terminal';

  // Strip ?ref=terminal from the address bar
  if (fromTerminal) {
    const clean = window.location.pathname + window.location.hash;
    history.replaceState(null, '', clean);
  }

  const messages = fromTerminal ? terminalMessages : directMessages;

  messages.forEach((msg, i) => {
    setTimeout(() => {
      console.log('%c[stray]%c ' + msg, GREEN, '');
    }, i * 400);
  });
}
