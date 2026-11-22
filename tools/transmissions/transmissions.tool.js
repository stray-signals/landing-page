// Transmissions app: stray's log in a desktop window.
// The full page is built by Eleventy at /transmissions/ (root/transmissions/index.njk).

const LOG_URL = '/root/transmissions/log.json';

export async function loadTransmissions() {
  const res = await fetch(LOG_URL);
  if (!res.ok) throw new Error(`log ${res.status}`);
  const log = await res.json();
  return log.slice().sort((a, b) => b.date.localeCompare(a.date));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export async function mountTransmissions(bodyEl) {
  bodyEl.classList.add('tx-app');
  bodyEl.textContent = 'tuning in...';

  let entries;
  try {
    entries = await loadTransmissions();
  } catch {
    bodyEl.textContent = 'signal lost. try again.';
    return;
  }

  bodyEl.textContent = '';
  const list = el('ol', 'tx-list');

  for (const entry of entries) {
    const item = el('li', 'tx-entry');

    const meta = el('div', 'tx-meta');
    const date = el('a', null, `[${entry.date}]`);
    date.href = `/transmissions/${entry.id}/`;
    meta.append(date, ` [${entry.type}]`);

    item.append(meta, el('div', 'tx-copy', entry.copy));

    if (entry.url) {
      const target = el('div', 'tx-target', '→ ');
      const link = el('a', null, entry.target);
      link.href = entry.url;
      link.target = '_blank';
      link.rel = 'noopener';
      target.append(link);
      item.append(target);
    }

    list.append(item);
  }

  bodyEl.append(list);
}
