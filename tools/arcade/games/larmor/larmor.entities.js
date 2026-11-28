// larmor: world state, enemies, waves, collisions. Pure logic: no DOM, no canvas.
// Space is polar. Every object has an angle `a` and a depth `d` (0 = center, 1 = the ring).
// All sizes and distances are in units of R (the ring radius), so no screen size is needed here.

export const TAU = Math.PI * 2;
export const LAST_WAVE = 12;
export const BOSS_WAVES = [4, 8, 12];
export const E_START = 9;     // log10(eV) at wave 1
export const E_END = 20.5;    // log10(eV) when wave 12 is cleared (3.2×10²⁰)

export const MAX_V = 2.8;          // rad/s
export const FIRE_EVERY = 0.16;    // s
export const MAX_SHOTS = 5;
export const SHOT_SPEED = 1.4;     // d per second
export const GAP_HALF = (55 * Math.PI / 180) / 2;
export const INTRO_TIME = 1.2;

export const ENDING_LINE = 'and then i stopped moving.';

// Ending timeline, seconds from the moment wave 12 is cleared.
export const ENDING = {
  warp: 3,            // stars stretch, energy counts up; then the stars ease back down
  warpDown: 5,
  growFrom: 1, growTo: 5,          // Earth grows from the center
  diveFrom: 5.2, diveTo: 6.6,      // Stray leaves the ring and dives to Earth's limb
  showerFrom: 6.6, showerTo: 8.2,  // impact glow, then the air shower
  staticFrom: 8.2,                 // static builds over the scene
  crtFrom: 8.8, powerTo: 9.3,      // the whole canvas becomes a CRT; it powers on
  typeFrom: 9.4, typeMs: 40,       // the line types itself, 40 ms per character
  resultsAt: 0,                    // set just below from the line length
};
ENDING.resultsAt = ENDING.typeFrom + ENDING_LINE.length * ENDING.typeMs / 1000 + 2;

// helpers

export function wrap(a) { a %= TAU; return a < 0 ? a + TAU : a; }
export function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return d;
}
export function polar(a, d) { return [Math.cos(a) * d, Math.sin(a) * d]; }
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const dustSize = d => 0.03 + 0.05 * Math.max(d, 0);
export const PULSAR_SIZE = 0.07;
const hitRadius = size => size * 0.6 + 0.015;

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export function energyParts(logE) {
  let e = Math.floor(logE + 1e-9);
  let ms = Math.pow(10, logE - e).toFixed(1);
  if (ms === '10.0') { ms = '1.0'; e++; }
  return { mantissa: ms, exp: String(e) };
}
export function formatEnergy(logE) {
  const { mantissa, exp } = energyParts(logE);
  return mantissa + '×10' + exp.split('').map(c => SUP[+c]).join('') + ' eV';
}

// world

export function createWorld({ attract = false, seed, startWave = 1 } = {}) {
  const w = {
    attract,
    rng: mulberry32(seed ?? ((Math.random() * 4294967296) >>> 0)),
    t: 0,
    phase: 'play',          // play | ending | over | cleared
    score: 0,
    lives: 3,
    wavesCleared: startWave - 1,
    bump: 0,
    nid: 0,
    stray: { a: Math.PI / 2, va: 0, alive: true, respawn: 0, invuln: 0, shield: false, doubleT: 0, cd: 0 },
    shots: [], dust: [], pulsars: [], fronts: [], bolts: [], pickups: [], sparks: [],
    forms: {}, boss: null, wv: null, ending: null, events: [], ai: null,
  };
  planWave(w, startWave);
  return w;
}

function emit(w, type, a = 0, d = 0) { w.events.push({ type, a, d }); }

function spark(w, a, d, n, speed = 0.5) {
  const [x, y] = polar(a, d);
  for (let i = 0; i < n; i++) {
    const ang = w.rng() * TAU, v = (0.2 + w.rng() * 0.8) * speed;
    w.sparks.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 0.5, max: 0.5 });
  }
}

function planWave(w, n) {
  const boss = BOSS_WAVES.includes(n);
  const rng = w.rng;
  const forms = boss ? 3 : 2 + Math.floor(n / 2);
  const sizes = [];
  for (let i = 0; i < forms; i++) {
    sizes.push(boss ? 4 : Math.min(8, 4 + Math.floor(n / 3) + (rng() < 0.5 ? 0 : 1)));
  }
  const pulsars = !boss && n >= 2 ? Math.min(3, 1 + Math.floor((n - 2) / 4)) : 0;
  const fronts = !boss && n >= 3 ? Math.min(3, 1 + Math.floor((n - 3) / 4)) : 0;
  const total = sizes.reduce((a, b) => a + b, 0) + pulsars * 3;
  w.wv = {
    n, boss, phase: 'intro', t: 0,
    sizes, formsLeft: forms, nextForm: 0.3, formGap: boss ? 6 : 2.2,
    pulsarsLeft: pulsars, nextPulsar: 1.5,
    frontsLeft: fronts, nextFront: 3,
    pickupAt: n >= 2 ? 4 + rng() * 8 : -1,
    killedW: 0, total: Math.max(total, 1), clearT: 0,
  };
  w.boss = null;
  if (boss) {
    const segHp = n === 12 ? 4 : 3, coreHp = n === 12 ? 25 : 15;
    w.boss = {
      grow: 0, rot: 0, segs: Array(8).fill(segHp), segMax: segHp,
      core: coreHp, coreMax: coreHp, fire: 2.2, flash: 0, coreFlash: 0, dead: false,
    };
  }
  emit(w, 'wave');
}

function spawnFormation(w, size, slow) {
  const rng = w.rng, n = w.wv.n, id = ++w.nid;
  const base = rng() * TAU, dir = rng() < 0.5 ? -1 : 1;
  const orbitD = 0.55 + rng() * 0.2, orbitW = dir * (0.25 + rng() * 0.2);
  const slowK = slow ? 0.6 : 1;
  w.forms[id] = { left: size, cd: (1.5 + rng() * 2) * (slow ? 2 : 1), n, slowK };
  for (let i = 0; i < size; i++) {
    w.dust.push({ id, a: wrap(base + i * 0.35), d: -i * 0.08, spin: dir * 1.1, orbitD: orbitD + 0.025 * Math.sin(i * 2), orbitW, st: 'spiral', slowK });
  }
}

function spawnPulsar(w) {
  w.pulsars.push({
    a: w.rng() * TAU, d: 0, hp: 3, flash: 0, rot: 0,
    spin: (w.rng() < 0.5 ? -1 : 1) * (0.18 + w.rng() * 0.12),
    ph: 'idle', pt: 0, cd: 1.6 + w.rng() * 1.6,
  });
}

function spawnPickup(w, a, d = 0.12) {
  w.pickups.push({ a: a ?? w.rng() * TAU, d, kind: w.rng() < 0.5 ? 'double' : 'shield', fade: 0, done: false, t: 0 });
  emit(w, 'appear', w.pickups[w.pickups.length - 1].a, d);
}

// damage

function hitPlayer(w) {
  const s = w.stray;
  if (!s.alive || s.invuln > 0) return false;
  if (s.shield) { s.shield = false; s.invuln = 0.8; emit(w, 'shieldpop', s.a, 1); return true; }
  spark(w, s.a, 1, 22, 0.7);
  emit(w, 'hit', s.a, 1);
  s.alive = false; s.va = 0; s.respawn = 1.2; s.doubleT = 0;
  if (!w.attract) {
    w.lives--;
    if (w.lives <= 0) { w.phase = 'over'; w.overT = 0; emit(w, 'over'); }
  }
  return true;
}

function award(w, pts, a, d) { if (!w.attract) w.score += pts; if (pts) emit(w, 'score', a, d); }

function killDust(w, e, pts) {
  spark(w, e.a, e.d, 10, 0.4);
  emit(w, 'pop', e.a, e.d);
  if (pts) { award(w, pts, e.a, e.d); w.wv.killedW += 1; }
  const f = w.forms[e.id];
  if (f && --f.left <= 0) {
    delete w.forms[e.id];
    if (pts && w.wv.n >= 2 && w.rng() < 1 / 6) spawnPickup(w, e.a, e.d);
  }
}

function collect(w, p) {
  const s = w.stray;
  if (p.kind === 'double') s.doubleT = 12; else s.shield = true;
  w.bump += 0.08;
  emit(w, 'pickup', p.a, 1);
  spark(w, p.a, 1, 14, 0.5);
}

// energy

export function waveFrac(w) {
  const v = w.wv;
  if (!v) return 0;
  if (v.boss && w.boss) {
    const b = w.boss;
    const tot = 8 * b.segMax + b.coreMax;
    const left = b.segs.reduce((a, c) => a + c, 0) + b.core;
    return clamp(1 - left / tot, 0, 1);
  }
  return clamp(v.killedW / v.total, 0, 1);
}

export function energyLog(w) {
  if (w.ending) {
    const k = clamp(w.ending.t / ENDING.warp, 0, 1);
    const s = k * k * (3 - 2 * k);
    return w.ending.e0 + (E_END - w.ending.e0) * s;
  }
  const done = w.wavesCleared >= LAST_WAVE;
  const prog = done ? 1 : (w.wavesCleared + (w.wv && w.wv.phase !== 'clear' ? waveFrac(w) : 0)) / LAST_WAVE;
  return Math.min(E_END, E_START + (E_END - E_START) * prog + w.bump);
}

// step

export function stepWorld(w, dt, input = {}) {
  w.t += dt;
  stepSparks(w, dt);
  if (w.phase === 'over') { w.overT += dt; return; }
  if (w.phase === 'cleared') { w.ending.t += dt; return; }
  if (w.phase === 'ending') { stepEnding(w, dt); return; }

  stepStray(w, dt, input);
  stepWave(w, dt);
  stepDust(w, dt);
  stepPulsars(w, dt);
  stepFronts(w, dt);
  stepBoss(w, dt);
  stepBolts(w, dt);
  stepShots(w, dt);
  stepPickups(w, dt);
  checkClear(w, dt);
}

function stepSparks(w, dt) {
  for (const p of w.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  w.sparks = w.sparks.filter(p => p.life > 0);
}

function stepStray(w, dt, input) {
  const s = w.stray;
  s.invuln = Math.max(0, s.invuln - dt);
  s.doubleT = Math.max(0, s.doubleT - dt);
  s.cd -= dt;
  if (!s.alive) {
    s.respawn -= dt;
    if (s.respawn <= 0) { s.alive = true; s.invuln = 2; s.cd = 0; }
    return;
  }
  let want = (input.dir || 0) * MAX_V;
  if (input.target != null) {
    const df = angDiff(input.target, s.a);
    want = Math.abs(df) < 0.02 ? 0 : clamp(df * 7, -MAX_V, MAX_V);
  }
  const acc = want === 0 ? 18 : 12;
  s.va += clamp(want - s.va, -acc * dt, acc * dt);
  s.a = wrap(s.a + s.va * dt);

  if (input.fire && s.cd <= 0) {
    const dbl = s.doubleT > 0, n = dbl ? 2 : 1;
    if (w.shots.length + n <= (dbl ? MAX_SHOTS + 1 : MAX_SHOTS)) {
      if (dbl) { w.shots.push({ a: s.a - 0.05, d: 1, prev: 1 }, { a: s.a + 0.05, d: 1, prev: 1 }); }
      else w.shots.push({ a: s.a, d: 1, prev: 1 });
      s.cd = FIRE_EVERY;
      emit(w, 'shot', s.a, 1);
    }
  }
}

function stepWave(w, dt) {
  const v = w.wv;
  v.t += dt;
  if (v.phase === 'intro') { if (v.t >= INTRO_TIME) { v.phase = 'active'; v.t = 0; } return; }
  if (v.phase !== 'active') return;

  if (v.formsLeft > 0) {
    v.nextForm -= dt;
    // later formations of a normal wave also wait for the field to thin out a little
    if (v.nextForm <= 0 && (v.boss ? w.dust.length < 9 : w.dust.length < 26)) {
      spawnFormation(w, v.sizes[v.sizes.length - v.formsLeft], v.boss);
      v.formsLeft--; v.nextForm = v.formGap;
    }
  }
  if (v.pulsarsLeft > 0 && (v.nextPulsar -= dt) <= 0) { spawnPulsar(w); v.pulsarsLeft--; v.nextPulsar = 3.5; }
  if (v.frontsLeft > 0 && (v.nextFront -= dt) <= 0) {
    w.fronts.push({ d: 0, gap: w.rng() * TAU, checked: false });
    v.frontsLeft--; v.nextFront = 6;
  }
  if (v.pickupAt >= 0 && v.t >= v.pickupAt) { v.pickupAt = -1; spawnPickup(w); }
}

function stepDust(w, dt) {
  const n = w.wv.n, s = w.stray;
  const active = w.wv.phase === 'active';
  for (const [key, f] of Object.entries(w.forms)) {
    if (!active) break;
    f.cd -= dt;
    if (f.cd <= 0) {
      const id = +key;
      const holders = w.dust.filter(e => e.id === id && e.st === 'hold');
      if (holders.length) holders[Math.floor(w.rng() * holders.length)].st = 'dive';
      f.cd = Math.max(0.9, 3.6 - 0.22 * n) * (f.slowK < 1 ? 2 : 1) * (0.6 + w.rng() * 0.8);
    }
  }
  for (let i = w.dust.length - 1; i >= 0; i--) {
    const e = w.dust[i];
    switch (e.st) {
      case 'spiral':
        e.d += dt * 0.3 * e.slowK;
        e.a = wrap(e.a + e.spin * dt * 1.4 * (1 - Math.min(Math.max(e.d, 0), 1)));
        if (e.d >= e.orbitD) e.st = 'hold';
        break;
      case 'hold':
        e.a = wrap(e.a + e.orbitW * dt * e.slowK);
        e.d += (e.orbitD + 0.02 * Math.sin(w.t * 2 + e.id) - e.d) * Math.min(1, dt * 4);
        break;
      case 'dive':
        e.a = wrap(e.a + clamp(angDiff(s.a, e.a), -0.9 * dt, 0.9 * dt));
        e.d += (0.55 + 0.05 * n) * e.slowK * dt;
        if (e.d >= 1.05) e.st = 'return';
        break;
      case 'return':
        e.d -= 0.6 * dt;
        if (e.d <= e.orbitD) e.st = 'hold';
        break;
    }
    if (s.alive && e.d > 0.93 && e.d < 1.1 && Math.abs(angDiff(e.a, s.a)) < 0.09) {
      if (hitPlayer(w)) { w.dust.splice(i, 1); killDust(w, e, 0); }
    }
  }
}

function stepPulsars(w, dt) {
  const s = w.stray;
  for (let i = w.pulsars.length - 1; i >= 0; i--) {
    const p = w.pulsars[i];
    if (p.ph === 'idle') p.rot += dt * 2.4;   // the beams hold still while it aims and fires
    p.flash = Math.max(0, p.flash - dt);
    if (p.d < 0.5) p.d = Math.min(0.5, p.d + dt * 0.35);
    if (p.ph === 'idle') {
      p.a = wrap(p.a + p.spin * dt);
      if (p.d >= 0.5 && (p.cd -= dt) <= 0) { p.ph = 'tele'; p.pt = 0; }
    } else if (p.ph === 'tele') {
      p.pt += dt;
      if (p.pt >= 0.5) { p.ph = 'beam'; p.pt = 0; emit(w, 'beam', p.a, p.d); }
    } else {
      p.pt += dt;
      if (s.alive && Math.abs(angDiff(s.a, p.a)) < 0.12) hitPlayer(w);
      if (p.pt >= 0.4) { p.ph = 'idle'; p.cd = 2.6; }
    }
  }
}

function stepFronts(w, dt) {
  const s = w.stray;
  for (let i = w.fronts.length - 1; i >= 0; i--) {
    const f = w.fronts[i];
    f.d += dt / 2.8;
    if (!f.checked && f.d >= 0.97) {
      f.checked = true;
      if (s.alive) {
        if (Math.abs(angDiff(s.a, f.gap)) <= GAP_HALF) { award(w, 25, s.a, 1); emit(w, 'front', s.a, 1); }
        else hitPlayer(w);
      }
    }
    if (f.d >= 1.08) w.fronts.splice(i, 1);
  }
}

const BOSS_SPIN = 0.3;
export function segAngle(b, i) { return b.rot + i * Math.PI / 4; }

function stepBoss(w, dt) {
  const b = w.boss;
  if (!b || b.dead || w.wv.phase === 'intro') return;
  b.grow = Math.min(1, b.grow + dt / 1.2);
  b.flash = Math.max(0, b.flash - dt);
  b.coreFlash = Math.max(0, b.coreFlash - dt);
  b.rot = wrap(b.rot + dt * BOSS_SPIN);
  if (b.grow < 1) return;
  const left = b.segs.reduce((a, c) => a + c, 0) + b.core;
  const frac = left / (8 * b.segMax + b.coreMax);
  b.fire -= dt;
  if (b.fire <= 0 && w.stray.alive) {
    w.bolts.push({ a: w.stray.a, d: 0.25 });
    emit(w, 'bolt', w.stray.a, 0.25);
    b.fire = 0.6 + 0.7 * frac;
  } else if (b.fire <= 0) b.fire = 0.4;
}

function stepBolts(w, dt) {
  const s = w.stray;
  for (let i = w.bolts.length - 1; i >= 0; i--) {
    const b = w.bolts[i];
    b.d += dt * 0.55;
    if (s.alive && b.d > 0.95 && Math.abs(angDiff(b.a, s.a)) < 0.1) {
      hitPlayer(w); w.bolts.splice(i, 1); continue;
    }
    if (b.d > 1.05) w.bolts.splice(i, 1);
  }
}

function hitTest(w, x, y) {
  // returns true when the point (x, y) hits something; handles the damage
  for (let j = w.dust.length - 1; j >= 0; j--) {
    const e = w.dust[j];
    if (e.d <= 0) continue;
    const [ex, ey] = polar(e.a, e.d);
    if (Math.hypot(x - ex, y - ey) < hitRadius(dustSize(e.d))) {
      w.dust.splice(j, 1); killDust(w, e, 10);
      return true;
    }
  }
  for (let j = w.pulsars.length - 1; j >= 0; j--) {
    const p = w.pulsars[j];
    const [px, py] = polar(p.a, p.d);
    if (Math.hypot(x - px, y - py) < PULSAR_SIZE * 0.8) {
      p.flash = 0.12;
      if (--p.hp <= 0) {
        w.pulsars.splice(j, 1);
        spark(w, p.a, p.d, 16, 0.5); emit(w, 'pop', p.a, p.d);
        award(w, 50, p.a, p.d); w.wv.killedW += 3;
      } else emit(w, 'pop', p.a, p.d);
      return true;
    }
  }
  return false;
}

function stepShots(w, dt) {
  const b = w.boss;
  for (let i = w.shots.length - 1; i >= 0; i--) {
    const sh = w.shots[i];
    sh.prev = sh.d;
    sh.d -= SHOT_SPEED * dt;
    let gone = false;
    // sample the segment travelled this frame so fast frames can't tunnel
    for (const k of [0, 0.5, 1]) {
      const d = sh.prev + (sh.d - sh.prev) * k;
      const [x, y] = polar(sh.a, d);
      if (hitTest(w, x, y)) { gone = true; break; }
    }
    if (!gone && b && !b.dead && b.grow >= 1) {
      if (!sh.bc && sh.d <= 0.24) {
        sh.bc = true;
        const idx = Math.floor(wrap(sh.a - b.rot + Math.PI / 8) / (Math.PI / 4)) % 8;
        if (b.segs[idx] > 0) {
          b.segs[idx]--; b.flash = 0.12;
          emit(w, 'seg', sh.a, 0.24);
          if (b.segs[idx] <= 0) {
            spark(w, segAngle(b, idx), 0.22, 14, 0.5);
            award(w, 50, sh.a, 0.24);
          }
          gone = true;
        }
      }
      if (!gone && sh.d <= 0.15 && !sh.cc && b.segs.every(v => v <= 0)) {
        sh.cc = true;
        b.core--; b.coreFlash = 0.12;
        emit(w, 'seg', sh.a, 0.15);
        spark(w, sh.a, 0.15, 6, 0.3);
        if (b.core <= 0) killBoss(w);
        gone = true;
      }
    }
    if (gone || sh.d < 0.04) w.shots.splice(i, 1);
  }
}

function killBoss(w) {
  const b = w.boss;
  b.dead = true;
  award(w, 1000, 0, 0);
  spark(w, 0, 0.001, 50, 0.9);
  emit(w, 'pop', 0, 0);
  for (const e of w.dust) { spark(w, e.a, e.d, 6, 0.3); }
  w.dust = []; w.forms = {}; w.bolts = []; w.wv.formsLeft = 0;
}

function stepPickups(w, dt) {
  const s = w.stray;
  for (let i = w.pickups.length - 1; i >= 0; i--) {
    const p = w.pickups[i];
    p.t += dt;
    if (p.done) { p.fade -= dt; if (p.fade <= 0) w.pickups.splice(i, 1); continue; }
    p.d += dt / 3.2;
    if (p.d >= 1) {
      p.d = 1; p.done = true; p.fade = 0.4;
      if (s.alive && Math.abs(angDiff(p.a, s.a)) < 0.15) { collect(w, p); w.pickups.splice(i, 1); }
    }
  }
}

function checkClear(w, dt) {
  const v = w.wv;
  if (v.phase === 'clear') {
    v.clearT += dt;
    if (v.clearT >= 1.5) nextWave(w);
    return;
  }
  if (v.phase !== 'active') return;
  const done = v.boss
    ? w.boss.dead
    : v.formsLeft === 0 && v.pulsarsLeft === 0 && v.frontsLeft === 0 &&
      w.dust.length === 0 && w.pulsars.length === 0 && w.fronts.length === 0;
  if (!done) return;
  v.phase = 'clear'; v.clearT = 0;
  w.wavesCleared++;
  w.bump = 0;
}

function nextWave(w) {
  const n = w.wv.n;
  if (n >= LAST_WAVE) {
    if (w.attract) { w.wavesCleared = 1; planWave(w, 2); return; }
    beginEnding(w);
    return;
  }
  planWave(w, n + 1);
}

export function beginEnding(w) {
  w.phase = 'ending';
  w.ending = { t: 0, e0: energyLog(w) };
  w.dust = []; w.pulsars = []; w.fronts = []; w.bolts = []; w.shots = []; w.pickups = []; w.forms = {};
  const s = w.stray;
  s.alive = true; s.invuln = 99; s.va = 0; s.shield = false; s.doubleT = 0;
  emit(w, 'ending');
}

function stepEnding(w, dt) {
  const e = w.ending, s = w.stray;
  e.t += dt;
  // control stops; Stray keeps gliding along the ring, then holds its angle for the dive
  if (e.t < ENDING.diveFrom) {
    s.va += (0.5 - s.va) * Math.min(1, dt * 2);
    s.a = wrap(s.a + s.va * dt);
  }
  if (e.t >= ENDING.resultsAt) { w.phase = 'cleared'; }
}

// attract-mode ai

export function attractInput(w, dt) {
  const ai = w.ai || (w.ai = { cd: 0, target: null });
  ai.cd -= dt;
  if (ai.cd <= 0) {
    ai.cd = 0.2 + w.rng() * 0.25;   // a little lag so it looks human
    ai.target = pickTarget(w);
  }
  return { dir: 0, fire: true, target: ai.target };
}

function pickTarget(w) {
  const b = w.boss;
  if (b && !b.dead && b.grow >= 1) {
    let best = null, bd = 9;
    for (let i = 0; i < 8; i++) {
      if (b.segs[i] <= 0) continue;
      const lead = segAngle(b, i) + BOSS_SPIN * 0.7;   // shots take a while to arrive
      const df = Math.abs(angDiff(lead, w.stray.a));
      if (df < bd) { bd = df; best = lead; }
    }
    if (best != null) return best;
    return w.stray.a;
  }
  let pick = null, depth = -1;
  for (const e of w.dust) if (e.st === 'dive' && e.d > depth) { pick = e; depth = e.d; }
  if (!pick) for (const e of w.dust) if (e.d > 0.2 && e.d > depth) { pick = e; depth = e.d; }
  if (!pick) for (const p of w.pulsars) if (p.d > depth) { pick = p; depth = p.d; }
  if (pick) return pick.a;
  return null;
}
