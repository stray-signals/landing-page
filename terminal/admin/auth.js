// ── Admin credentials ──────────────────────────────────────────────
// Update these before deploying.
const ADMIN_USER = 'ROOT';
const ADMIN_PASS = 'oldgrowth';
// ──────────────────────────────────────────────────────────────────

let _pat = null;

export function checkCredentials(user, pass) {
  return user === ADMIN_USER && pass === ADMIN_PASS;
}

export function storePat(pat) { _pat = pat; }
export function getPat()      { return _pat; }
export function clearPat()    { _pat = null; }
