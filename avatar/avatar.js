const canvas = document.getElementById('pixelFaceCanvas');
const ctx = canvas.getContext('2d');

let currentExpression = 'neutral';
let idleTimeout;

function setPixel(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * 32, y * 32, 32, 32);
}

function drawPixelFace(expression = 'neutral') {
  currentExpression = expression;
  ctx.clearRect(0, 0, 512, 512);
  ctx.fillStyle = '#0b1f0a';
  ctx.fillRect(0, 0, 512, 512);

  if (expression === 'neutral') {
    for (let dx = 0; dx <= 1; dx++) {
      for (let dy = 0; dy <= 1; dy++) {
        setPixel(5 + dx, 6 + dy, '#b8ffa0');
        setPixel(9 + dx, 6 + dy, '#b8ffa0');
      }
    }
    for (let i = 5; i <= 10; i++) setPixel(i, 11, '#6cb03e');

  } else if (expression === 'happy') {
    for (let dx = 0; dx <= 2; dx++) {
      for (let dy = 0; dy <= 1; dy++) {
        setPixel(4 + dx, 6 + dy, '#b8ffa0');
        setPixel(9 + dx, 6 + dy, '#b8ffa0');
      }
    }
    for (let i = 5; i <= 10; i++) setPixel(i, 11, '#b8ffa0');
    setPixel(4, 12, '#b8ffa0');
    setPixel(5, 12, '#b8ffa0'); setPixel(6, 12, '#b8ffa0');
    setPixel(9, 12, '#b8ffa0'); setPixel(10, 12, '#b8ffa0');
    setPixel(11, 12, '#b8ffa0');

  } else if (expression === 'spooked') {
    for (let x = 4; x <= 7; x++) {
      for (let y = 5; y <= 8; y++) setPixel(x, y, '#b8ffa0');
    }
    for (let x = 9; x <= 12; x++) {
      for (let y = 5; y <= 8; y++) setPixel(x, y, '#b8ffa0');
    }
    for (let x = 5; x <= 10; x++) {
      setPixel(x, 11, '#b8ffa0');
      setPixel(x, 12, '#b8ffa0');
    }

  } else if (expression === 'idle') {
    setPixel(6, 6, '#b8ffa0'); setPixel(6, 7, '#b8ffa0');
    setPixel(9, 6, '#b8ffa0'); setPixel(9, 7, '#b8ffa0');
    for (let i = 5; i <= 10; i++) setPixel(i, 12, '#6cb03e');
  }

  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = '#40ff40';
    ctx.fillRect(Math.floor(Math.random() * 512), Math.floor(Math.random() * 512), 1, 1);
  }
  ctx.globalAlpha = 1;
}

export function resetIdleTimer() {
  clearTimeout(idleTimeout);
  if (currentExpression === 'idle') drawPixelFace('neutral');
  idleTimeout = setTimeout(() => drawPixelFace('idle'), 10000);
}

canvas.addEventListener('mouseenter', () => { drawPixelFace('spooked'); resetIdleTimer(); });
canvas.addEventListener('mouseleave', () => { drawPixelFace('neutral'); resetIdleTimer(); });
canvas.addEventListener('click', () => {
  drawPixelFace('happy');
  setTimeout(() => drawPixelFace('neutral'), 1500);
  resetIdleTimer();
});

drawPixelFace('neutral');
resetIdleTimer();
