import { promptEl } from './terminal.render.js';

// ── Input mode state ───────────────────────────────────────────────
let inputMode   = 'command'; // 'command' | 'wizard'
let savedPrompt = '';

export function getInputMode() { return inputMode; }

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
