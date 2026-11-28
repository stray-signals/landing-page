// larmor: an orbit shooter. Stray rides a magnetic field line (the ring) and shoots inward.
// createGame(canvas, { mode, colors, hiScore, onScore, onExit, keyTarget, scores: { fetchTop(n), submit(initials, score) } })
//   -> { start, pause, resume, destroy, setColors }
import { createWorld, stepWorld, attractInput, energyLog, ENDING, ENDING_LINE, beginEnding } from './larmor.entities.js';
import { makeView, makeStars, stepStars, drawFrame, soundRect } from './larmor.draw.js';
import { createAudio } from './larmor.audio.js';
import { BOARD_SIZE, INITIALS_KEY, qualifies, insertRow, cycleLetter, cleanInitials } from './larmor.scores.js';

export { ENDING_LINE };
// Testing only: on localhost, press 0 during play to jump straight to the ending.
const DEV = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const CLEARED_KEY = 'stray_arcade_larmor_cleared';
const smooth = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };

const LEFT = ['ArrowLeft', 'KeyA'], RIGHT = ['ArrowRight', 'KeyD'], FIRE = ['Space', 'KeyZ', 'KeyJ'];
const SOUNDS = { shot: 'shot', pop: 'pop', hit: 'hit', shieldpop: 'thud', pickup: 'pickup', appear: 'appear', seg: 'thud', ending: 'swell' };

export function createGame(canvas, opts = {}) {
  const { mode = 'play', onScore = () => {}, onExit = () => {}, keyTarget = document, scores = null } = opts;
  const attract = mode === 'attract';
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  const audio = attract ? null : createAudio();

  let C = opts.colors;
  let hi = opts.hiScore | 0;
  let world = newWorld();
  let stars = [], trail = [];
  let W = 0, H = 0, dpr = 1, view = makeView(1, 1);
  let raf = 0, last = 0, running = false, paused = false, destroyed = false, scored = false;
  let dispE = 0, endWarp = 1;
  const keys = new Set();
  const ptr = { down: false, angle: 0 };
  const out = { L: null };       // layout of the results block, written by the drawing code
  let res = null;                // initials entry + board state for the current run

  function newWorld() { return createWorld({ attract, startWave: attract ? 2 : 1 }); }

  // sizing
  canvas.style.cssText += ';display:block;width:100%;height:100%;touch-action:none;';
  function size() {
    const host = canvas.parentElement || canvas;
    const r = host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view = makeView(W, H);
    const want = Math.round(Math.min(110, Math.max(36, W * H / 4500)));
    if (stars.length !== want) stars = makeStars(want);
    if (!running || paused || (reduced && attract)) render();
  }
  const ro = new ResizeObserver(size);
  ro.observe(canvas.parentElement || canvas);

  // input
  const has = list => list.some(k => keys.has(k));
  function readInput(dt) {
    if (attract) return attractInput(world, dt);
    const dir = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
    return { dir, fire: has(FIRE) || ptr.down, target: ptr.down && !dir ? ptr.angle : null };
  }

  function restart() {
    world = newWorld(); trail = []; scored = false; res = null; dispE = 0; endWarp = 1; keys.clear();
  }

  function isDone() { return world.phase === 'over' || world.phase === 'cleared'; }
  function resultsReady() {
    return (world.phase === 'over' && world.overT > 1.4) || (world.phase === 'cleared' && world.ending.t > ENDING.resultsAt + 1);
  }

  // results: initials entry + shared board
  function startResults() {
    let saved = 'AAA';
    try { saved = cleanInitials(localStorage.getItem(INITIALS_KEY)); } catch (e) { /* ignore */ }
    const r = res = { stage: 'loading', top: [], failed: false, initials: saved.split(''), slot: 0, submitted: false };
    const w = world;
    Promise.resolve().then(() => scores.fetchTop(BOARD_SIZE)).then(
      top => { r.top = Array.isArray(top) ? top : []; },
      () => { r.failed = true; }
    ).then(() => {
      if (destroyed || res !== r || world !== w) return;
      const eligible = !r.failed && !w.devSkip && qualifies(w.score, r.top);
      r.stage = eligible ? 'entry' : 'board';
      if (!eligible) r.submitted = true;
      render();
    });
  }

  function submitEntry() {
    const r = res, w = world;
    if (!r || r.stage !== 'entry' || r.submitted || attract || w.devSkip) return;
    r.submitted = true; r.stage = 'saving';
    const ini = r.initials.join(''), score = w.score;
    try { localStorage.setItem(INITIALS_KEY, ini); } catch (e) { /* ignore */ }
    Promise.resolve().then(() => scores.submit(ini, score)).then(() => true, () => false).then(ok => {
      if (destroyed || res !== r || world !== w) return;
      r.top = insertRow(r.top, { initials: ini, score, mine: true });
      if (ok) r.stage = 'board';
      else { r.stage = 'fail'; r.failUntil = performance.now() + 2000; }
    });
  }

  function skipEntry() {
    if (!res || res.stage !== 'entry') return;
    res.submitted = true; res.stage = 'board';
  }

  function entryKey(e) {
    const r = res, k = e.key;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'Enter') { e.preventDefault(); submitEntry(); }
    else if (k === 'Escape') { e.preventDefault(); skipEntry(); }
    else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); r.initials[r.slot] = cycleLetter(r.initials[r.slot], k === 'ArrowUp' ? 1 : -1); }
    else if (k === 'ArrowLeft') { e.preventDefault(); r.slot = Math.max(0, r.slot - 1); }
    else if (k === 'ArrowRight') { e.preventDefault(); r.slot = Math.min(2, r.slot + 1); }
    else if (k === 'Backspace') { e.preventDefault(); r.slot = Math.max(0, r.slot - 1); }
    else if (/^[a-zA-Z]$/.test(k)) { e.preventDefault(); r.initials[r.slot] = k.toUpperCase(); r.slot = Math.min(2, r.slot + 1); }
  }

  function entryTap(x, y) {
    const L = out.L, r = res;
    if (!L || !L.ok) return;
    const inR = (q, pad = 0) => x >= q.x - pad && x <= q.x + q.w + pad && y >= q.y - pad && y <= q.y + q.h + pad;
    if (inR(L.ok, 4)) { submitEntry(); return; }
    if (inR(L.skip, 6)) { skipEntry(); return; }
    L.slots.forEach((q, i) => {
      if (!inR(q, 3)) return;
      r.slot = i;
      r.initials[i] = cycleLetter(r.initials[i], y < q.y + q.h / 2 ? 1 : -1);
    });
  }

  function onKeyDown(e) {
    if (destroyed || attract) return;
    if (audio) audio.unlock();
    const code = e.code;
    if ([...LEFT, ...RIGHT, ...FIRE, 'ArrowUp', 'ArrowDown'].includes(code)) e.preventDefault();
    if (e.repeat && (paused || (isDone() && !(res && res.stage === 'entry')))) return;
    if (paused) {
      e.preventDefault();
      if (code === 'Escape') onExit(); else resume();
      return;
    }
    if (isDone()) {
      if (!resultsReady()) return;
      if (res && res.stage === 'entry') { entryKey(e); return; }
      if (res && (res.stage === 'saving' || res.stage === 'fail')) return;
      if (code === 'Enter') { e.preventDefault(); restart(); }
      else if (code === 'Escape') { e.preventDefault(); onExit(); }
      return;
    }
    if (DEV && code === 'Digit0' && world.phase === 'play') { world.devSkip = true; beginEnding(world); return; }
    if (code === 'KeyM') { audio.toggle(); render(); return; }
    if (code === 'KeyP' || code === 'Escape') { e.preventDefault(); pause(); return; }
    keys.add(code);
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onBlur() { keys.clear(); ptr.down = false; }

  function pointAngle(e) {
    const r = canvas.getBoundingClientRect();
    return Math.atan2(e.clientY - r.top - H / 2, e.clientX - r.left - W / 2);
  }
  function onPointerDown(e) {
    if (destroyed || attract) return;
    e.preventDefault();
    audio.unlock();
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const bottom = y > H * 0.72, right = x > W / 2;
    if (paused) { if (bottom && right) onExit(); else resume(); return; }
    if (isDone()) {
      if (!resultsReady()) return;
      if (res && res.stage === 'entry') { entryTap(x, y); return; }
      if (res && (res.stage === 'saving' || res.stage === 'fail')) return;
      if (bottom && right) onExit(); else if (bottom) restart();
      return;
    }
    const s = soundRect(view);
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) { audio.toggle(); render(); return; }
    ptr.down = true; ptr.angle = pointAngle(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }
  function onPointerMove(e) { if (ptr.down) { e.preventDefault(); ptr.angle = pointAngle(e); } }
  function onPointerUp() { ptr.down = false; }
  function onTouchMove(e) { if (!attract) e.preventDefault(); }

  if (!attract) {
    keyTarget.addEventListener('keydown', onKeyDown);
    keyTarget.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('blur', onBlur);
  }

  // simulation
  function step(dt) {
    stepWorld(world, dt, readInput(dt));

    // events: sound
    for (const ev of world.events) {
      if (audio && SOUNDS[ev.type]) audio.play(SOUNDS[ev.type]);
    }
    world.events.length = 0;

    // trail
    const s = world.stray;
    if (s.alive) {
      trail.unshift(s.a);
      const max = 26 + (world.ending ? Math.min(40, Math.floor(world.ending.t * 8)) : 0);
      if (trail.length > max) trail.length = max;
    } else trail.length = 0;

    // stars: stretch into streaks during the ending
    let mult = 1, starAlpha = 1;
    if (world.ending) {
      const et = world.ending.t;
      // the stars stretch for the first 3 s, then ease back down as the trip ends
      const k = smooth(et / ENDING.warp) * (1 - smooth((et - ENDING.warp) / (ENDING.warpDown - ENDING.warp)));
      if (reduced) starAlpha = 1 - smooth(et / ENDING.warp); else mult = 1 + 9 * k;
      endWarp = mult;
      if (reduced) endWarp = 1;
    }
    stepStars(stars, dt, mult);
    fxExtra.starAlpha = starAlpha;

    // energy readout eases toward its target
    const target = energyLog(world);
    dispE = world.ending ? target : dispE + (target - dispE) * Math.min(1, dt * 4);
    if (dispE === 0) dispE = target;

    // finishing
    if (!attract && !scored && isDone()) {
      scored = true;
      hi = Math.max(hi, world.score);
      if (world.phase === 'cleared') { try { localStorage.setItem(CLEARED_KEY, '1'); } catch (e) { /* ignore */ } }
      onScore(world.score);
    }
    if (!attract && !res && isDone() && resultsReady()) startResults();
    if (res && res.stage === 'fail' && performance.now() >= res.failUntil) res.stage = 'board';
  }
  const fxExtra = { starAlpha: 1 };

  function render() {
    if (W < 2 || H < 2) return;
    drawFrame(ctx, view, world, {
      C, stars, trail, time: world.t, warp: endWarp, starAlpha: fxExtra.starAlpha,
      energy: dispE || energyLog(world), hi, soundOn: audio ? audio.isOn() : false,
      attract, paused, reduced, endingLine: ENDING_LINE,
      res, out, now: performance.now() / 1000,
    });
  }

  function loop(now) {
    if (!running || paused || destroyed) { raf = 0; return; }
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    step(dt);
    render();
    raf = requestAnimationFrame(loop);
  }

  function warmUp(seconds) {
    for (let i = 0; i < seconds * 60; i++) step(1 / 60);
  }

  // public
  function start() {
    if (destroyed || running) return;
    running = true; paused = false;
    size();
    if (attract && reduced) {          // one still frame, no animation
      warmUp(3); render(); return;
    }
    if (attract) warmUp(0.5);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function pause() {
    if (destroyed || !running || paused) return;
    if (attract && reduced) return;
    if (!attract && isDone()) return;   // result screens are static; nothing to pause
    paused = true;
    keys.clear(); ptr.down = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    render();
  }

  function resume() {
    if (destroyed || !running || !paused) return;
    paused = false;
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function destroy() {
    destroyed = true; running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    ro.disconnect();
    keyTarget.removeEventListener('keydown', onKeyDown);
    keyTarget.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('blur', onBlur);
    if (audio) audio.destroy();
  }

  function setColors(c) { C = c; if (!running || paused || (reduced && attract)) render(); }

  return { start, pause, resume, destroy, setColors };
}
