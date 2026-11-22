// ── Firebase backend (chat + arcade scores) ─────────────────────────
// Single point of contact with Firebase. If this is ever swapped for a
// different backend, this is the only file that needs to change.
// Handles the transmit chat and the arcade high scores (`${game}_scores`).

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyCEayTpMNXkPMF_iP1hsi4dv0dqWckoHY0',
  authDomain:        'stray-signals.firebaseapp.com',
  projectId:         'stray-signals',
  storageBucket:     'stray-signals.firebasestorage.app',
  messagingSenderId: '705508316899',
  appId:             '1:705508316899:web:fd243b93290662b19b57d6',
};

const STRAY_EMAIL = 'stray@straysignals.dev';
const SDK_VERSION = '10.13.0';

let _app, _db, _auth;
let _firestoreApi, _authApi;
let _initP = null;

function ensureInit() {
  if (!_initP) _initP = doInit().catch((e) => { _initP = null; throw e; });
  return _initP;
}

async function doInit() {

  const [{ initializeApp }, firestoreApi, authApi] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
    import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
  ]);

  _firestoreApi = firestoreApi;
  _authApi      = authApi;

  _app  = initializeApp(FIREBASE_CONFIG);
  _db   = firestoreApi.getFirestore(_app);
  _auth = authApi.getAuth(_app);
}

// ── Anonymous handle ────────────────────────────────────────────────

export function getHandle() {
  let handle = localStorage.getItem('stray_chat_handle');
  if (!handle) {
    const n = Math.floor(1000 + Math.random() * 9000);
    handle = `signal#${n}`;
    localStorage.setItem('stray_chat_handle', handle);
  }
  return handle;
}

// ── Auth ────────────────────────────────────────────────────────────

export async function signInStray(password) {
  await ensureInit();
  await _authApi.signInWithEmailAndPassword(_auth, STRAY_EMAIL, password);
}

export async function signOutStray() {
  await ensureInit();
  await _authApi.signOut(_auth);
}

export async function onAuthChange(callback) {
  await ensureInit();
  _authApi.onAuthStateChanged(_auth, (user) => callback(!!user));
}

export function isStrayAuthed() {
  return !!_auth?.currentUser;
}

// ── Messages ────────────────────────────────────────────────────────

export async function subscribeMessages(callback) {
  await ensureInit();
  const { collection, query, orderBy, limit, onSnapshot } = _firestoreApi;
  const q = query(
    collection(_db, 'transmissions'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(messages);
  });
}

export async function sendMessage(text) {
  await ensureInit();
  const { collection, addDoc, serverTimestamp } = _firestoreApi;
  const stray = isStrayAuthed();
  await addDoc(collection(_db, 'transmissions'), {
    text:      text.slice(0, 280),
    author:    stray ? 'stray' : getHandle(),
    isStray:   stray,
    createdAt: serverTimestamp(),
  });
}

export async function deleteMessage(id) {
  await ensureInit();
  const { doc, deleteDoc } = _firestoreApi;
  await deleteDoc(doc(_db, 'transmissions', id));
}

// ── Arcade scores ───────────────────────────────────────────────────
// Rules (firestore.rules): initials ^[A-Z]{3}$, score int 1..100000, only those keys + createdAt.
// Every call can throw (offline, SDK blocked, timeout); callers catch and carry on.

const SCORE_TIMEOUT = 8000;

function withTimeout(p) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), SCORE_TIMEOUT))]);
}

function scoresCollection(game) {
  if (typeof game !== 'string' || !/^[a-z0-9_-]+$/i.test(game)) throw new Error('bad game');
  return `${game}_scores`;
}

export async function fetchTopScores(game = 'larmor', n = 10) {
  const name = scoresCollection(game);
  return withTimeout((async () => {
    await ensureInit();
    const { collection, query, orderBy, limit, getDocs } = _firestoreApi;
    const snap = await getDocs(query(collection(_db, name), orderBy('score', 'desc'), limit(n)));
    return snap.docs.map((d) => ({ id: d.id, initials: d.data().initials, score: d.data().score }));
  })());
}

export async function submitScore(game, initials, score) {
  const name = scoresCollection(game);
  if (typeof initials !== 'string' || !/^[A-Z]{3}$/.test(initials)) throw new Error('bad initials');
  if (!Number.isInteger(score) || score < 1 || score > 100000) throw new Error('bad score');
  return withTimeout((async () => {
    await ensureInit();
    const { collection, addDoc, serverTimestamp } = _firestoreApi;
    const ref = await addDoc(collection(_db, name), { initials, score, createdAt: serverTimestamp() });
    return ref.id;
  })());
}

// resolves once the saved sign-in state is known, so isStrayAuthed() is trustworthy
export async function whenAuthReady() {
  await ensureInit();
  if (_auth.authStateReady) await _auth.authStateReady();
}

export async function deleteScore(game, id) {
  const name = scoresCollection(game);
  await ensureInit();
  const { doc, deleteDoc } = _firestoreApi;
  await deleteDoc(doc(_db, name, id));
}
