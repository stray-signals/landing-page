import { LINKS } from '../links/links.js';

let overlay;

export function initLinksPopup() {
  overlay = document.getElementById('linksOverlay');
  const closeBtn = document.getElementById('linksClose');
  const list = document.getElementById('linksList');

  // Populate from data file
  LINKS.forEach(link => {
    const entry = document.createElement('div');
    entry.className = 'link-entry';
    entry.innerHTML = `
      <span class="link-handle">${link.handle}</span>
      <span class="link-description">${link.description}</span>
      <a class="link-visit" href="${link.url}" target="_blank" rel="noopener noreferrer">→ visit</a>
    `;
    list.appendChild(entry);
  });

  // Close on button
  closeBtn.addEventListener('click', hide);

  // Close on overlay backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hide();
  });

  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) hide();
  });
}

export function showLinksPopup() {
  overlay?.classList.add('active');
}

function hide() {
  overlay?.classList.remove('active');
}
