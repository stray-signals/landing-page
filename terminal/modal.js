let overlay = null;

export function showModal({ title, fields, onSubmit, onCancel }) {
  closeModal();

  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  modal.innerHTML = `
    <div class="modal-title">${title}</div>
    ${fields.map(f => `
      <div class="modal-field">
        <label>${f.label}</label>
        ${f.type === 'textarea'
          ? `<textarea name="${f.name}" rows="${f.rows ?? 3}" autocomplete="off" spellcheck="false"></textarea>`
          : `<input type="${f.type ?? 'text'}" name="${f.name}" autocomplete="off" spellcheck="false" />`
        }
      </div>
    `).join('')}
    <div class="modal-error" id="modal-error"></div>
    <div class="modal-actions">
      <button class="modal-btn" id="modal-cancel">cancel</button>
      <button class="modal-btn primary" id="modal-submit">enter</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const inputs = modal.querySelectorAll('input');
  const errorEl = modal.querySelector('#modal-error');
  inputs[0]?.focus();

  function submit() {
    const values = {};
    for (const input of inputs) values[input.name] = input.value;
    onSubmit(values, (errMsg) => { errorEl.textContent = errMsg; inputs[0]?.focus(); });
  }

  modal.querySelector('#modal-submit').addEventListener('click', submit);
  modal.querySelector('#modal-cancel').addEventListener('click', () => { closeModal(); onCancel?.(); });

  // Enter key submits, Escape cancels
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { closeModal(); onCancel?.(); }
  });
}

export function closeModal() {
  overlay?.remove();
  overlay = null;
}
