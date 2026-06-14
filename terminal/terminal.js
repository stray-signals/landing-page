import { REGISTRY }                                          from './commands/index.js';
import { ADMIN_REGISTRY }                                     from './admin/commands/index.js';
import { addMessage, editableSpan, terminalPanel, promptEl, placeCaretAtEnd } from './terminal.render.js';
import { getInputMode, startTransmitMode, exitMessageMode, submitMessage } from './terminal.input.js';
import { resetIdleTimer }                                     from '../avatar/avatar.js';
import { getTimeBlock, TIME_BLOCKS }                          from '../scripts/time.js';
import { getCwdString }                                       from './terminal.fs.js';
import { storePat, clearPat }   from './admin/auth.js';
import { handleLog }            from './admin/commands/log.js';

const timeBlock   = TIME_BLOCKS[getTimeBlock()];
const BASE_PROMPT = timeBlock.prompt;

let isAdmin = false;

function buildPrompt() {
  const path = getCwdString();
  return BASE_PROMPT.replace(':~$', `:${path}$`);
}

function getRegistry() {
  return isAdmin ? ADMIN_REGISTRY : REGISTRY;
}

// ── Admin mode ─────────────────────────────────────────────────────
const dashboard = document.querySelector('.dashboard');

function activateAdmin() {
  isAdmin = true;
  dashboard.classList.add('admin-mode');
  promptEl.textContent = 'root@signal:~$';
  addMessage('stray', 'admin mode active. type "help" for commands.');
}

function deactivateAdmin() {
  isAdmin = false;
  clearPat();
  dashboard.classList.remove('admin-mode');
  promptEl.textContent = buildPrompt();
  addMessage('stray', 'logged out.');
}

document.addEventListener('terminal:adminlogin', () => {
  activateAdmin();
  editableSpan.focus();
});

// ── Command dispatch ───────────────────────────────────────────────
async function processCommand(input) {
  const trimmed = input.trim();
  if (!trimmed) return;

  const [name, ...rest] = trimmed.toLowerCase().split(/\s+/);
  const args = rest.join(' ');

  const command = getRegistry().get(name);
  if (!command) {
    document.dispatchEvent(new CustomEvent('avatar:unknowncommand'));
    addMessage('stray', `command not recognized: "${name}". try "help".`);
    return;
  }

  let result = command.handler(args);

  if (result instanceof Promise) {
    addMessage('stray', 'scanning...');
    try { result = await result; }
    catch { addMessage('stray', 'signal lost. try again.'); return; }
  }

  let responseText = '';
  if (result?.action === 'clear')          { document.getElementById('commandHistory').innerHTML = ''; }
  else if (result?.action === 'startTransmit') { startTransmitMode(); }
  else if (result?.action === 'cd')        { promptEl.textContent = buildPrompt(); }
  else if (result?.action === 'logout')    { deactivateAdmin(); }
  else if (result?.action === 'adminLog')  { handleLog(addMessage); }
  else if (typeof result === 'string')     { responseText = result; addMessage('stray', result); }

  dispatchResponding(responseText);
}

function dispatchResponding(text) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  document.dispatchEvent(new CustomEvent('avatar:responding', { detail: { words } }));
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
      if (text.trim()) { await submitMessage(text.trim()); }
      else { addMessage('stray', 'transmission cancelled.'); exitMessageMode(); }
      return;
    }

    if (text.trim()) addMessage('visitor', text);
    processCommand(text);
    return;
  }

  document.dispatchEvent(new CustomEvent('avatar:keydown'));
});

terminalPanel.addEventListener('click', (e) => {
  resetIdleTimer();
  if (e.target !== editableSpan && !editableSpan.contains(e.target)) placeCaretAtEnd(editableSpan);
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
