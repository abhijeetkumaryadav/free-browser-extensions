// Symptom Journal — personal symptom log only.
// Never assesses, diagnoses, or validates anything.
'use strict';

const STORE_KEY = 'symptomEntries';
const form = document.getElementById('entry-form');
const listEl = document.getElementById('log-list');
const searchEl = document.getElementById('search');

document.getElementById('sym-date').valueAsDate = new Date();

async function loadEntries() {
  const { [STORE_KEY]: entries = [] } = await chrome.storage.local.get(STORE_KEY);
  return entries;
}

async function saveEntries(entries) {
  await chrome.storage.local.set({ [STORE_KEY]: entries });
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function render() {
  const entries = await loadEntries();
  const q = searchEl.value.trim().toLowerCase();

  const rows = entries
    .filter(e => !q || e.name.toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);

  if (!rows.length) {
    listEl.innerHTML = '<div class="empty">No entries yet — log your first symptom above.</div>';
    return;
  }

  listEl.innerHTML = rows.map(e => `
    <div class="entry">
      <div class="top">
        <span class="name">${esc(e.name)}</span>
        <span style="display:flex;gap:6px;align-items:center">
          <span class="sev">Severity ${e.severity}/10</span>
          <button class="del" data-id="${e.id}" title="Delete entry" aria-label="Delete entry">
            <svg viewBox="0 0 24 24" class="ic"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button>
        </span>
      </div>
      <div class="meta">${esc(e.date)}</div>
      ${e.notes ? `<div class="notes">${esc(e.notes)}</div>` : ''}
    </div>`).join('');
}

form.addEventListener('submit', async ev => {
  ev.preventDefault();
  const name = document.getElementById('sym-name').value.trim();
  const severity = parseInt(document.getElementById('sym-sev').value, 10);
  const date = document.getElementById('sym-date').value;
  if (!name || !date || !(severity >= 1 && severity <= 10)) return;
  const entries = await loadEntries();
  entries.push({
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    name,
    severity,
    date,
    notes: document.getElementById('sym-notes').value.trim(),
    created: Date.now(),
  });
  await saveEntries(entries);
  form.reset();
  document.getElementById('sym-date').valueAsDate = new Date();
  render();
});

listEl.addEventListener('click', async ev => {
  const btn = ev.target.closest('.del');
  if (!btn) return;
  const entries = await loadEntries();
  await saveEntries(entries.filter(e => e.id !== btn.dataset.id));
  render();
});

searchEl.addEventListener('input', render);

document.getElementById('export').addEventListener('click', async () => {
  const entries = await loadEntries();
  const blob = new Blob([JSON.stringify({
    exportedAt: new Date().toISOString(),
    disclaimer: 'Not a diagnosis — see a doctor.',
    entries,
  }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'symptom-journal.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('clear').addEventListener('click', async () => {
  if (!confirm('Delete ALL journal entries?')) return;
  await saveEntries([]);
  render();
});

render();
