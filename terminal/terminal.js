import { REGISTRY }                                          from './commands/index.js';
import { ADMIN_REGISTRY }                                     from './admin/commands/index.js';
import { addMessage, addCommandLink, renderSwatches, editableSpan, terminalPanel, promptEl, placeCaretAtEnd } from './terminal.render.js';
import { paletteToTheme } from '../tools/palette/palette.color.js';
import { applySiteTheme, resetSiteTheme } from '../tools/palette/palette.theme.js';
import { resetIdleTimer }                                     from '../avatar/avatar.js';
import { getTimeBlock, TIME_BLOCKS }                          from '../scripts/time.js';
import { getCwdString }                                       from './terminal.fs.js';
import { storePat, clearPat }   from './admin/auth.js';
import { handleLog }            from './admin/commands/log.js';
import { openTransmitWindow }   from '../scripts/transmit-window.js';
import { openApp }              from '../scripts/app-window.js';
import { loadTransmissions }    from '../tools/transmissions/transmissions.tool.js';

const timeBlock = TIME_BLOCKS[getTimeBlock()];
const BASE_PROMPT = timeBlock.prompt;

let isAdmin = false;

function buildPrompt() {
  const path = getCwdString();
  return BASE_PROMPT.replace(':~$', `:${path}$`);
}

function getRegistry() {
  return isAdmin ? ADMIN_REGISTRY : REGISTRY;
}

// admin mode
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
  document.dispatchEvent(new CustomEvent('terminal:adminlogout'));
}

document.addEventListener('terminal:adminlogin', () => {
  activateAdmin();
  editableSpan.focus();
});

// command dispatch
async function processCommand(input) {
  const trimmed = input.trim();
  if (!trimmed) return;

  const firstSpace = trimmed.indexOf(' ');
  const name = (firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)).toLowerCase();
  const rawArgs = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1).trim();
  // preserve case for "run ... | <password>" so a real password isn't mangled
  const args = (name === 'run' && rawArgs.includes('|')) ? rawArgs : rawArgs.toLowerCase();

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
  else if (result?.action === 'openTransmit') { openTransmitWindow(result.password); }
  else if (result?.action === 'openApp')   { openApp(result.id); responseText = `opening ${result.id}...`; addMessage('stray', responseText); }
  else if (result?.action === 'palette')  {
    renderSwatches(result.colors);
    responseText = 'here is a palette';
    addMessage('stray', 'type "run palette" to open the full tool');
  }
  else if (result?.action === 'paletteList') {
    result.palettes.forEach((p, i) => renderSwatches(p.colors, `${i + 1}.`));
    responseText = 'here are your saved palettes';
  }
  else if (result?.action === 'paletteApply') {
    applySiteTheme(paletteToTheme(result.colors).vars);
    renderSwatches(result.colors);
    responseText = `site recolored with ${result.label}.`;
    addMessage('stray', responseText);
  }
  else if (result?.action === 'paletteReset') {
    resetSiteTheme();
    responseText = 'site colors back to normal.';
    addMessage('stray', responseText);
  }
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

// input handling
editableSpan.addEventListener('keydown', async (e) => {
  resetIdleTimer();

  if (e.key === 'Enter') {
    e.preventDefault();
    const text = editableSpan.textContent;
    editableSpan.textContent = '';
    placeCaretAtEnd(editableSpan);

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

// avatar events
document.addEventListener('avatar:overtapped', () => {
  addMessage('stray', 'hey. stop tapping my screen.');
});

// init
promptEl.textContent = buildPrompt();

timeBlock.greeting.forEach((line, i) => {
  setTimeout(() => addMessage('stray', line), i * 500);
});

// Mention the newest transmission if it's recent.
const RECENT_DAYS = 30;
loadTransmissions().then(([latest]) => {
  if (!latest) return;
  const age = (Date.now() - new Date(latest.date + 'T00:00:00').getTime()) / 86400000;
  if (age > RECENT_DAYS) return;
  const where = latest.target ? ` ${latest.target}.` : '';
  setTimeout(() => addCommandLink(`logged something new.${where}`, 'run transmissions', (cmd) => {
    addMessage('visitor', cmd);
    processCommand(cmd);
  }), timeBlock.greeting.length * 500 + 1200);
}).catch(() => { /* no log, no mention */ });

editableSpan.focus();
placeCaretAtEnd(editableSpan);
