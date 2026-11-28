// Aurora: a night sky over a lake. Move the pointer through it to stir the lights.
// mountAurora(container, { mode }) -> { destroy }
import { ensureCss } from '/shared/dom.js';
import { isOnScreen } from '/shared/screen.js';

const CSS_HREF = '/art/aurora/aurora.art.css';

// Each palette is three aurora bands, [r, g, b].
const PALETTES = [
  [[80, 255, 170], [60, 180, 255], [180, 90, 255]],
  [[255, 120, 180], [255, 190, 90], [140, 100, 255]],
  [[120, 255, 240], [90, 255, 120], [255, 255, 160]],
];
const SKY = '#070b1a';
const RIDGE_FAR = '#141b38';
const RIDGE_NEAR = '#0b1026';
const WATER = '#050816';
const SHORE = '#03050e';

const HORIZON = 0.66;      // water line, as a fraction of height
const MIRROR = HORIZON * 2; // reflections flip around the horizon
const RIDGE_POINTS = 60;
const STAR_COUNT = 160;
const BAND_STEP = 3;       // px between aurora columns

function ridge(seed, base, amp) {
  const pts = [];
  for (let i = 0; i <= RIDGE_POINTS; i++) {
    const u = i / RIDGE_POINTS;
    const wave = Math.sin(u * 7 + seed) * 0.5
               + Math.sin(u * 17 + seed * 2) * 0.25
               + Math.sin(u * 31 + seed * 3) * 0.12;
    pts.push(base - amp * (wave + 0.6));
  }
  return pts;
}

const RIDGES = [
  { pts: ridge(4.1, 0.64, 0.13), color: RIDGE_FAR },
  { pts: ridge(1.3, 0.62, 0.22), color: RIDGE_NEAR },
];

export function mountAurora(container, { mode = 'window' } = {}) {
  ensureCss(CSS_HREF);
  container.innerHTML = `
    <div class="aurora-art app-surface aurora-${mode}">
      <canvas class="au-sky" aria-label="an aurora over mountains and a lake" role="img"></canvas>
      <div class="au-controls">
        <button type="button" class="au-btn" data-act="palette">shift colors</button>
        <button type="button" class="au-btn" data-act="pause" aria-pressed="false">pause</button>
      </div>
    </div>`;
  const root = container.querySelector('.aurora-art');
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const pauseBtn = root.querySelector('[data-act="pause"]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let W = 0, H = 0;
  let palette = 0;
  let running = !reduceMotion.matches;
  let t = 0, stir = 0;
  let mx = -999, my = -999;
  let raf = 0, idleTimer = 0;
  const shoot = { a: 0, x: 0, y: 0 };
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random(), y: Math.random() * 0.62,
    r: Math.random() * 1.3 + 0.2, phase: Math.random() * Math.PI * 2, speed: Math.random() * 2 + 0.5,
  }));

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!running) draw();
  }

  function drawRidges() {
    for (const { pts, color } of RIDGES) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, H * HORIZON);
      pts.forEach((v, i) => ctx.lineTo(i / RIDGE_POINTS * W, v * H));
      ctx.lineTo(W, H * HORIZON);
      ctx.fill();
    }
  }

  // reflected=true draws the dimmer, squashed copy in the water.
  function drawBands(reflected) {
    const bands = PALETTES[palette];
    ctx.globalCompositeOperation = 'lighter';
    // In the water, the pointer stirs the band it is reflecting.
    const py = reflected ? H * MIRROR - my : my;
    bands.forEach(([r, g, b], band) => {
      for (let i = 0; i < W; i += BAND_STEP) {
        const u = i / W;
        const dist = Math.hypot(i - mx, py - H * 0.25);
        const push = stir * Math.max(0, 1 - dist / 140) * 30;
        const y0 = H * (0.16 + band * 0.06)
                 + Math.sin(u * 4 + t * 0.6 + band) * 28
                 + Math.sin(u * 11 - t * 0.9 + band * 2) * 12 + push;
        const h = 70 + Math.sin(u * 6 + t * 0.8 + band * 1.7) * 45 + push * 1.5;
        const a = (0.05 + 0.045 * Math.sin(u * 9 + t * 1.3 + band)) * (reflected ? 0.45 : 1);
        if (a <= 0) continue;
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
        for (let k = 0; k < 4; k++) {
          const hh = h * (1 - k * 0.22);
          if (reflected) ctx.fillRect(i, H * MIRROR - y0 - hh * 0.2, BAND_STEP, hh * 0.6);
          else ctx.fillRect(i, y0 - hh + h, BAND_STEP, hh);
        }
      }
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  function draw() {
    if (!W || !H) return;
    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.65 * Math.abs(Math.sin(t * s.speed + s.phase))})`;
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (shoot.a > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${shoot.a})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(shoot.x, shoot.y);
      ctx.lineTo(shoot.x + 50, shoot.y - 20);
      ctx.stroke();
    }

    drawBands(false);
    drawRidges();

    // the lake
    ctx.fillStyle = WATER;
    ctx.fillRect(0, H * HORIZON, W, H * (1 - HORIZON));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, H * HORIZON, W, H * (1 - HORIZON));
    ctx.clip();
    drawBands(true);
    ctx.globalAlpha = 0.5;
    ctx.save();
    ctx.translate(0, H * MIRROR);
    ctx.scale(1, -1);
    drawRidges();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let y = H * (HORIZON + 0.01); y < H; y += 6) {
      ctx.beginPath();
      for (let i = 0; i <= W; i += 10) ctx.lineTo(i, y + Math.sin(i * 0.05 + t * 2 + y) * 1.2);
      ctx.stroke();
    }
    ctx.restore();

    // near shore
    ctx.fillStyle = SHORE;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H * 0.9);
    ctx.quadraticCurveTo(W * 0.25, H * 0.84, W * 0.45, H);
    ctx.fill();
  }

  function step() {
    t += 0.016;
    stir *= 0.97;
    if (shoot.a <= 0 && Math.random() < 0.004) {
      shoot.a = 1;
      shoot.x = Math.random() * W * 0.7 + W * 0.2;
      shoot.y = Math.random() * H * 0.2;
    }
    if (shoot.a > 0) { shoot.x -= 7; shoot.y += 2.8; shoot.a -= 0.025; }
  }

  function loop() {
    raf = 0;
    if (!running) return;
    if (!isOnScreen(canvas)) { idleTimer = setTimeout(loop, 500); return; }
    step();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (raf || idleTimer) { cancelAnimationFrame(raf); clearTimeout(idleTimer); raf = 0; idleTimer = 0; }
    if (running) raf = requestAnimationFrame(loop);
  }

  function setRunning(on) {
    running = on;
    pauseBtn.textContent = on ? 'pause' : 'play';
    pauseBtn.setAttribute('aria-pressed', String(!on));
    start();
  }

  function onPointer(e) {
    const box = canvas.getBoundingClientRect();
    mx = e.clientX - box.left;
    my = e.clientY - box.top;
    stir = Math.min(1.5, stir + 0.15);
    if (!running) draw();
  }

  function onClick(e) {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'palette') {
      palette = (palette + 1) % PALETTES.length;
      if (!running) draw();
    } else if (act === 'pause') {
      setRunning(!running);
    }
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  canvas.addEventListener('pointermove', onPointer);
  root.addEventListener('click', onClick);

  resize();
  setRunning(running);
  if (!running) draw();

  return {
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      clearTimeout(idleTimer);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onPointer);
      root.removeEventListener('click', onClick);
      container.innerHTML = '';
    },
  };
}
