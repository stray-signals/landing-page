import { showExpression, showFace } from './expression.builder.js';
import { getTimeBlock } from '../scripts/time.js';

const canvas = document.getElementById('pixelFaceCanvas');
const IS_DEEP = getTimeBlock() === 'deep';

// ─── State ────────────────────────────────────────────────────────────────────

let idleTimer10;
let idleTimer30;
let typingTimer;
let loadingInterval;

let frustrationClicks = 0;
let frustrationResetTimeout;

// ─── Loading cycle (00–06 time block) ────────────────────────────────────────

const LOADING_FACES = ['loadingOne', 'loadingTwo', 'loadingThree', 'loadingFour'];
let loadingIndex = 0;

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

// ─── Expression helpers ───────────────────────────────────────────────────────

function show(eyes, mouth) {
  showExpression(eyes, mouth);
}

// During deep hours the loading cycle IS the default state.
function setDefault() {
  if (IS_DEEP) {
    startLoadingCycle();
  } else {
    show('normal', 'flat');
  }
}

// Call before any interaction that needs to override the loading cycle.
function pauseDefault() {
  if (IS_DEEP) stopLoadingCycle();
}

// ─── Idle timers ──────────────────────────────────────────────────────────────

function clearIdleTimers() {
  clearTimeout(idleTimer10);
  clearTimeout(idleTimer30);
}

function resetIdleTimers() {
  clearIdleTimers();
  idleTimer10 = setTimeout(() => {
    show('unamused', 'flat');
    idleTimer30 = setTimeout(() => {
      show('wozzy', null); // null mouth → empty rows via ?? []
    }, 20000); // 20s after 10s = 30s total
  }, 10000);
}

export function resetIdleTimer() {
  resetIdleTimers();
}

// ─── Canvas interactions ──────────────────────────────────────────────────────

canvas.addEventListener('mouseenter', () => {
  pauseDefault();
  show('skeptical', 'flat');
  resetIdleTimers();
});

canvas.addEventListener('mouseleave', () => {
  setDefault();
  resetIdleTimers();
});

canvas.addEventListener('click', () => {
  pauseDefault();
  show('angry', 'tense');
  frustrationClicks++;

  clearTimeout(frustrationResetTimeout);

  if (frustrationClicks >= 3) {
    document.dispatchEvent(new CustomEvent('avatar:overtapped'));
    frustrationClicks = 0;
  }

  frustrationResetTimeout = setTimeout(() => {
    frustrationClicks = 0;
    setDefault();
  }, 1500);

  resetIdleTimers();
});

// ─── Terminal interactions ────────────────────────────────────────────────────

let talkFlicker = false;

document.addEventListener('avatar:keydown', () => {
  pauseDefault();
  talkFlicker = !talkFlicker;
  show('normal', talkFlicker ? 'talking' : 'flat');

  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    talkFlicker = false;
    setDefault();
  }, 800);

  resetIdleTimers();
});

document.addEventListener('avatar:submit', () => {
  pauseDefault();
  show('skeptical', 'flat');
  setTimeout(setDefault, 600);
  resetIdleTimers();
});

document.addEventListener('avatar:unknowncommand', () => {
  pauseDefault();
  show('glitched', 'tense');
  setTimeout(setDefault, 900);
  resetIdleTimers();
});

// ─── Init ─────────────────────────────────────────────────────────────────────

setDefault();
resetIdleTimers();
