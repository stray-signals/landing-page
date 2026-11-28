// Viewport and visibility checks shared by the desktop, windows and tools.
export const PHONE_QUERY = '(max-width: 700px)';

export function isPhone() {
  return window.matchMedia(PHONE_QUERY).matches;
}

// False when the tab is hidden, the element's window is minimized or closed,
// or the element is not rendered.
export function isOnScreen(el) {
  if (document.hidden) return false;
  const win = el.closest('.crt-window');
  if (win && (win.classList.contains('is-minimized') || win.classList.contains('is-closed'))) return false;
  return el.getClientRects().length > 0;
}
