import { REGISTRY }                                    from './commands/index.js';
import { addMessage, editableSpan, terminalPanel, promptEl, placeCaretAtEnd } from './terminal.render.js';
import { getInputMode, startTransmitMode, exitMessageMode, submitMessage }    from './terminal.input.js';
import { resetIdleTimer }                              from '../avatar/avatar.js';
import { getTimeBlock, TIME_BLOCKS }                   from '../scripts/time.js';
import { getCwdString }                                from './terminal.fs.js';

const timeBlock   = TIME_BLOCKS[getTimeBlock()];
const BASE_PROMPT = timeBlock.prompt; // e.g. 'stray@signal[drifting]:~$'

function buildPrompt() {
  const path = getCwdString(); // '~' or '~/logs'
  return BASE_PROMPT.replace(':~$', `:${path}$`);
}

// ── Command dispatch ───────────────────────────────────────────────
async function processCommand(input) {
  const trimmed = input.trim();
  if (!trimmed) return;

  const [name, ...rest] = trimmed.toLowerCase().split(/\s+/);
  const args = rest.join(' ');

  const command = REGISTRY.get(name);
  if (!command) {
    document.dispatchEvent(new CustomEvent('avatar:unknowncommand'));
    addMessage('stray', `command not recognized: "${name}". try "help".`);
    return;
  }

  let result = command.handler(args);

  if (result instanceof Promise) {
    addMessage('stray', 'scanning...');
    try {
      result = await result;
    } catch {
      addMessage('stray', 'signal lost. try again.');
      return;
    }
  }

  if (result?.action === 'clear')         { document.getElementById('commandHistory').innerHTML = ''; }
  else if (result?.action === 'startTransmit') { startTransmitMode(); }
  else if (result?.action === 'cd')       { promptEl.textContent = buildPrompt(); }
  else if (typeof result === 'string')    { addMessage('stray', result); }
}

// ── Input handling ─────────────────────────────────────────────────
editableSpan.addEventListener('keydown', async (e) => {
  resetIdleTimer();

  if (e.key === 'Enter') {
    e.preventDefault();
    const text = editableSpan.textContent;
    editableSpan.textContent = '';
    placeCaretAtEnd(editableSpan);

    if (getInputMode() === 'message') {
      if (text.trim()) {
        await submitMessage(text.trim());
      } else {
        addMessage('stray', 'transmission cancelled.');
        exitMessageMode();
      }
      return;
    }

    if (text.trim()) addMessage('visitor', text);
    document.dispatchEvent(new CustomEvent('avatar:submit'));
    processCommand(text);
    return;
  }

  document.dispatchEvent(new CustomEvent('avatar:keydown'));
});

terminalPanel.addEventListener('click', (e) => {
  resetIdleTimer();
  if (e.target !== editableSpan && !editableSpan.contains(e.target)) {
    placeCaretAtEnd(editableSpan);
  }
});

editableSpan.addEventListener('focus', () => { resetIdleTimer(); placeCaretAtEnd(editableSpan); });
editableSpan.addEventListener('input', resetIdleTimer);
document.body.addEventListener('click', resetIdleTimer);

// ── Avatar events ──────────────────────────────────────────────────
document.addEventListener('avatar:overtapped', () => {
  addMessage('stray', 'hey. stop tapping my screen.');
});

// ── Init ───────────────────────────────────────────────────────────
promptEl.textContent = buildPrompt();

timeBlock.greeting.forEach((line, i) => {
  setTimeout(() => addMessage('stray', line), i * 500);
});

editableSpan.focus();
placeCaretAtEnd(editableSpan);
