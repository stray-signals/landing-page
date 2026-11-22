// Pure helpers for the shared high-score board (no DOM, no network).
export const BOARD_SIZE = 10;
export const INITIALS_KEY = 'stray_arcade_initials';
const A = 65;

// Does this score earn a place on a board holding `top` (sorted high to low)?
export function qualifies(score, top, n = BOARD_SIZE) {
  if (!Number.isInteger(score) || score <= 0) return false;
  if (!Array.isArray(top)) return false;
  if (top.length < n) return true;
  return score > top[n - 1].score;
}

// Put a local row into a board, after any equal scores, keeping at most n rows.
export function insertRow(top, row, n = BOARD_SIZE) {
  const out = top.slice();
  let i = out.findIndex(r => r.score < row.score);
  if (i < 0) i = out.length;
  out.splice(i, 0, row);
  return out.slice(0, n);
}

export function cycleLetter(ch, delta) {
  return String.fromCharCode(A + ((ch.charCodeAt(0) - A + delta) % 26 + 26) % 26);
}

export function cleanInitials(s) {
  return typeof s === 'string' && /^[A-Z]{3}$/.test(s) ? s : 'AAA';
}
