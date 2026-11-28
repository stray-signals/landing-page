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
const REFLECT = 0.6;         // reflections are squashed toward the horizon
const SPEED = 0.6;          // 1 = the original pace at 60fps
const RIDGE_POINTS = 60;
const STAR_COUNT = 160;
const BAND_STEP = 3;       // px between aurora columns
const MAX_RIPPLES = 6;

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

// reflected: the ridge color mixed 70/30 with the water, opaque so it hides the aurora behind it
const RIDGES = [
  { pts: ridge(4.1, 0.64, 0.13), color: RIDGE_FAR, reflected: '#10152e' },
  { pts: ridge(1.3, 0.62, 0.22), color: RIDGE_NEAR, reflected: '#090e21' },
];

// The near shore runs from the left edge down to the bottom; x and y are fractions.
const SHORE_END = 0.5;
function shoreY(x) {
  const u = Math.min(1, x / SHORE_END);
  return 0.875 + 0.125 * u * u + Math.sin(x * 90) * 0.004 + Math.sin(x * 37 + 1) * 0.006;
}

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
  let raf = 0, idleTimer = 0, last = 0;
  const shoot = { a: 0, x: 0, y: 0 };
  let ripples = []; // { x, y, age } with age in 60fps frames
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

  // where a point in the sky shows up in the lake
  function reflectY(y) {
    return H * HORIZON + (H * HORIZON - y) * REFLECT;
  }

  // vertical wobble of the reflection at (x, y) from any ripples passing through
  function wobble(x, y) {
    let off = 0;
    for (const r of ripples) {
      const front = r.age * 2.5;
      const d = Math.hypot(x - r.x, (y - r.y) / 0.3);
      const behind = front - d;
      if (behind < 0 || behind > 120) continue;
      off += 6 * Math.exp(-r.age / 70) * (1 - behind / 120) * Math.sin(behind * 0.15);
    }
    return off;
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

  // Same ridges, flipped into the lake. Sampled finer than the ridge so ripples bend it smoothly.
  function drawRidgeReflections() {
    const samples = RIDGE_POINTS * 4;
    for (const { pts, reflected } of RIDGES) {
      ctx.fillStyle = reflected;
      ctx.beginPath();
      ctx.moveTo(0, H * HORIZON);
      for (let k = 0; k <= samples; k++) {
        const pos = k / samples * RIDGE_POINTS;
        const i = Math.min(RIDGE_POINTS - 1, Math.floor(pos));
        const v = pts[i] + (pts[i + 1] - pts[i]) * (pos - i);
        const x = k / samples * W;
        const y = reflectY(v * H);
        ctx.lineTo(x, y + wobble(x, y));
      }
      ctx.lineTo(W, H * HORIZON);
      ctx.fill();
    }
  }

  // One shape per band per frame, so the sky and its reflection always match.
  function bandColumns() {
    return PALETTES[palette].map((rgb, band) => {
      const cols = [];
      for (let i = 0; i < W; i += BAND_STEP) {
        const u = i / W;
        const dist = Math.hypot(i - mx, my - H * 0.25);
        const push = stir * Math.max(0, 1 - dist / 140) * 30;
        const y0 = H * (0.16 + band * 0.06)
                 + Math.sin(u * 4 + t * 0.6 + band) * 28
                 + Math.sin(u * 11 - t * 0.9 + band * 2) * 12 + push;
        const h = 70 + Math.sin(u * 6 + t * 0.8 + band * 1.7) * 45 + push * 1.5;
        const a = 0.05 + 0.045 * Math.sin(u * 9 + t * 1.3 + band);
        if (a > 0) cols.push({ i, y0, h, a });
      }
      return { rgb, cols };
    });
  }

  // Each column is four stacked rects; the sky one spans [bottom - hh, bottom].
  function drawBands(bands, reflected) {
    ctx.globalCompositeOperation = 'lighter';
    for (const { rgb: [r, g, b], cols } of bands) {
      for (const { i, y0, h, a } of cols) {
        ctx.fillStyle = `rgba(${r},${g},${b},${reflected ? a * 0.45 : a})`;
        const bottom = y0 + h;
        const top = reflected ? reflectY(bottom) : 0;
        const off = reflected ? wobble(i, top) : 0;
        for (let k = 0; k < 4; k++) {
          const hh = h * (1 - k * 0.22);
          if (reflected) ctx.fillRect(i, top + off, BAND_STEP, hh * REFLECT);
          else ctx.fillRect(i, bottom - hh, BAND_STEP, hh);
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawRipples() {
    ctx.lineWidth = 1;
    for (const r of ripples) {
      const fade = Math.exp(-r.age / 50);
      for (let k = 0; k < 3; k++) {
        const rad = r.age * 2.5 - k * 22;
        if (rad <= 0) continue;
        ctx.strokeStyle = `rgba(255,255,255,${0.3 * fade * (1 - k * 0.3)})`;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, rad, rad * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
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

    const bands = bandColumns();
    drawBands(bands, false);
    drawRidges();

    // the lake
    ctx.fillStyle = WATER;
    ctx.fillRect(0, H * HORIZON, W, H * (1 - HORIZON));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, H * HORIZON, W, H * (1 - HORIZON));
    ctx.clip();
    drawBands(bands, true);
    drawRidgeReflections();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let y = H * (HORIZON + 0.01); y < H; y += 6) {
      ctx.beginPath();
      for (let i = 0; i <= W; i += 10) ctx.lineTo(i, y + Math.sin(i * 0.05 + t * 2 + y) * 1.2 + wobble(i, y));
      ctx.stroke();
    }
    drawRipples();
    ctx.restore();

    drawShore();
  }

  function drawShore() {
    ctx.fillStyle = SHORE;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let k = 0; k <= 60; k++) {
      const x = k / 60 * SHORE_END;
      ctx.lineTo(x * W, shoreY(x) * H);
    }
    ctx.lineTo(SHORE_END * W, H);
    ctx.fill();
  }

  // f = elapsed time in 60fps frames, so the pace is the same on any refresh rate
  function step(f) {
    t += 0.016 * SPEED * f;
    stir *= Math.pow(0.97, f);
    if (shoot.a <= 0 && Math.random() < 0.004 * f) {
      shoot.a = 1;
      shoot.x = Math.random() * W * 0.7 + W * 0.2;
      shoot.y = Math.random() * H * 0.2;
    }
    if (shoot.a > 0) { shoot.x -= 7 * f; shoot.y += 2.8 * f; shoot.a -= 0.025 * f; }
    if (ripples.length) {
      ripples.forEach(r => { r.age += f; });
      ripples = ripples.filter(r => r.age < 240);
    }
  }

  function loop() {
    raf = 0; idleTimer = 0;
    if (!running) return;
    const now = performance.now();
    if (!isOnScreen(canvas)) { last = 0; idleTimer = setTimeout(loop, 500); return; }
    // capped so coming back from a hidden tab doesn't jump ahead
    const f = last ? Math.min(3, (now - last) / (1000 / 60)) : 1;
    last = now;
    step(f);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (raf || idleTimer) { cancelAnimationFrame(raf); clearTimeout(idleTimer); raf = 0; idleTimer = 0; }
    last = 0;
    if (running) raf = requestAnimationFrame(loop);
  }

  function setRunning(on) {
    running = on;
    pauseBtn.textContent = on ? 'pause' : 'play';
    pauseBtn.setAttribute('aria-pressed', String(!on));
    start();
  }

  function canvasPoint(e) {
    const box = canvas.getBoundingClientRect();
    return [e.clientX - box.left, e.clientY - box.top];
  }

  // Only the sky stirs; the reflection follows it.
  function onPointer(e) {
    const [x, y] = canvasPoint(e);
    if (y >= H * HORIZON) return;
    mx = x; my = y;
    stir = Math.min(1.5, stir + 0.15);
    if (!running) draw();
  }

  function onPointerDown(e) {
    const [x, y] = canvasPoint(e);
    if (!running || y < H * HORIZON) return;
    if (x < SHORE_END * W && y > shoreY(x / W) * H) return; // that's land
    ripples.push({ x, y, age: 0 });
    if (ripples.length > MAX_RIPPLES) ripples.shift();
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
  canvas.addEventListener('pointerdown', onPointerDown);
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
      canvas.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('click', onClick);
      container.innerHTML = '';
    },
  };
}
