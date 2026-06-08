import { addMessage, promptEl } from './terminal.render.js';

// ── Input mode state ───────────────────────────────────────────────
let inputMode   = 'command'; // 'command' | 'message' | 'wizard'
let savedPrompt = '';

export function getInputMode() { return inputMode; }

// ── Transmit mode ──────────────────────────────────────────────────
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

// ── Wizard mode (multi-step input) ─────────────────────────────────
let wizardSteps    = [];
let wizardIndex    = 0;
let wizardData     = {};
let wizardOnComplete = null;

export function startWizard(steps, onComplete) {
  wizardSteps    = steps;
  wizardIndex    = 0;
  wizardData     = {};
  wizardOnComplete = onComplete;
  inputMode   = 'wizard';
  savedPrompt = promptEl.textContent;
  promptEl.textContent = steps[0].prompt;
}

export function handleWizardInput(text) {
  const step = wizardSteps[wizardIndex];
  wizardData[step.key] = text.trim();
  wizardIndex++;

  if (wizardIndex >= wizardSteps.length) {
    inputMode = 'command';
    promptEl.textContent = savedPrompt;
    const data = { ...wizardData };
    wizardOnComplete(data);
  } else {
    promptEl.textContent = wizardSteps[wizardIndex].prompt;
  }
}

export function cancelWizard() {
  inputMode = 'command';
  promptEl.textContent = savedPrompt;
  wizardSteps = [];
  wizardOnComplete = null;
}
