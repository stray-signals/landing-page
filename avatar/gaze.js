import { setGaze } from './expressions/expression.builder.js';

let current = { yOffset: 0, flipped: false };

function computeGaze(mouseX, mouseY) {
  const canvas = document.getElementById('pixelFaceCanvas');
  if (!canvas) return { yOffset: 0, flipped: false };

  const rect = canvas.getBoundingClientRect();

  const gazeOffset = 2;

  const yOffset = mouseY < rect.top ? -gazeOffset : mouseY > rect.bottom ? gazeOffset : 0;
  const flipped = mouseX < rect.left;

  return { yOffset, flipped };
}

export function initGaze() {
  document.addEventListener('mousemove', (e) => {
    const next = computeGaze(e.clientX, e.clientY);
    if (next.yOffset !== current.yOffset || next.flipped !== current.flipped) {
      current = next;
      setGaze(current);
    }
  });
}
