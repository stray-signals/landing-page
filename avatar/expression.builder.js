import { getEyes } from './eyes.js';
import { getMouth } from './mouths.js';
import { getFace } from './fullFace.js';

const canvas = document.getElementById('pixelFaceCanvas');
const ctx = canvas.getContext('2d');

const ROWS = 32;
const COLS = 64;
const CELL_W = 8;
const CELL_H = 16;
const BG_COLOR = '#0b1f0a';
const ON_COLOR = '#b8ffa0';

function setPixel(col, row, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ON_COLOR;
  ctx.fillRect(col * CELL_W, row * CELL_H, CELL_W, CELL_H);
}

function drawStatic() {
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#40ff40';
  for (let i = 0; i < 800; i++) {
    ctx.fillRect(
      Math.floor(Math.random() * 512),
      Math.floor(Math.random() * 512),
      1, 1
    );
  }
  ctx.globalAlpha = 1;
}

// Assemble a 32-row grid from eye + mouth components.
export function buildExpression(eyeID, mouthID, eyeOffset = 0, mouthOffset = 0) {
  const eyes  = getEyes(eyeID, eyeOffset);   // 14 rows, padded to top
  const mouth = getMouth(mouthID, mouthOffset); // 18 rows, padded to bottom
  return [...eyes, ...mouth];                 // exactly 32 rows
}

// Use a full-face override instead of components.
export function buildFace(faceID) {
  return getFace(faceID); // 32 rows, split-padded
}

// Render any 32-row string array into an arbitrary context at given cell size.
export function renderGrid(targetCtx, grid, cellW = CELL_W, cellH = CELL_H) {
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
  renderGrid(ctx, grid);
  drawStatic();
}

// Convenience: build and draw in one call.
export function showExpression(eyeID, mouthID, eyeOffset = 0, mouthOffset = 0) {
  drawExpression(buildExpression(eyeID, mouthID, eyeOffset, mouthOffset));
}

export function showFace(faceID) {
  drawExpression(buildFace(faceID));
}
