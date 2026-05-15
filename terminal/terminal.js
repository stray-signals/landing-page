import { COMMANDS } from './commands.js';
import { resetIdleTimer, drawPixelFace } from '../avatar/avatar.js';

let typingRevertTimeout;

const historyDiv = document.getElementById('commandHistory');
const editableSpan = document.getElementById('editableSpan');
const terminalPanelDiv = document.getElementById('terminalPanel');

function placeCaretAtEnd(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function addMessage(sender, text) {
  const entry = document.createElement('div');
  entry.className = `history-entry ${sender === 'visitor' ? 'visitor-msg' : 'stray-msg'}`;
  entry.textContent = sender === 'visitor' ? text : `@stray: ${text}`;
  historyDiv.appendChild(entry);
  historyDiv.scrollTop = historyDiv.scrollHeight;
}

function processCommand(cmd) {
  const trimmed = cmd.trim().toLowerCase();
  if (!trimmed) return;

  const command = COMMANDS.get(trimmed);
  if (!command) {
    addMessage('stray', `Command not recognized: "${cmd}". Try "help".`);
    return;
  }

  const result = command.run();
  if (result?.action === 'clear') {
    historyDiv.innerHTML = '';
  } else if (result) {
    addMessage('stray', result);
  }
}

function syncHeights() {
  const facePanel = document.querySelector('.face-panel');
  if (window.innerWidth > 700 && facePanel) {
    const faceHeight = facePanel.offsetHeight;
    if (faceHeight > 0) terminalPanelDiv.style.height = faceHeight + 'px';
  } else {
    terminalPanelDiv.style.height = 'auto';
  }
}

editableSpan.addEventListener('keydown', (e) => {
  resetIdleTimer();
  if (e.key !== 'Enter') {
    drawPixelFace('talking');
    clearTimeout(typingRevertTimeout);
    typingRevertTimeout = setTimeout(() => drawPixelFace('neutral'), 800);
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    const cmd = editableSpan.textContent;
    if (cmd.trim()) addMessage('visitor', cmd);
    processCommand(cmd);
    editableSpan.textContent = '';
    placeCaretAtEnd(editableSpan);
  }
});

terminalPanelDiv.addEventListener('click', (e) => {
  resetIdleTimer();
  if (e.target !== editableSpan && !editableSpan.contains(e.target)) {
    placeCaretAtEnd(editableSpan);
  }
});

editableSpan.addEventListener('focus', () => { resetIdleTimer(); placeCaretAtEnd(editableSpan); });
editableSpan.addEventListener('input', resetIdleTimer);
document.body.addEventListener('click', resetIdleTimer);

window.addEventListener('load', syncHeights);
window.addEventListener('resize', syncHeights);

if (window.ResizeObserver) {
  const facePanel = document.querySelector('.face-panel');
  if (facePanel) new ResizeObserver(syncHeights).observe(facePanel);
}

document.addEventListener('avatar:overtapped', () => {
  addMessage('stray', 'hey. stop tapping my screen.');
});

editableSpan.focus();
placeCaretAtEnd(editableSpan);
