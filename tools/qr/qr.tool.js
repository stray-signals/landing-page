// QR tool UI. mountQrTool(container, { mode }) -> { destroy, refreshTheme }
import { renderQrSvg, parseColor, DOT_STYLES, CORNER_STYLES } from './qr.render.js';

const STORAGE_KEY = 'stray_qr_state';
const CSS_HREF = '/tools/qr/qr.tool.css';
const DOT_LABELS = { square: 'square', rounded: 'rounded', dots: 'dots', pixel: 'crt pixels' };
const SIZES = [512, 1024, 2048];
const ECLS = ['L', 'M', 'Q', 'H'];
const LOGO_CHOICES = ['none', 'stray', 'upload'];

const DEFAULTS = {
  text: 'https://straysignals.dev',
  dots: 'rounded', corners: 'rounded',
  follow: true,
  dotColor: '#0c100c', cornerColor: '#0c100c', bgColor: '#b8ffa0',
  logo: 'none', logoImage: null,
  margin: 4, ecl: 'Q', size: 1024,
};

function loadState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) { /* storage unavailable */ }
  return { ...DEFAULTS };
}

function saveState(s) {
  try {
    const copy = { ...s };
    if (copy.logoImage && copy.logoImage.length > 200 * 1024) copy.logoImage = null;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
  } catch (e) { /* ignore */ }
}

function slugFor(text) {
  const t = String(text || '').toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const slug = (t.match(/[a-z0-9]+/g) || []).join('-').slice(0, 40).replace(/-+$/, '');
  return slug || 'code';
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (v, fb) => parseColor(cs.getPropertyValue(v), fb);
  const bg = get('--color-bg', DEFAULTS.dotColor);
  return { dotColor: bg, cornerColor: bg, bgColor: get('--color-primary', DEFAULTS.bgColor) };
}

function downscale(dataUrl, max = 512) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const big = Math.max(img.naturalWidth, img.naturalHeight);
      if (!big || big <= max) return resolve(dataUrl);
      const k = max / big;
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export function mountQrTool(container, { mode = 'window' } = {}) {
  if (!document.querySelector('link[href="' + CSS_HREF + '"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_HREF;
    document.head.appendChild(link);
  }

  const state = loadState();
  if (!DOT_STYLES.includes(state.dots)) state.dots = DEFAULTS.dots;
  if (!CORNER_STYLES.includes(state.corners)) state.corners = DEFAULTS.corners;
  if (state.logo === 'upload' && !state.logoImage) state.logo = 'none';

  const root = document.createElement('div');
  root.className = 'qr-tool';
  root.dataset.mode = mode;
  const uid = 'qr' + Math.random().toString(36).slice(2, 7);

  root.innerHTML = `<div class="qr-layout">
    <div class="qr-preview">
      <div class="qr-bezel"><div class="qr-screen" data-role="screen"></div></div>
      <div class="qr-status" data-role="status" role="status" aria-live="polite"></div>
      <div class="qr-actions">
        <button type="button" class="qr-btn qr-btn-fill" data-role="dl-png">download png</button>
        <button type="button" class="qr-btn qr-btn-line" data-role="dl-svg">download svg</button>
      </div>
    </div>
    <div class="qr-controls">
      <div class="qr-field"><label class="qr-lbl" for="${uid}-text">link or text</label>
        <input class="qr-input" id="${uid}-text" type="text" data-role="text" autocomplete="off" spellcheck="false"></div>
      <div class="qr-field"><span class="qr-lbl" id="${uid}-dots">dots</span><div class="qr-chips" role="group" aria-labelledby="${uid}-dots" data-group="dots"></div></div>
      <div class="qr-field"><span class="qr-lbl" id="${uid}-corners">corners</span><div class="qr-chips" role="group" aria-labelledby="${uid}-corners" data-group="corners"></div></div>
      <div class="qr-field"><span class="qr-lbl" id="${uid}-colors">colors</span>
        <div class="qr-colors" role="group" aria-labelledby="${uid}-colors">
          <label class="qr-color"><input type="color" data-role="dotColor"><span class="qr-color-txt"><span class="qr-color-name">dots</span><span class="qr-hex" data-role="dotColorHex"></span></span></label>
          <label class="qr-color"><input type="color" data-role="cornerColor"><span class="qr-color-txt"><span class="qr-color-name">corners</span><span class="qr-hex" data-role="cornerColorHex"></span></span></label>
          <label class="qr-color"><input type="color" data-role="bgColor"><span class="qr-color-txt"><span class="qr-color-name">background</span><span class="qr-hex" data-role="bgColorHex"></span></span></label>
          <span class="qr-chips" data-group="follow"></span>
        </div></div>
      <div class="qr-field"><span class="qr-lbl" id="${uid}-logo">logo</span><div class="qr-chips" role="group" aria-labelledby="${uid}-logo" data-group="logo"></div>
        <input class="qr-input qr-file" type="file" accept="image/*" data-role="file" aria-label="upload logo image" hidden></div>
      <div class="qr-field"><label class="qr-lbl" for="${uid}-margin">margin <span data-role="marginVal"></span></label>
        <input class="qr-range" id="${uid}-margin" type="range" min="0" max="8" step="1" data-role="margin"></div>
      <div class="qr-field"><span class="qr-lbl" id="${uid}-ecl">error correction</span><div class="qr-chips" role="group" aria-labelledby="${uid}-ecl" data-group="ecl"></div></div>
      <div class="qr-field"><span class="qr-lbl" id="${uid}-size">size (png px)</span><div class="qr-chips" role="group" aria-labelledby="${uid}-size" data-group="size"></div></div>
    </div></div>`;
  container.appendChild(root);

  const $ = r => root.querySelector(`[data-role="${r}"]`);
  const group = g => root.querySelector(`[data-group="${g}"]`);
  const el = {
    screen: $('screen'), status: $('status'), text: $('text'), file: $('file'),
    margin: $('margin'), marginVal: $('marginVal'),
    dotColor: $('dotColor'), cornerColor: $('cornerColor'), bgColor: $('bgColor'),
  };

  const chipDefs = {
    dots: DOT_STYLES.map(v => [v, DOT_LABELS[v]]),
    corners: CORNER_STYLES.map(v => [v, v]),
    logo: LOGO_CHOICES.map(v => [v, v]),
    ecl: ECLS.map(v => [v, v]),
    size: SIZES.map(v => [v, String(v)]),
  };
  const chipButtons = {};
  for (const g of Object.keys(chipDefs)) {
    chipButtons[g] = chipDefs[g].map(([value, label]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'qr-chip'; b.textContent = label;
      b.addEventListener('click', () => {
        if (b.disabled) return;
        state[g] = value;
        if (g === 'logo' && value === 'upload' && !state.logoImage) el.file.click();
        changed();
      });
      group(g).appendChild(b);
      return [value, b];
    });
  }
  const followChip = document.createElement('button');
  followChip.type = 'button'; followChip.className = 'qr-chip'; followChip.textContent = 'follow theme';
  followChip.addEventListener('click', () => { state.follow = true; changed(); });
  group('follow').appendChild(followChip);

  // current effective render options
  function effective() {
    const c = state.follow ? themeColors() : state;
    return {
      dots: state.dots, corners: state.corners,
      dotColor: c.dotColor, cornerColor: c.cornerColor, bgColor: c.bgColor,
      logo: state.logo, logoImage: state.logoImage, margin: state.margin, ecl: state.ecl,
    };
  }

  let current = null, raf = 0;

  function sync() {
    if (el.text.value !== state.text) el.text.value = state.text;
    const logoOn = state.logo === 'stray' || (state.logo === 'upload' && !!state.logoImage);
    for (const g of Object.keys(chipButtons)) {
      for (const [value, b] of chipButtons[g]) {
        let on = String(state[g]) === String(value);
        if (g === 'ecl') { if (logoOn) { on = value === 'H'; b.disabled = value !== 'H'; } else b.disabled = false; }
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      }
    }
    followChip.classList.toggle('on', state.follow);
    followChip.setAttribute('aria-pressed', String(state.follow));
    el.file.hidden = state.logo !== 'upload';
    el.margin.value = state.margin;
    el.marginVal.textContent = state.margin;
  }

  function render() {
    raf = 0;
    const o = effective();
    for (const k of ['dotColor', 'cornerColor', 'bgColor']) { el[k].value = o[k]; $(k + 'Hex').textContent = o[k]; }
    current = renderQrSvg(state.text, o);
    el.screen.innerHTML = current.svg || '<div class="qr-empty">no code</div>';
    el.status.textContent = '';
    const lines = current.warnings.slice();
    if (!state.text.trim()) lines.unshift('type a link or some text');
    if (lines.length) {
      for (const w of lines) {
        const d = document.createElement('div'); d.className = 'qr-warn'; d.textContent = '! ' + w;
        el.status.appendChild(d);
      }
    } else {
      const d = document.createElement('div'); d.className = 'qr-ok';
      d.textContent = `✓ scans clean · contrast ${Math.round(current.contrast)}:1`;
      el.status.appendChild(d);
    }
    const dis = !current.svg;
    $('dl-png').disabled = dis; $('dl-svg').disabled = dis;
  }

  function schedule() { if (!raf) raf = requestAnimationFrame(render); }
  function changed() { sync(); saveState(state); schedule(); }

  el.text.addEventListener('input', () => { state.text = el.text.value; saveState(state); schedule(); });
  el.margin.addEventListener('input', () => { state.margin = +el.margin.value; el.marginVal.textContent = state.margin; saveState(state); schedule(); });
  for (const k of ['dotColor', 'cornerColor', 'bgColor']) {
    el[k].addEventListener('input', () => {
      if (state.follow) Object.assign(state, themeColors()); // start from what is shown
      state.follow = false;
      state[k] = el[k].value;
      changed();
    });
  }
  el.file.addEventListener('change', () => {
    const file = el.file.files && el.file.files[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = async () => {
      const url = await downscale(String(fr.result));
      if (url) { state.logoImage = url; state.logo = 'upload'; } else { state.logoImage = null; state.logo = 'none'; }
      changed();
    };
    fr.readAsDataURL(file);
  });

  $('dl-svg').addEventListener('click', () => {
    if (!current || !current.svg) return;
    download(new Blob([current.svg], { type: 'image/svg+xml' }), `qr-${slugFor(state.text)}.svg`);
  });
  $('dl-png').addEventListener('click', () => {
    if (!current || !current.svg) return;
    const size = +state.size || 1024;
    const url = URL.createObjectURL(new Blob([current.svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      c.toBlob(b => { if (b) download(b, `qr-${slugFor(state.text)}.png`); }, 'image/png');
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  });

  function refreshTheme() { if (state.follow) schedule(); }
  const onFocus = () => refreshTheme();
  window.addEventListener('focus', onFocus);

  sync();
  render();

  return {
    refreshTheme,
    destroy() {
      window.removeEventListener('focus', onFocus);
      if (raf) cancelAnimationFrame(raf);
      root.remove();
    },
  };
}
