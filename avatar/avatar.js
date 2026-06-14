import { showExpression, showFace } from './expressions/expression.builder.js';
import { getTimeBlock } from '../scripts/time.js';
import { INTERACTIONS, INTERACTION_MAP } from './interactions/index.js';
import { initGaze } from './gaze.js';

const canvas  = document.getElementById('pixelFaceCanvas');
const IS_DEEP = getTimeBlock() === 'deep';

// ─── Expression helpers ───────────────────────────────────────────────────────

// During deep hours the loading cycle owns the face - block all normal show calls.
// Use forceShow for interactions that should break through regardless.
function show(eyes, mouth) {
  if (IS_DEEP) return;
  showExpression(eyes, mouth);
}

function forceShow(eyes, mouth) {
  showExpression(eyes, mouth);
}

function showInteraction(name) {
  const i = INTERACTION_MAP.get(name);
  if (!i) return;
  if (i.face) showFace(i.face);
  else        show(i.eyes, i.mouth);
}

// ─── Default state ────────────────────────────────────────────────────────────

const LOADING_FACES = ['loadingOne', 'loadingTwo', 'loadingThree', 'loadingFour'];
let loadingIndex    = 0;
let loadingInterval = null;

function startLoadingCycle() {
  showFace(LOADING_FACES[loadingIndex]);
  loadingInterval = setInterval(() => {
    loadingIndex = (loadingIndex + 1) % LOADING_FACES.length;
    showFace(LOADING_FACES[loadingIndex]);
  }, 3000);
}

function stopLoadingCycle() {
  clearInterval(loadingInterval);
  loadingInterval = null;
}

function setDefault() {
  if (IS_DEEP) {
    startLoadingCycle();
  } else {
    show('normal', 'flat');
  }
}

function pauseDefault() {
  if (IS_DEEP) stopLoadingCycle();
}

// ─── Idle timers ──────────────────────────────────────────────────────────────

let idleTimer10;
let idleTimer30;

function clearIdleTimers() {
  clearTimeout(idleTimer10);
  clearTimeout(idleTimer30);
}

function resetIdleTimers() {
  clearIdleTimers();
  idleTimer10 = setTimeout(() => {
    showInteraction('idle-10');
    idleTimer30 = setTimeout(() => {
      showInteraction('idle-30');
    }, 20000);
  }, 10000);
}

export function resetIdleTimer() {
  resetIdleTimers();
}

// ─── Register interactions ────────────────────────────────────────────────────
// Interactions with a handler factory call it to get a custom listener.
// All others get the generic show → optional revert path.

const ctx = { show, forceShow, showFace, setDefault, pauseDefault, resetIdleTimers };

for (const interaction of INTERACTIONS) {
  if (!interaction.trigger) continue;

  const target   = interaction.trigger.on === 'canvas' ? canvas : document;
  const listener = interaction.handler
    ? interaction.handler(ctx)
    : () => {
        if (IS_DEEP) return;
        pauseDefault();
        if (interaction.default) {
          setDefault();
        } else {
          show(interaction.eyes, interaction.mouth);
          if (interaction.revert) setTimeout(setDefault, interaction.revert);
        }
        resetIdleTimers();
      };

  target.addEventListener(interaction.trigger.event, listener);
}

// ── Avatar window reopened after being closed: show annoyance ────────────────
document.addEventListener('avatar:reopened', () => {
  pauseDefault();
  show('unamused', 'flat');
  setTimeout(setDefault, 2000);
  resetIdleTimers();
});

// ─── Init ─────────────────────────────────────────────────────────────────────

setDefault();
resetIdleTimers();
if (!IS_DEEP) initGaze();
