import { EXPRESSIONS } from './expressions.js';
import { getTimeBlock, TIME_BLOCKS } from '../js/time.js';

const canvas = document.getElementById('pixelFaceCanvas');
const ctx = canvas.getContext('2d');

let currentExpression = 'neutral';
let idleTimeout;

// 64×32 grid — each cell is 8px wide × 16px tall on the 512×512 canvas
function setPixel(col, row, color) {
  ctx.fillStyle = color;
  ctx.fillRect(col * 8, row * 16, 8, 16);
}

function drawPixelFace(expression = 'neutral') {
  currentExpression = expression;
  ctx.clearRect(0, 0, 512, 512);
  ctx.fillStyle = '#0b1f0a';
  ctx.fillRect(0, 0, 512, 512);

  const pattern = EXPRESSIONS[expression] ?? [];
  for (let row = 0; row < pattern.length; row++) {
    const line = pattern[row].padEnd(64, '.');
    for (let col = 0; col < 64; col++) {
      const ch = line[col];
      if (ch === '@') setPixel(col, row, '#b8ffa0');
    }
  }

  // Subtle static overlay
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = '#40ff40';
    ctx.fillRect(Math.floor(Math.random() * 512), Math.floor(Math.random() * 512), 1, 1);
  }
  ctx.globalAlpha = 1;
}

export { drawPixelFace };

export function resetIdleTimer() {
  clearTimeout(idleTimeout);
  if (currentExpression === 'idle') drawPixelFace('neutral');
  idleTimeout = setTimeout(() => drawPixelFace('idle'), 10000);
}

let frustrationClicks = 0;
let frustrationResetTimeout;

canvas.addEventListener('mouseenter', () => { drawPixelFace('laughing'); resetIdleTimer(); });
canvas.addEventListener('mouseleave', () => { drawPixelFace('neutral'); resetIdleTimer(); });
canvas.addEventListener('click', () => {
  drawPixelFace('frustrated');
  frustrationClicks++;
  clearTimeout(frustrationResetTimeout);
  if (frustrationClicks >= 3) {
    document.dispatchEvent(new CustomEvent('avatar:overtapped'));
    frustrationClicks = 0;
  }
  frustrationResetTimeout = setTimeout(() => {
    frustrationClicks = 0;
    drawPixelFace('neutral');
  }, 1500);
  resetIdleTimer();
});

drawPixelFace(TIME_BLOCKS[getTimeBlock()].defaultExpression);
resetIdleTimer();
