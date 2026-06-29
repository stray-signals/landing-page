import { CRTWindow, WindowManager } from './window.js';
import { showModal, closeModal } from '../terminal/modal.js';
import {
  getHandle, subscribeMessages, sendMessage,
  signInStray, signOutStray, onAuthChange, isStrayAuthed, deleteMessage,
} from './firebase-chat.js';

let win = null;
let initialized = false;

function buildWindowMarkup() {
  const div = document.createElement('div');
  div.className = 'crt-window';
  div.id = 'win-transmit';
  div.dataset.title = 'transmit';
  div.innerHTML = `
    <div class="window-titlebar">
      <span class="window-title">transmit</span>
      <div class="window-controls">
        <button class="win-btn win-min"   title="minimize">−</button>
        <button class="win-btn win-max"   title="expand">○</button>
        <button class="win-btn win-close" title="close">×</button>
      </div>
    </div>
    <div class="window-body">
      <div class="chat-panel">
        <div class="chat-history" id="chatHistory"></div>
        <div class="chat-footer">
          <span class="chat-identity" id="chatIdentity"></span>
          <span class="chat-auth-link" id="chatAuthLink">sign in</span>
        </div>
        <div class="chat-input-row">
          <input type="text" id="chatInput" maxlength="280" autocomplete="off" placeholder="leave a message..." />
          <button class="chat-send-btn" id="chatSendBtn">send</button>
        </div>
      </div>
    </div>
    <div class="rz rz-n"  data-dir="n"></div>
    <div class="rz rz-s"  data-dir="s"></div>
    <div class="rz rz-e"  data-dir="e"></div>
    <div class="rz rz-w"  data-dir="w"></div>
    <div class="rz rz-nw" data-dir="nw"></div>
    <div class="rz rz-ne" data-dir="ne"></div>
    <div class="rz rz-sw" data-dir="sw"></div>
    <div class="rz rz-se" data-dir="se"></div>
  `;
  return div;
}

function renderMessages(historyEl, messages) {
  const wasAtBottom = historyEl.scrollHeight - historyEl.scrollTop - historyEl.clientHeight < 40;

  historyEl.innerHTML = messages.map((m) => {
    const cls = m.isStray ? 'stray-msg' : 'visitor-msg';
    const label = m.isStray ? '@stray' : m.author;
    const del = isStrayAuthed() ? `<button class="chat-delete-btn" data-id="${m.id}" title="delete">×</button>` : '';
    return `<div class="history-entry ${cls}" data-msg-id="${m.id}">
      <span class="chat-author">${label}:</span> ${escapeHtml(m.text)}${del}
    </div>`;
  }).join('');

  if (wasAtBottom) historyEl.scrollTop = historyEl.scrollHeight;

  historyEl.querySelectorAll('.chat-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteMessage(btn.dataset.id));
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function isAdminMode() {
  return document.querySelector('.dashboard')?.classList.contains('admin-mode') ?? false;
}

function updateIdentityUI(identityEl, authLinkEl) {
  const stray = isStrayAuthed();
  identityEl.textContent = stray ? 'signed in as stray' : getHandle();
  authLinkEl.textContent = stray ? 'sign out' : 'sign in';
  authLinkEl.style.display = (isAdminMode() || stray) ? '' : 'none';
}

async function init() {
  if (initialized) return;
  initialized = true;

  const el = buildWindowMarkup();
  document.getElementById('desktop').appendChild(el);

  win = new CRTWindow('win-transmit');

  const historyEl  = el.querySelector('#chatHistory');
  const inputEl    = el.querySelector('#chatInput');
  const sendBtn    = el.querySelector('#chatSendBtn');
  const identityEl = el.querySelector('#chatIdentity');
  const authLinkEl = el.querySelector('#chatAuthLink');

  let lastMessages = [];

  updateIdentityUI(identityEl, authLinkEl);
  document.addEventListener('terminal:adminlogin',  () => updateIdentityUI(identityEl, authLinkEl));
  document.addEventListener('terminal:adminlogout', () => updateIdentityUI(identityEl, authLinkEl));

  await subscribeMessages((messages) => {
    lastMessages = messages;
    renderMessages(historyEl, lastMessages);
  });

  await onAuthChange(() => {
    updateIdentityUI(identityEl, authLinkEl);
    renderMessages(historyEl, lastMessages);
  });

  async function doSend() {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    sendBtn.disabled = true;
    try { await sendMessage(text); }
    finally { setTimeout(() => { sendBtn.disabled = false; }, 600); }
  }

  sendBtn.addEventListener('click', doSend);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doSend(); }
  });

  authLinkEl.addEventListener('click', () => {
    if (isStrayAuthed()) { signOutStray(); return; }

    showModal({
      title:  'sign in as stray',
      fields: [{ name: 'pass', label: 'password', type: 'password' }],
      onSubmit: async (values, setError) => {
        try {
          await signInStray(values.pass);
          closeModal();
        } catch {
          setError('access denied.');
        }
      },
    });
  });
}

export async function openTransmitWindow(password) {
  await init();
  win.open();
  WindowManager.focus(win);

  if (password) {
    try { await signInStray(password); } catch { /* fail silently, no hint either way */ }
  }
}
