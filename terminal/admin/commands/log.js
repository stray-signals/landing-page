import { getPat, storePat } from '../auth.js';

const REPO      = 'stray-signals/landing-page';
const FILE_PATH = 'root/transmissions/log.json';
const API_BASE  = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;

const LOG_TYPES = ['drift', 'signal', 'fragment'];

async function fetchLog(pat) {
  const res = await fetch(API_BASE, {
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (!res.ok) throw new Error(`github api error: ${res.status}`);
  const { content, sha } = await res.json();
  const log = JSON.parse(atob(content.replace(/\n/g, '')));
  return { log, sha };
}

async function commitLog(pat, log, sha, message) {
  const res = await fetch(API_BASE, {
    method:  'PUT',
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: btoa(JSON.stringify(log, null, 2) + '\n'),
      sha,
    }),
  });
  if (!res.ok) throw new Error(`commit failed: ${res.status}`);
}

function makeId(date, target) {
  const slug = target.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 20).replace(/-+$/, '');
  return `${date}-${slug}`;
}

export default {
  name:        'log',
  description: 'add a new transmission log entry',
  handler: () => {
    if (!getPat()) return { action: 'startWizard', wizard: 'pat' };
    return { action: 'startWizard', wizard: 'log' };
  },
};

export const LOG_WIZARD_STEPS = [
  { key: 'type',   prompt: 'type:~$',   hint: `type (${LOG_TYPES.join('/')})` },
  { key: 'target', prompt: 'target:~$', hint: 'target domain (e.g. vibes.fish)' },
  { key: 'url',    prompt: 'url:~$',    hint: 'full url (leave blank to skip)' },
  { key: 'copy',   prompt: 'entry:~$',  hint: 'the transmission text' },
];

export const PAT_WIZARD_STEPS = [
  { key: 'pat', prompt: 'pat:~$', hint: 'github personal access token' },
];

export async function submitLogEntry(data, addMessage) {
  const pat = getPat();
  if (!pat) { addMessage('stray', 'no pat in session.'); return; }

  const date   = new Date().toISOString().slice(0, 10);
  const entry  = {
    id:            makeId(date, data.target),
    type:          data.type || 'drift',
    date,
    target:        data.target,
    signal_status: 'pending',
  };
  if (data.url)  entry.url  = data.url;
  if (data.copy) entry.copy = data.copy;

  addMessage('stray', 'transmitting to github...');
  try {
    const { log, sha } = await fetchLog(pat);
    log.push(entry);
    await commitLog(pat, log, sha, `log: add entry ${entry.id}`);
    addMessage('stray', `signal logged → ${entry.id}`);
  } catch (err) {
    addMessage('stray', `error: ${err.message}`);
  }
}
