// larmor: synthesized sound. WebAudio only, no files. Muted until the player turns it on.
const KEY = 'stray_arcade_sound';

export function createAudio() {
  let ctx = null, master = null, noise = null, on = false;
  try { on = localStorage.getItem(KEY) === 'on'; } catch (e) { /* storage unavailable */ }

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.15;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; return null; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(type, f0, f1, dur, vol = 1, delay = 0) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function burst(dur, cutoff, vol = 1) {
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(200, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur);
  }

  const SOUNDS = {
    shot: () => tone('square', 900, 500, 0.05, 0.5),
    pop: () => burst(0.12, 2400, 0.9),
    hit: () => tone('sawtooth', 300, 60, 0.4, 0.8),
    pickup: () => { tone('triangle', 523, 523, 0.09, 0.7); tone('triangle', 659, 659, 0.09, 0.7, 0.07); tone('triangle', 784, 784, 0.14, 0.7, 0.14); },
    appear: () => { tone('sine', 880, 880, 0.12, 0.25); tone('sine', 1175, 1175, 0.2, 0.25, 0.1); },
    thud: () => tone('sine', 120, 45, 0.22, 1),
    swell: () => {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(330, t + 8);
      g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 6); g.gain.exponentialRampToValueAtTime(0.001, t + 10);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 10.1);
    },
  };

  return {
    isOn: () => on,
    // call from a key press or tap so a saved "on" can start the context
    unlock() { if (on) ensure(); },
    toggle() {
      on = !on;
      try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ }
      if (on && ensure()) SOUNDS.shot();
      return on;
    },
    play(name) {
      if (!on || !SOUNDS[name]) return;
      if (!ensure()) return;
      try { SOUNDS[name](); } catch (e) { /* ignore */ }
    },
    destroy() { if (ctx) { try { ctx.close(); } catch (e) { /* ignore */ } } ctx = null; },
  };
}
