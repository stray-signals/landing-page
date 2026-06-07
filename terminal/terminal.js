import { REGISTRY } from './commands/index.js';
import { resetIdleTimer, drawPixelFace } from '../avatar/avatar.js';
import { getTimeBlock, TIME_BLOCKS } from '../js/time.js';

const timeBlock = TIME_BLOCKS[getTimeBlock()];

const historyDiv   = document.getElementById('commandHistory');
const editableSpan = document.getElementById('editableSpan');
const terminalPanel = document.getElementById('terminalPanel');
const promptEl      = document.getElementById('inputPrompt');

// ── Message mode (guestbook) ───────────────────────────────────────
let inputMode   = 'command'; // 'command' | 'message'
let savedPrompt = '';

async function submitMessage(text) {
  addMessage('stray', 'transmitting...');
  try {
    const res = await fetch('https://formspree.io/f/xwvjvndd', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({ message: text }),
    });
    addMessage('stray', res.ok
      ? "signal received. i'll read it eventually."
      : 'transmission failed. try again later.');
  } catch {
    addMessage('stray', 'transmission failed. signal lost.');
  }
  inputMode = 'command';
  promptEl.textContent = savedPrompt;
}

function startMessageMode() {
  inputMode = 'message';
  savedPrompt = promptEl.textContent;
  promptEl.textContent = 'message:~$';
  addMessage('stray', 'leave a message. type it and hit enter.');
  addMessage('stray', '(blank line to cancel)');
}
// ──────────────────────────────────────────────────────────────────

function placeCaretAtEnd(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

export function addMessage(sender, text) {
  const entry = document.createElement('div');
  entry.className = `history-entry ${sender === 'visitor' ? 'visitor-msg' : 'stray-msg'}`;
  entry.textContent = sender === 'visitor' ? text : `@stray: ${text}`;
  historyDiv.appendChild(entry);
  historyDiv.scrollTop = historyDiv.scrollHeight;
}

async function processCommand(input) {
  const trimmed = input.trim();
  if (!trimmed) return;

  // Split "freq stop" → name="freq", args="stop"
  const [name, ...rest] = trimmed.toLowerCase().split(/\s+/);
  const args = rest.join(' ');

  const command = REGISTRY.get(name);
  if (!command) {
    addMessage('stray', `command not recognized: "${name}". try "help".`);
    return;
  }

  let result = command.handler(args);

  // Handle async commands
  if (result instanceof Promise) {
    addMessage('stray', 'scanning...');
    try {
      result = await result;
    } catch {
      addMessage('stray', 'signal lost. try again.');
      return;
    }
  }

  if (result?.action === 'clear')          { historyDiv.innerHTML = ''; }
  else if (result?.action === 'startMsg')  { startMessageMode(); }
  else if (typeof result === 'string')     { addMessage('stray', result); }
}

function syncHeights() {
  const facePanel = document.querySelector('.face-panel');
  if (window.innerWidth > 700 && facePanel) {
    const h = facePanel.offsetHeight;
    if (h > 0) terminalPanel.style.height = h + 'px';
  } else {
    terminalPanel.style.height = 'auto';
  }
}

// ── Input handling ─────────────────────────────────────────────────
let typingRevertTimeout;

editableSpan.addEventListener('keydown', (e) => {
  resetIdleTimer();

  if (e.key === 'Enter') {
    e.preventDefault();
    const text = editableSpan.textContent;
    editableSpan.textContent = '';
    placeCaretAtEnd(editableSpan);

    if (inputMode === 'message') {
      if (text.trim()) {
        submitMessage(text.trim());
      } else {
        addMessage('stray', 'transmission cancelled.');
        inputMode = 'command';
        promptEl.textContent = savedPrompt;
      }
      return;
    }

    if (text.trim()) addMessage('visitor', text);
    processCommand(text);
    return;
  }

  if (e.key !== 'Enter') {
    drawPixelFace('talking');
    clearTimeout(typingRevertTimeout);
    typingRevertTimeout = setTimeout(() => drawPixelFace('neutral'), 800);
  }
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
// ──────────────────────────────────────────────────────────────────

window.addEventListener('load', syncHeights);
window.addEventListener('resize', syncHeights);
if (window.ResizeObserver) {
  const facePanel = document.querySelector('.face-panel');
  if (facePanel) new ResizeObserver(syncHeights).observe(facePanel);
}

document.addEventListener('avatar:overtapped', () => {
  addMessage('stray', 'hey. stop tapping my screen.');
});

// ── Init ───────────────────────────────────────────────────────────
promptEl.textContent = timeBlock.prompt;

timeBlock.greeting.forEach((line, i) => {
  setTimeout(() => addMessage('stray', line), i * 500);
});

editableSpan.focus();
placeCaretAtEnd(editableSpan);
