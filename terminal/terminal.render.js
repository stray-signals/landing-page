// ── DOM references ─────────────────────────────────────────────────
export const historyDiv    = document.getElementById('commandHistory');
export const editableSpan  = document.getElementById('editableSpan');
export const terminalPanel = document.getElementById('terminalPanel');
export const promptEl      = document.getElementById('inputPrompt');

// ── Message output ─────────────────────────────────────────────────
export function addMessage(sender, text) {
  const entry = document.createElement('div');
  entry.className = `history-entry ${sender === 'visitor' ? 'visitor-msg' : 'stray-msg'}`;
  entry.textContent = sender === 'visitor' ? text : `@stray: ${text}`;
  historyDiv.appendChild(entry);
  historyDiv.scrollTop = historyDiv.scrollHeight;
}

export function renderSwatches(colors, label) {
  const entry = document.createElement('div');
  entry.className = 'history-entry stray-msg swatches';
  if (label) {
    const tag = document.createElement('span');
    tag.className = 'swatch-label';
    tag.textContent = label;
    entry.appendChild(tag);
  }
  for (const c of colors) {
    const cell = document.createElement('span');
    cell.className = 'swatch';
    const block = document.createElement('span');
    block.className = 'swatch-block';
    block.style.background = c;
    const label = document.createElement('span');
    label.className = 'swatch-hex';
    label.textContent = c;
    cell.append(block, label);
    entry.appendChild(cell);
  }
  historyDiv.appendChild(entry);
  historyDiv.scrollTop = historyDiv.scrollHeight;
}

// ── Cursor ─────────────────────────────────────────────────────────
export function placeCaretAtEnd(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// ── Layout ─────────────────────────────────────────────────────────
export function syncHeights() {
  const facePanel = document.querySelector('.face-panel');
  if (window.innerWidth > 700 && facePanel) {
    const h = facePanel.offsetHeight;
    if (h > 0) terminalPanel.style.height = h + 'px';
  } else {
    terminalPanel.style.height = 'auto';
  }
}

window.addEventListener('load', syncHeights);
window.addEventListener('resize', syncHeights);
if (window.ResizeObserver) {
  const facePanel = document.querySelector('.face-panel');
  if (facePanel) new ResizeObserver(syncHeights).observe(facePanel);
}
