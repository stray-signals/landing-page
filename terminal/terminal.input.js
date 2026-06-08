import { addMessage, promptEl } from './terminal.render.js';

// ── Message mode state ─────────────────────────────────────────────
let inputMode   = 'command'; // 'command' | 'message'
let savedPrompt = '';

export function getInputMode()  { return inputMode; }

export function startTransmitMode() {
  inputMode   = 'message';
  savedPrompt = promptEl.textContent;
  promptEl.textContent = 'transmit:~$';
  addMessage('stray', 'leave a message. type it and hit enter.');
  addMessage('stray', '(blank line to cancel)');
}

export function exitMessageMode() {
  inputMode = 'command';
  promptEl.textContent = savedPrompt;
}

export async function submitMessage(text) {
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
  exitMessageMode();
}
