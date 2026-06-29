// ── Firebase chat backend ───────────────────────────────────────────
// Single point of contact with Firebase. If this is ever swapped for a
// different backend, this is the only file that needs to change.

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

async function ensureInit() {
  if (_app) return;

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
