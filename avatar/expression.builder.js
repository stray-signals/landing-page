import { getEyes } from './eyes.js';
import { getMouth } from './mouths.js';
import { getFace }  from './fullFace.js';

let ctx = null;
function getCtx() {
  if (!ctx) {
    const canvas = document.getElementById('pixelFaceCanvas');
    if (canvas) ctx = canvas.getContext('2d');
  }
  return ctx;
}

const ROWS   = 32;
const COLS   = 64;
const CELL_W = 8;
const CELL_H = 16;

function themeColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    ON_COLOR: s.getPropertyValue('--color-primary').trim() || '#b8ffa0',
    BG_COLOR: s.getPropertyValue('--color-bg').trim()      || '#0b1f0a',
  };
}

function drawStatic(c) {
  const { ON_COLOR } = themeColors();
  c.globalAlpha = 0.15;
  c.fillStyle = ON_COLOR;
  for (let i = 0; i < 800; i++) {
    c.fillRect(Math.floor(Math.random() * 512), Math.floor(Math.random() * 512), 1, 1);
  }
  c.globalAlpha = 1;
}

// Assemble a 32-row grid from eye + mouth components.
export function buildExpression(eyeID, mouthID, eyeOffset = 0, mouthOffset = 0) {
  const eyes  = getEyes(eyeID, eyeOffset);
  const mouth = getMouth(mouthID, mouthOffset);
  return [...eyes, ...mouth];
}

// Use a full-face override instead of components.
export function buildFace(faceID) {
  return getFace(faceID);
}

// Render any 32-row string array into an arbitrary context at given cell size.
export function renderGrid(targetCtx, grid, cellW = CELL_W, cellH = CELL_H) {
  const { ON_COLOR, BG_COLOR } = themeColors();
  const w = cellW * COLS;
  const h = cellH * ROWS;

  targetCtx.clearRect(0, 0, w, h);
  targetCtx.fillStyle = BG_COLOR;
  targetCtx.fillRect(0, 0, w, h);
  targetCtx.globalAlpha = 1;

  for (let row = 0; row < ROWS; row++) {
    const line = (grid[row] ?? '').padEnd(COLS, '.');
    for (let col = 0; col < COLS; col++) {
      const ch = line[col];
      if (ch === '@' || ch === '%') {
        targetCtx.globalAlpha = ch === '%' ? 0.5 : 1;
        targetCtx.fillStyle = ON_COLOR;
        targetCtx.fillRect(col * cellW, row * cellH, cellW, cellH);
      }
    }
  }
  targetCtx.globalAlpha = 1;
}

// Render any 32-row string array to the main canvas.
export function drawExpression(grid) {
  const c = getCtx();
  if (!c) return;
  renderGrid(c, grid);
  drawStatic(c);
}

export function showExpression(eyeID, mouthID, eyeOffset = 0, mouthOffset = 0) {
  drawExpression(buildExpression(eyeID, mouthID, eyeOffset, mouthOffset));
}

export function showFace(faceID) {
  drawExpression(buildFace(faceID));
}
