// ── CRT Window System ─────────────────────────────────────────────
// CRTWindow   — drag, resize, minimize / maximize / close
// WindowManager — z-index tracking + taskbar

const TASKBAR = document.getElementById('taskbar');
let zTop = 10;

// ── WindowManager ─────────────────────────────────────────────────

export const WindowManager = {
  _windows: new Map(),

  register(win) { this._windows.set(win.id, win); },
  get(id)       { return this._windows.get(id); },

  focus(win) {
    zTop++;
    win.el.style.zIndex = zTop;
    this._windows.forEach(w => w.el.classList.toggle('is-focused', w === win));
  },

  addToTaskbar(win) {
    const btn = document.createElement('button');
    btn.className   = 'taskbar-item';
    btn.textContent = win.title;
    btn.addEventListener('click', () => win.restore());
    TASKBAR.appendChild(btn);
    win._taskbarBtn = btn;
  },

  removeFromTaskbar(win) {
    win._taskbarBtn?.remove();
    win._taskbarBtn = null;
  },
};

// ── CRTWindow ──────────────────────────────────────────────────────

export class CRTWindow {
  constructor(id) {
    this.el    = document.getElementById(id);
    this.id    = id;
    this.title = this.el.dataset.title ?? id;
    this.state = 'normal'; // 'normal' | 'minimized' | 'maximized' | 'closed'

    this._taskbarBtn = null;
    this._savedRect  = null;
    this._titlebar   = this.el.querySelector('.window-titlebar');

    this._bindDrag();
    this._bindResize();
    this._bindButtons();

    // Clicking anywhere in the window brings it to front
    this.el.addEventListener('mousedown', () => WindowManager.focus(this), true);
    WindowManager.register(this);
  }

  // ── State API ────────────────────────────────────────────────────

  minimize() {
    if (this.state === 'minimized') return;
    this.state = 'minimized';
    this.el.classList.add('is-minimized');
    WindowManager.addToTaskbar(this);
    this._emit('window:minimize');
  }

  maximize() {
    if (this.state === 'maximized') { this.restore(); return; }

    // Snapshot computed rect so restore always works, even on first maximize
    const r = this.el.getBoundingClientRect();
    this._savedRect = {
      left: r.left + 'px', top: r.top + 'px',
      width: r.width + 'px', height: r.height + 'px',
    };

    this.state = 'maximized';
    this.el.classList.add('is-maximized');
    this._emit('window:maximize');
  }

  restore() {
    const wasMin = this.state === 'minimized';
    const wasMax = this.state === 'maximized';
    this.state   = 'normal';
    this.el.classList.remove('is-minimized', 'is-maximized');

    if (wasMin) WindowManager.removeFromTaskbar(this);
    if (wasMax && this._savedRect) {
      const { left, top, width, height } = this._savedRect;
      Object.assign(this.el.style, { left, top, width, height });
    }

    WindowManager.focus(this);
    this._emit('window:restore');
  }

  close() {
    this.state = 'closed';
    this.el.classList.add('is-closed');
    WindowManager.removeFromTaskbar(this);
    this._emit('window:close');
  }

  open() {
    this.state = 'normal';
    this.el.classList.remove('is-closed', 'is-minimized', 'is-maximized');
    WindowManager.removeFromTaskbar(this);
    WindowManager.focus(this);
    this._emit('window:open');
  }

  _emit(name) {
    document.dispatchEvent(new CustomEvent(name, { detail: { id: this.id } }));
  }

  // ── Drag ─────────────────────────────────────────────────────────

  _bindDrag() {
    const startDrag = (startX, startY) => {
      if (this.state === 'maximized') return null;
      WindowManager.focus(this);
      const ox = startX - this.el.offsetLeft;
      const oy = startY - this.el.offsetTop;
      return (cx, cy) => {
        const x = Math.max(-this.el.offsetWidth + 80,  Math.min(window.innerWidth  - 80, cx - ox));
        const y = Math.max(0, Math.min(window.innerHeight - 40, cy - oy));
        this.el.style.left = x + 'px';
        this.el.style.top  = y + 'px';
      };
    };

    // Mouse
    this._titlebar.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('.win-btn')) return;
      e.preventDefault();
      const move = startDrag(e.clientX, e.clientY);
      if (!move) return;
      const onMove = (e) => move(e.clientX, e.clientY);
      const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // Touch
    this._titlebar.addEventListener('touchstart', (e) => {
      if (e.target.closest('.win-btn')) return;
      const t    = e.touches[0];
      const move = startDrag(t.clientX, t.clientY);
      if (!move) return;
      const onMove = (e) => { const t = e.touches[0]; move(t.clientX, t.clientY); };
      const onEnd  = () => { document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onEnd); };
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    }, { passive: true });
  }

  // ── Resize ───────────────────────────────────────────────────────

  _bindResize() {
    this.el.querySelectorAll('.rz').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || this.state === 'maximized') return;
        e.preventDefault();
        e.stopPropagation();
        WindowManager.focus(this);

        const dir = handle.dataset.dir;
        const sx  = e.clientX, sy = e.clientY;
        const sr  = this.el.getBoundingClientRect();

        const onMove = (e) => {
          const dx = e.clientX - sx;
          const dy = e.clientY - sy;
          let l = sr.left, t = sr.top, w = sr.width, h = sr.height;

          if (dir.includes('e')) w = Math.max(220, w + dx);
          if (dir.includes('s')) h = Math.max(160, h + dy);
          if (dir.includes('w')) { w = Math.max(220, w - dx); l = sr.right - w; }
          if (dir.includes('n')) { h = Math.max(160, h - dy); t = sr.bottom - h; }

          Object.assign(this.el.style, {
            left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px',
          });
        };

        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  // ── Buttons ──────────────────────────────────────────────────────

  _bindButtons() {
    const stop = (e) => e.stopPropagation();
    this.el.querySelector('.win-min')?.addEventListener('click',   (e) => { stop(e); this.minimize(); });
    this.el.querySelector('.win-max')?.addEventListener('click',   (e) => { stop(e); this.maximize(); });
    this.el.querySelector('.win-close')?.addEventListener('click', (e) => { stop(e); this.close(); });
  }
}
