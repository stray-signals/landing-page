import { getPat, storePat }    from '../auth.js';
import { showModal, closeModal } from '../../modal.js';

const REPO      = 'stray-signals/landing-page';
const FILE_PATH = 'root/transmissions/log.json';
const API_BASE  = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;

const LOG_TYPES = ['drift', 'signal', 'fragment'];

async function validatePat(pat) {
  const res = await fetch(`https://api.github.com/repos/${REPO}`, {
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github.v3+json' },
  });
  return res.ok;
}

async function fetchLog(pat) {
  const res = await fetch(API_BASE, {
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (!res.ok) throw new Error(`github api error: ${res.status}`);
  const { content, sha } = await res.json();
  return { log: JSON.parse(atob(content.replace(/\n/g, ''))), sha };
}

async function commitLog(pat, log, sha, message) {
  const res = await fetch(API_BASE, {
    method:  'PUT',
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: btoa(JSON.stringify(log, null, 2) + '\n'), sha }),
  });
  if (!res.ok) throw new Error(`commit failed: ${res.status}`);
}

function makeId(date, target) {
  return `${date}-${target.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 20).replace(/-+$/, '')}`;
}

function openLogModal(addMessage) {
  showModal({
    title:  'new transmission',
    fields: [
      { name: 'type',   label: `type  (${LOG_TYPES.join(' / ')})`, type: 'text' },
      { name: 'target', label: 'target domain',                     type: 'text' },
      { name: 'url',    label: 'url  (leave blank to skip)',         type: 'text' },
      { name: 'copy',   label: 'transmission text',                  type: 'textarea', rows: 4 },
    ],
    onSubmit: async (values, setError) => {
      if (!values.type.trim())   return setError('type is required.');
      if (!values.target.trim()) return setError('target is required.');
      if (!values.copy.trim())   return setError('transmission text is required.');

      closeModal();

      const pat   = getPat();
      const date  = new Date().toISOString().slice(0, 10);
      const entry = {
        id:            makeId(date, values.target),
        type:          values.type.trim(),
        date,
        target:        values.target.trim(),
        signal_status: 'pending',
      };
      if (values.url.trim())  entry.url  = values.url.trim();
      if (values.copy.trim()) entry.copy = values.copy.trim();

      addMessage('stray', 'transmitting to github...');
      try {
        const { log, sha } = await fetchLog(pat);
        log.push(entry);
        await commitLog(pat, log, sha, `log: add entry ${entry.id}`);
        addMessage('stray', `signal logged → ${entry.id}`);
      } catch (err) {
        addMessage('stray', `error: ${err.message}`);
      }
    },
  });
}

export default {
  name:        'log',
  description: 'add a new transmission log entry',
  handler: () => ({ action: 'adminLog' }),
};

// Called by terminal.js — needs addMessage in scope
export async function handleLog(addMessage) {
  const pat = getPat();

  if (!pat) {
    // Prompt for PAT first
    showModal({
      title:  'github authentication',
      fields: [{ name: 'pat', label: 'personal access token', type: 'password' }],
      onSubmit: async (values, setError) => {
        const token = values.pat.trim();
        if (!token) return setError('token is required.');

        setError('validating...');
        const valid = await validatePat(token);
        if (!valid) return setError('invalid token or insufficient permissions.');

        storePat(token);
        closeModal();
        openLogModal(addMessage);
      },
    });
    return;
  }

  openLogModal(addMessage);
}
