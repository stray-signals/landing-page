// larmor: all canvas drawing. Reads the world, never changes it.
import { TAU, GAP_HALF, ENDING, PULSAR_SIZE, dustSize, polar, segAngle, energyParts, clamp, INTRO_TIME } from './larmor.entities.js';
import { BOARD_SIZE } from './larmor.scores.js';

const FONT = "'Courier New', 'Fira Code', monospace";
const pad5 = n => String(Math.max(0, Math.floor(n))).padStart(5, '0');
const smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

export function makeView(W, H) {
  return { W, H, cx: W / 2, cy: H / 2, R: 0.42 * Math.min(W, H) };
}

export function makeStars(n) {
  return Array.from({ length: n }, () => ({ a: Math.random() * TAU, d: Math.random(), s: 0.2 + Math.random() * 0.8 }));
}

export function stepStars(stars, dt, mult = 1) {
  for (const s of stars) {
    s.d += dt * s.s * 0.35 * mult;
    if (s.d > 1.15) { s.d = 0; s.a = Math.random() * TAU; }
  }
}

export function soundRect(v) {
  return { x: v.W - 96, y: v.H - 38, w: 92, h: 34 };
}

function fontSize(v) { return clamp(Math.min(v.W, v.H) / 28, 10, 17); }

function P(v, a, d) { const [x, y] = polar(a, d * v.R); return [v.cx + x, v.cy + y]; }

// ── the ending: Earth, the particle shower, then a CRT ──────────────

// coarse land outlines (lon, lat); only needs to read as Earth at dot resolution
const LAND = [
  [[-168,66],[-140,70],[-95,72],[-75,72],[-62,60],[-55,50],[-67,44],[-76,35],[-81,25],[-83,29],[-90,30],[-97,27],[-97,20],[-90,16],[-83,10],[-78,8],[-86,13],[-95,16],[-105,20],[-112,28],[-118,33],[-124,40],[-125,49],[-135,57],[-150,60],[-165,60]],
  [[-55,60],[-45,60],[-20,70],[-20,82],[-60,82],[-70,76]],
  [[-80,9],[-60,11],[-50,0],[-35,-5],[-40,-22],[-48,-28],[-58,-38],[-65,-42],[-68,-55],[-74,-50],[-73,-40],[-71,-30],[-70,-18],[-76,-14],[-81,-5],[-80,0]],
  [[-17,21],[-10,30],[-5,36],[10,37],[20,32],[32,31],[35,27],[43,12],[51,12],[42,-2],[40,-15],[35,-24],[32,-29],[20,-35],[17,-29],[12,-17],[13,-5],[9,4],[-8,4],[-15,10]],
  [[-10,36],[-9,43],[-2,44],[-5,48],[5,53],[8,57],[5,62],[15,70],[30,71],[40,67],[60,69],[70,73],[100,78],[140,73],[180,70],[180,65],[170,60],[160,55],[142,50],[140,40],[130,35],[122,30],[121,23],[110,20],[108,12],[103,1],[100,8],[98,16],[92,22],[88,22],[80,15],[77,8],[72,20],[67,25],[57,25],[52,27],[48,30],[56,24],[59,22],[55,17],[44,12],[43,16],[35,28],[34,32],[36,36],[27,37],[26,40],[20,40],[14,41],[12,44],[13,38],[10,44],[3,43],[-1,37]],
  [[114,-22],[122,-18],[130,-12],[137,-12],[142,-11],[146,-19],[153,-26],[150,-37],[140,-38],[132,-32],[115,-34]],
  [[-6,50],[2,51],[0,58],[-6,58]], [[130,31],[141,36],[142,45],[139,40]], [[44,-25],[50,-15],[49,-12],[44,-17]],
  [[95,5],[105,-6],[115,-8],[120,-5],[118,2],[110,2],[100,4]], [[132,-2],[141,-3],[150,-10],[141,-9]],
];
function inPoly(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
let globe = null;
function getGlobe() {
  if (globe) return globe;
  globe = [];
  for (let lat = -84; lat <= 84; lat += 4) {
    const step = 4 / Math.max(0.2, Math.cos(lat * Math.PI / 180));
    for (let lon = -180; lon < 180; lon += step) {
      globe.push({ lat: lat * Math.PI / 180, lon: lon * Math.PI / 180, land: lat < -68 || LAND.some(q => inPoly(q, lon, lat)) });
    }
  }
  return globe;
}
const TILT = 23.4 * Math.PI / 180;
function proj(lat, lon, rot) {
  const x = Math.cos(lat) * Math.sin(lon + rot), y0 = Math.sin(lat), z0 = Math.cos(lat) * Math.cos(lon + rot);
  return [x, -(y0 * Math.cos(TILT) - z0 * Math.sin(TILT)), y0 * Math.sin(TILT) + z0 * Math.cos(TILT)];
}

// the dot globe
function drawEarth(ctx, C, cx, cy, R, rot, alpha) {
  if (R < 2) return;
  const atm = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.12);
  atm.addColorStop(0, 'transparent'); atm.addColorStop(0.3, C.primary); atm.addColorStop(1, 'transparent');
  ctx.globalAlpha = 0.22 * alpha; ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, TAU); ctx.fill();
  ctx.globalAlpha = alpha; ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  const p = Math.max(1, R / 70);
  for (const g of getGlobe()) {
    const [x, y, z] = proj(g.lat, g.lon, rot);
    if (z <= 0) continue;
    if (g.land) { ctx.globalAlpha = (0.35 + 0.65 * z) * alpha; ctx.fillStyle = C.primary; ctx.fillRect(cx + x * R - p, cy + y * R - p, p * 2, p * 2); }
    else { ctx.globalAlpha = 0.25 * z * alpha; ctx.fillStyle = C.accent; ctx.fillRect(cx + x * R - p * 0.5, cy + y * R - p * 0.5, p, p); }
  }
  ctx.globalAlpha = 1;
}

// the air shower: a branching tree, regenerated for each ending
let shower = [], showerFor = null;
function buildShower() {
  shower = [];
  const grow = (x, y, ang, len, depth) => {
    if (depth > 6) return;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    shower.push({ x, y, x2, y2, depth });
    const n = depth < 2 ? 3 : 2;
    for (let i = 0; i < n; i++) grow(x2, y2, ang + (Math.random() - 0.5) * 0.9, len * (0.62 + Math.random() * 0.2), depth + 1);
  };
  grow(0, 0, 0, 1, 0);
}

export function earthRadius(v) { return 0.78 * v.R; }

function drawEarthScene(ctx, v, C, w, fx) {
  const e = w.ending, t = e.t, ER0 = earthRadius(v);
  if (showerFor !== e) { showerFor = e; buildShower(); }
  const grow = smooth(span(t, ENDING.growFrom, ENDING.growTo));
  const ER = fx.reduced ? ER0 : ER0 * grow, alpha = fx.reduced ? grow : 1;
  drawEarth(ctx, C, v.cx, v.cy, ER, t * 0.25, alpha);
  if (t < ENDING.showerFrom) return;
  const a = w.stray.a, ix = v.cx + Math.cos(a) * ER * 1.04, iy = v.cy + Math.sin(a) * ER * 1.04;
  const sk = span(t, ENDING.showerFrom, ENDING.showerTo), L = ER * 0.32;
  ctx.save(); ctx.translate(ix, iy); ctx.rotate(a + Math.PI);
  for (const sg of shower) {
    const f = fx.reduced ? 1 : Math.min(1, sk * 7 - sg.depth);
    if (f <= 0) continue;
    ctx.globalAlpha = Math.max(0, fx.reduced ? 1 - span(t, ENDING.showerFrom, ENDING.showerFrom + 0.8) : 1 - sk * 0.7) * (1 - sg.depth / 9);
    ctx.strokeStyle = sg.depth < 2 ? '#ffffff' : sg.depth < 4 ? C.primary : C.accent;
    ctx.lineWidth = Math.max(0.6, 2.2 - sg.depth * 0.3);
    ctx.beginPath(); ctx.moveTo(sg.x * L, sg.y * L); ctx.lineTo((sg.x + (sg.x2 - sg.x) * f) * L, (sg.y + (sg.y2 - sg.y) * f) * L); ctx.stroke();
  }
  ctx.restore(); ctx.globalAlpha = 1;
  if (sk < 0.25 && !fx.reduced) glowDot(ctx, ix, iy, 30 * (1 - sk * 4), '#ffffff', C.primary);
  if (!fx.reduced && t > ENDING.staticFrom) {
    const k = span(t, ENDING.staticFrom, ENDING.crtFrom);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 1400 * k; i++) { ctx.fillStyle = Math.random() < 0.5 ? C.primary : C.bg; ctx.fillRect(Math.random() * v.W, Math.random() * v.H, 2, 2); }
    ctx.globalAlpha = 1;
  }
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

// the whole canvas becomes a CRT; the line types itself, results sit under it
function drawCRT(ctx, v, C, w, fx) {
  const t = w.ending.t, W = v.W, H = v.H, cx = v.cx, cy = v.cy;
  ctx.fillStyle = '#030503'; ctx.fillRect(0, 0, W, H);
  const m = Math.min(W, H) * 0.04, rr = Math.min(W, H) * 0.07;
  const on = fx.reduced ? 1 : smooth(span(t, ENDING.crtFrom, ENDING.powerTo));
  ctx.save();
  roundedRect(ctx, m, m, W - m * 2, H - m * 2, rr); ctx.clip();
  const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.65);
  sg.addColorStop(0, C.bg); sg.addColorStop(1, '#020402');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  const tint = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.65);
  tint.addColorStop(0, C.primary); tint.addColorStop(1, 'transparent');
  ctx.globalAlpha = 0.1 * on; ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = on;

  const line = fx.endingLine;
  let fs = Math.max(14, Math.min(W / 26, 30));
  ctx.font = `${fs}px ${FONT}`;
  const maxW = (W - m * 2) * 0.88, fullW = ctx.measureText(line).width;
  if (fullW > maxW) { fs = Math.max(8, fs * maxW / fullW); ctx.font = `${fs}px ${FONT}`; }
  const full = ctx.measureText(line).width;
  const typed = fx.reduced ? line.length : clamp(Math.floor((t - ENDING.typeFrom) * 1000 / ENDING.typeMs), 0, line.length);
  const ly = H * 0.3;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = C.primary; ctx.shadowColor = C.primary; ctx.shadowBlur = 10;
  if (t >= ENDING.typeFrom || fx.reduced) {
    const cursor = fx.reduced || typed < line.length || Math.floor(fx.time * 2.2) % 2 === 0 ? '▌' : ' ';
    ctx.fillText(line.slice(0, typed) + cursor, cx - full / 2, ly);
  }
  // results, dimmer, under the line
  const ra = smooth(span(t, ENDING.resultsAt, ENDING.resultsAt + 0.8));
  if (ra > 0) {
    const hi = Math.max(fx.hi, w.score), rs = fs * 0.75;
    ctx.shadowBlur = 6;
    const sy = ly + fs * 2.3;
    text(ctx, `${pad5(w.score)}   hi ${pad5(hi)}`, cx, sy, rs, C.primary, 'center', 0.6 * ra * on);
    const L = resultsLayout(v, fx.res, sy + rs * 0.9, H - m * 1.8, Math.max(8, rs * 0.85));
    fx.out.L = L;
    drawResults(ctx, v, C, fx, L, 0.6 * ra * on, 1);
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  for (let y = m; y < H - m; y += 3) ctx.fillRect(0, y, W, 1);
  const vg = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.3, cx, cy, Math.max(W, H) * 0.7);
  vg.addColorStop(0, 'transparent'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.strokeStyle = C.primary; ctx.globalAlpha = 0.18; ctx.lineWidth = 2;
  roundedRect(ctx, m, m, W - m * 2, H - m * 2, rr); ctx.stroke();
  ctx.globalAlpha = 1;
}

// ── pieces ──────────────────────────────────────────────────────────

function drawStars(ctx, v, C, stars, fx) {
  const reach = Math.max(v.W, v.H) * 0.7;
  const alpha = fx.starAlpha ?? 1;
  ctx.fillStyle = C.primary; ctx.strokeStyle = C.primary;
  for (const s of stars) {
    const [x, y] = [v.cx + Math.cos(s.a) * s.d * reach, v.cy + Math.sin(s.a) * s.d * reach];
    ctx.globalAlpha = Math.min(1, s.d * 1.4) * 0.7 * alpha;
    const z = 1 + s.d * 1.5;
    if (fx.warp > 1.5) {
      const len = (fx.warp - 1) * s.s * 0.02 * reach;
      ctx.lineWidth = z * 0.8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(s.a) * len, y - Math.sin(s.a) * len); ctx.stroke();
    } else ctx.fillRect(x, y, z, z);
  }
  ctx.globalAlpha = 1;
}

function drawRing(ctx, v, C, t) {
  ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.setLineDash([3, 6]);
  ctx.beginPath(); ctx.arc(v.cx, v.cy, v.R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  const pulse = 3 + Math.sin(t * 4) * 1.5;
  ctx.fillStyle = C.textBlue; ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.arc(v.cx, v.cy, pulse, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
}

// Dust sheds specks that float off behind it. Purely visual: lives in a WeakMap, never touches the world.
const speckState = new WeakMap();
const SPECK_LIFE = 0.8, SPECK_MAX = 10, SPECK_RATE = 16;

function drawDust(ctx, v, C, w) {
  for (const e of w.dust) {
    if (e.d <= 0) continue;
    const [x, y] = P(v, e.a, e.d), s = Math.max(3, dustSize(e.d) * v.R * 0.55);
    let st = speckState.get(e);
    if (!st) { st = { parts: [], acc: Math.random(), lx: x, ly: y, lt: w.t }; speckState.set(e, st); }
    const gap = w.t - st.lt, dt = Math.min(gap, 0.05);
    if (dt > 0) {
      let dx = x - st.lx, dy = y - st.ly;
      const sp = gap > 0.25 ? 0 : Math.hypot(dx, dy) / gap;
      let bx, by;     // unit vector pointing away from the direction of motion
      if (sp > v.R * 0.02) { bx = -dx / (sp * gap); by = -dy / (sp * gap); }
      else { const r = Math.random() * TAU; bx = Math.cos(r); by = Math.sin(r); }
      st.lx = x; st.ly = y; st.lt = w.t;
      for (const q of st.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
      st.parts = st.parts.filter(q => q.life > 0);
      st.acc += dt * SPECK_RATE;
      while (st.acc >= 1) {
        st.acc -= 1;
        if (st.parts.length >= SPECK_MAX) break;
        const spread = (Math.random() - 0.5) * 0.9, c = Math.cos(spread), n = Math.sin(spread);
        const rx = bx * c - by * n, ry = bx * n + by * c, speed = v.R * (0.05 + Math.random() * 0.1);
        st.parts.push({
          x: x + (Math.random() - 0.5) * s * 0.6, y: y + (Math.random() - 0.5) * s * 0.6,
          vx: rx * speed, vy: ry * speed, life: SPECK_LIFE * (0.7 + Math.random() * 0.3), big: Math.random() < 0.35 ? 3 : 2, c: Math.random() < 0.5,
        });
      }
    }
    for (const q of st.parts) {
      ctx.globalAlpha = clamp(q.life / SPECK_LIFE, 0, 1);
      ctx.fillStyle = q.c ? C.accentHi : C.primaryDim;
      ctx.fillRect(q.x, q.y, q.big, q.big);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.accent; ctx.fillRect(x - s / 2, y - s / 2, s, s);
    ctx.fillStyle = C.accentHi; ctx.fillRect(x - s / 2, y - s / 2, s, 1); ctx.fillRect(x - s / 2, y - s / 2, 1, s);
  }
}

function glowDot(ctx, x, y, r, inner, outer) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner); g.addColorStop(0.35, outer); g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

// lighthouse: a wedge of light fading out from the pulsar
function wedge(ctx, x, y, ang, half, L, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, L);
  g.addColorStop(0, color); g.addColorStop(1, 'transparent');
  ctx.globalAlpha = alpha; ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, L, ang - half, ang + half); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPulsars(ctx, v, C, w) {
  for (const p of w.pulsars) {
    const [x, y] = P(v, p.a, p.d), r = PULSAR_SIZE * v.R * 0.6;
    if (p.ph === 'idle') {
      for (let i = 0; i < 2; i++) wedge(ctx, x, y, p.rot + i * Math.PI, 0.16, r * 6, C.textBlue, 0.7);
    } else {
      const [bx, by] = P(v, p.a, 1.02), len = Math.hypot(bx - x, by - y);
      if (p.ph === 'tele') {
        wedge(ctx, x, y, p.a, 0.07, len, C.textBlue, Math.sin(p.pt * 60) > 0 ? 0.8 : 0.25);
      } else {
        ctx.strokeStyle = C.textBlue; ctx.globalAlpha = 0.95; ctx.lineWidth = Math.max(3, v.R * 0.05);
        ctx.shadowColor = C.textBlue; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(bx, by); ctx.stroke();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
    }
    if (p.flash > 0) glowDot(ctx, x, y, r * 1.8, '#ffffff', '#ffffff');
    else glowDot(ctx, x, y, r * 1.8, '#ffffff', C.textBlue);
  }
}

// particle wall: the arc is shimmering squares; the gap stays empty
function drawFronts(ctx, v, C, w) {
  for (const f of w.fronts) {
    const r = Math.max(1, f.d * v.R), k = Math.min(1, f.d), a0 = f.gap + GAP_HALF, a1 = f.gap + TAU - GAP_HALF;
    const n = Math.floor(30 + r * 1.1), p = 2 + k * 1.5;
    ctx.globalAlpha = 0.3 + 0.7 * k;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n, j = Math.sin(i * 12.9 + w.t * 20) * 2;
      ctx.fillStyle = i % 3 ? C.primaryDim : C.primary;
      ctx.fillRect(v.cx + Math.cos(a) * (r + j) - p / 2, v.cy + Math.sin(a) * (r + j) - p / 2, p, p);
    }
  }
  ctx.globalAlpha = 1;
}

function drawBoss(ctx, v, C, w) {
  const b = w.boss;
  if (!b || b.dead) return;
  const g = smooth(b.grow), r = 0.22 * v.R * g;
  if (r < 1) return;
  const half = Math.PI / 8 - 0.06;
  ctx.lineCap = 'butt';
  for (let i = 0; i < 8; i++) {
    if (b.segs[i] <= 0) continue;
    ctx.strokeStyle = b.flash > 0 ? '#ffffff' : C.accentHi;
    ctx.globalAlpha = 0.45 + 0.55 * b.segs[i] / b.segMax;
    ctx.lineWidth = r * 0.28;
    const a = segAngle(b, i);
    ctx.beginPath(); ctx.arc(v.cx, v.cy, r, a - half, a + half); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const cr = r * 0.62 * (1 + 0.06 * Math.sin(w.t * 6));
  const grad = ctx.createRadialGradient(v.cx, v.cy, 0, v.cx, v.cy, cr);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.5, b.coreFlash > 0 ? '#ffffff' : C.primary); grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(v.cx, v.cy, cr, 0, TAU); ctx.fill();
}

function drawBolts(ctx, v, C, w) {
  for (const b of w.bolts) {
    const [x, y] = P(v, b.a, b.d), s = v.R * 0.025;
    const g = ctx.createRadialGradient(x, y, 0, x, y, s * 2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, C.primary); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s * 2, 0, TAU); ctx.fill();
  }
}

// filament shell: an uneven ring of square dots around a bright center, with an icon for what it gives
function drawPickups(ctx, v, C, w) {
  for (const p of w.pickups) {
    const [x, y] = P(v, p.a, p.d), t = p.t;
    const R = v.R * 0.05 * (1 + 0.1 * Math.sin(t * 3)), dot = Math.max(2, v.R * 0.008);
    const blink = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t * TAU * 3));
    const fade = p.done ? clamp(p.fade / 0.4, 0, 1) : 1;
    for (let i = 0; i < 28; i++) {
      const a = i / 28 * TAU, rr = R * (1 + 0.12 * Math.sin(i * 2.7 + t * 2));
      ctx.fillStyle = i % 3 === 0 ? C.textBlue : '#ffffff';
      ctx.globalAlpha = blink * fade * (0.55 + 0.45 * Math.sin(i * 1.3 + t * 4) ** 2);
      ctx.fillRect(x + Math.cos(a) * rr - dot / 2, y + Math.sin(a) * rr - dot / 2, dot, dot);
    }
    ctx.globalAlpha = blink * fade;
    glowDot(ctx, x, y, R * 0.6, '#ffffff', C.textBlue);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffffff';
    if (p.kind === 'double') {
      ctx.font = `bold ${Math.max(8, R * 0.95)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('2', x, y + R * 0.05);
    } else {
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, R * 0.34, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawShots(ctx, v, C, w) {
  ctx.strokeStyle = C.accentHi; ctx.lineWidth = 2;
  for (const s of w.shots) {
    const [x1, y1] = P(v, s.a, s.d), [x2, y2] = P(v, s.a, s.d + 0.06);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
}

function drawSparks(ctx, v, C, w) {
  ctx.fillStyle = C.primary;
  for (const p of w.sparks) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillRect(v.cx + p.x * v.R, v.cy + p.y * v.R, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function streakHead(ctx, x, y, rad, C) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, C.primary); g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
}

function drawTrail(ctx, v, C, trail) {
  ctx.strokeStyle = C.primary;
  const n = trail.length;
  for (let i = n - 1; i > 0; i--) {
    const [ax, ay] = P(v, trail[i], 1), [bx, by] = P(v, trail[i - 1], 1);
    ctx.globalAlpha = (1 - i / n) * 0.9; ctx.lineWidth = 3 * (1 - i / n) + 0.5;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawStray(ctx, v, C, w, fx) {
  const s = w.stray;
  if (!s.alive) return;
  if (s.invuln > 0 && s.invuln < 50 && Math.floor(fx.time * 12) % 2 === 0) return;   // flicker
  const rad = clamp(v.R * 0.07, 8, 16);
  const e = w.ending;
  if (e && e.t >= ENDING.diveFrom) {
    if (e.t >= ENDING.diveTo) return;   // it has hit the atmosphere
    const k = smooth(span(e.t, ENDING.diveFrom, ENDING.diveTo)), a = s.a;
    const rad = v.R + (earthRadius(v) * 1.04 - v.R) * k;
    const hx = v.cx + Math.cos(a) * rad, hy = v.cy + Math.sin(a) * rad;
    for (let i = 1; i < 22; i++) {
      const back = Math.min(v.R, rad + i * 4);
      ctx.globalAlpha = (1 - i / 22) * 0.8; ctx.fillStyle = C.primary;
      ctx.beginPath(); ctx.arc(v.cx + Math.cos(a) * back, v.cy + Math.sin(a) * back, 2.5 * (1 - i / 22) + 0.5, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1; glowDot(ctx, hx, hy, 14, '#ffffff', C.primary);
    return;
  }
  drawTrail(ctx, v, C, fx.trail);
  const [x, y] = P(v, s.a, 1);
  streakHead(ctx, x, y, rad, C);
  if (s.shield) {
    ctx.strokeStyle = C.primary; ctx.globalAlpha = 0.35 + 0.15 * Math.sin(fx.time * 8); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, rad * 1.5, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  }
}

function text(ctx, str, x, y, size, color, align = 'left', alpha = 1) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}

// "2.5×10" + a raised, smaller exponent + " eV", right-aligned at x.
// Drawn by hand because unicode superscript zero looks like a degree sign in many monospace fonts.
function drawEnergy(ctx, logE, x, y, fs, color) {
  const { mantissa, exp } = energyParts(logE);
  const sub = fs * 0.65;
  ctx.font = `${fs}px ${FONT}`;
  const wUnit = ctx.measureText(' eV').width, wBase = ctx.measureText(mantissa + '×10').width;
  ctx.font = `${sub}px ${FONT}`;
  const wExp = ctx.measureText(exp).width;
  const x0 = x - wUnit - wExp - wBase;
  text(ctx, mantissa + '×10', x0, y, fs, color, 'left', 0.9);
  text(ctx, exp, x0 + wBase, y - fs * 0.45, sub, color, 'left', 0.9);
  text(ctx, ' eV', x0 + wBase + wExp, y, fs, color, 'left', 0.9);
}

function drawHud(ctx, v, C, w, fx) {
  const fs = fontSize(v), m = Math.max(8, fs * 0.9);
  if (fx.attract) { text(ctx, 'demo', m, m + fs, fs * 0.9, C.primary, 'left', 0.4); return; }
  text(ctx, pad5(w.score), m, m + fs, fs * 1.2, C.primary);
  drawEnergy(ctx, fx.energy, v.W - m, m + fs, fs, C.textBlue);
  // lives: tiny streak icons
  for (let i = 0; i < Math.max(0, w.lives); i++) {
    const x = m + 6 + i * fs * 2.2, y = v.H - m - 4;
    const g = ctx.createLinearGradient(x - fs * 1.2, y, x, y);
    g.addColorStop(0, 'transparent'); g.addColorStop(1, C.primary);
    ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - fs * 1.2, y); ctx.lineTo(x, y); ctx.stroke();
    streakHead(ctx, x, y, fs * 0.55, C);
  }
  text(ctx, fx.soundOn ? '♪ on' : '♪ off', v.W - m, v.H - m, fs, C.primary, 'right', fx.soundOn ? 0.9 : 0.5);
}

function drawWaveCard(ctx, v, C, w, fx) {
  const wv = w.wv;
  if (fx.attract || !wv || wv.phase !== 'intro' || w.phase !== 'play') return;
  const k = wv.t / INTRO_TIME;
  const a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
  text(ctx, `wave ${wv.n}`, v.cx, v.cy + fontSize(v) * 0.4, fontSize(v) * 2.2, C.primary, 'center', clamp(a, 0, 1));
}

// Layout for the initials entry / board block. Pure: also used by the game for touch hit tests.
// res: { stage: loading | entry | saving | fail | board, top, failed, initials, slot }
export function resultsLayout(v, res, top, bottom, base) {
  const avail = Math.max(10, bottom - top);
  const stage = res ? res.stage : 'loading';
  const L = { stage, top, base, s: base, rows: 0, slots: [], ok: null, skip: null };
  if (stage === 'entry' || stage === 'saving') {
    const s = Math.max(7, Math.min(base * 1.15, avail / 6.9));
    const sw = 1.8 * s, sh = 2.4 * s, gap = 0.5 * s;
    const x0 = v.cx - (3 * sw + 2 * gap) / 2, y0 = top + s * 1.8;
    L.s = s; L.titleY = top + s;
    for (let i = 0; i < 3; i++) L.slots.push({ x: x0 + i * (sw + gap), y: y0, w: sw, h: sh });
    const oy = y0 + sh + 0.8 * s;
    L.ok = { x: v.cx - 1.9 * s - 1.7 * s, y: oy, w: 3.4 * s, h: 1.5 * s };
    L.skip = { x: v.cx + 1.9 * s - 1.5 * s, y: oy, w: 3 * s, h: 1.5 * s };
    return L;
  }
  if (stage === 'fail') { L.s = base; L.msgY = top + base * 1.5; return L; }
  let n = res && !res.failed && res.top ? Math.min(BOARD_SIZE, res.top.length) : 0;
  const fit = k => avail / (Math.max(k, 1) * 1.3 + 1.9);
  let s = Math.min(base, fit(n));
  if (n > 5 && s < 9) { n = 5; s = Math.min(base, fit(5)); }
  s = Math.max(7, s);
  L.s = s; L.rows = n; L.rowH = 1.3 * s;
  L.rowsY = top + s * 1.1;
  L.hintY = L.rowsY + (n ? n * 1.3 * s : 0) + (n || (res && res.failed) ? 0.9 * s : 0);
  if (res && res.failed) L.offlineY = L.rowsY;
  if (res && res.failed) L.hintY = L.rowsY + 1.7 * s;
  return L;
}

function strokeBox(ctx, r, color, alpha) {
  ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 1;
  roundedRect(ctx, r.x, r.y, r.w, r.h, 3); ctx.stroke(); ctx.globalAlpha = 1;
}

// a: overall alpha (fade-in, CRT dimming). hintA: extra fade for the hint line.
function drawResults(ctx, v, C, fx, L, a, hintA) {
  const res = fx.res, s = L.s, now = fx.now || 0;
  if (a <= 0) return;
  if (L.stage === 'entry' || L.stage === 'saving') {
    const k = L.stage === 'saving' ? 0.5 : 1;
    text(ctx, 'new high score', v.cx, L.titleY, s, C.accentHi, 'center', a * k);
    const blink = Math.floor(now * 2.5) % 2 === 0;
    L.slots.forEach((r, i) => {
      const act = i === res.slot && L.stage === 'entry';
      text(ctx, res.initials[i], r.x + r.w / 2, r.y + r.h * 0.76, r.h * 0.82, act ? C.accentHi : C.primary, 'center',
        a * k * (act && !blink ? 0.45 : 1));
      ctx.globalAlpha = a * k * (act ? (blink ? 1 : 0.35) : 0.35); ctx.fillStyle = act ? C.accentHi : C.primary;
      ctx.fillRect(r.x, r.y + r.h * 0.9, r.w, Math.max(1.5, s * 0.12)); ctx.globalAlpha = 1;
    });
    strokeBox(ctx, L.ok, C.primary, a * k * 0.7);
    text(ctx, 'ok', L.ok.x + L.ok.w / 2, L.ok.y + L.ok.h * 0.7, s, C.primary, 'center', a * k);
    text(ctx, 'skip', L.skip.x + L.skip.w / 2, L.skip.y + L.skip.h * 0.68, s * 0.75, C.primary, 'center', a * k * 0.5);
    return;
  }
  if (L.stage === 'fail') {
    text(ctx, "couldn't save score", v.cx, L.msgY, s, C.primary, 'center', a * 0.5);
    return;
  }
  if (res && res.failed) {
    text(ctx, 'scores offline', v.cx, L.offlineY + s * 0.3, s, C.primary, 'center', a * 0.5);
  } else if (L.rows) {
    const mine = Math.sin(now * 7) * 0.15 + 0.85;
    for (let i = 0; i < L.rows; i++) {
      const r = res.top[i];
      const str = `${String(i + 1).padStart(2, ' ')}. ${r.initials}  ${pad5(r.score)}`;
      text(ctx, str, v.cx, L.rowsY + i * L.rowH + s, s, r.mine ? C.accentHi : C.primary, 'center',
        a * (r.mine ? mine : 0.85));
    }
  }
  text(ctx, 'enter again · esc arcade', v.cx, L.hintY + s * 0.6, s * 0.9, C.primary, 'center', 0.7 * hintA * a);
}

function drawOverlays(ctx, v, C, w, fx) {
  const fs = fontSize(v);
  if (w.phase === 'over') {
    ctx.globalAlpha = Math.min(0.65, w.overT * 1.5); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, v.W, v.H); ctx.globalAlpha = 1;
    const a = clamp(w.overT * 2 - 0.3, 0, 1);
    const ty = v.H * 0.2;
    text(ctx, 'signal lost', v.cx, ty, fs * 2.4, C.primary, 'center', a);
    const ra = clamp(w.overT * 2 - 0.9, 0, 1);
    const sy = ty + fs * 2.3;
    text(ctx, `${pad5(w.score)}   hi ${pad5(Math.max(fx.hi, w.score))}`, v.cx, sy, fs * 1.2, C.primary, 'center', ra);
    const L = resultsLayout(v, fx.res, sy + fs * 1.1, v.H - fs * 1.2, fs);
    fx.out.L = L;
    drawResults(ctx, v, C, fx, L, ra, clamp(w.overT - 1.6, 0, 1));
  }
  if (fx.paused && !fx.attract) {
    ctx.globalAlpha = 0.7; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, v.W, v.H); ctx.globalAlpha = 1;
    text(ctx, 'paused', v.cx, v.cy - fs * 0.4, fs * 2.2, C.primary, 'center');
    text(ctx, 'any key resume · esc arcade', v.cx, v.cy + fs * 2, fs, C.primary, 'center', 0.7);
  }
}

// ── frame ───────────────────────────────────────────────────────────
// fx: { C, stars, trail, time, warp, starAlpha, energy, hi, soundOn, attract, paused, endingLine }

export function drawFrame(ctx, v, w, fx) {
  const C = fx.C;
  ctx.setLineDash([]);
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, v.W, v.H);
  drawStars(ctx, v, C, fx.stars, fx);
  drawRing(ctx, v, C, fx.time);
  const e = w.ending;
  fx.out = fx.out || {}; fx.out.L = null;
  if (e && e.t >= ENDING.crtFrom) { drawCRT(ctx, v, C, w, fx); drawOverlays(ctx, v, C, w, fx); return; }
  if (e) drawEarthScene(ctx, v, C, w, fx);
  drawFronts(ctx, v, C, w);
  drawBoss(ctx, v, C, w);
  drawDust(ctx, v, C, w);
  drawPulsars(ctx, v, C, w);
  drawBolts(ctx, v, C, w);
  drawPickups(ctx, v, C, w);
  drawShots(ctx, v, C, w);
  drawSparks(ctx, v, C, w);
  drawStray(ctx, v, C, w, fx);
  drawHud(ctx, v, C, w, fx);
  drawWaveCard(ctx, v, C, w, fx);
  drawOverlays(ctx, v, C, w, fx);
}
