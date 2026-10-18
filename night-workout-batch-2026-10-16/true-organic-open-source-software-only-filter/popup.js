/* Open-Source Directory — curated personal OSS directory.
 * Fully local; chrome.storage.local only; no network. */
'use strict';

/* ================= Pure logic engine (headless-testable) ================= */
// ENGINE-START

/** Create a validated entry object, or null if invalid. */
function makeEntry(name, category, license, url, notes) {
  name = (name || '').trim();
  if (!name) return null;
  category = (category || '').trim().slice(0, 60);
  license = (license || '').trim().slice(0, 40);
  url = (url || '').trim().slice(0, 500);
  notes = (notes || '').trim().slice(0, 1000);
  // Reject javascript: and other dangerous schemes; allow http(s)/empty.
  if (url && !/^https?:\/\//i.test(url)) return null;
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: name.slice(0, 120),
    category, license, url, notes,
    createdAt: Date.now()
  };
}

/** Sort entries newest-first; returns a NEW array. */
function sortEntries(list) {
  return [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/** Case-insensitive filter across name/category/license/notes. */
function filterEntries(list, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [...list];
  return list.filter(e =>
    [e.name, e.category, e.license, e.notes].some(f => (f || '').toLowerCase().includes(q))
  );
}

/** Validate an imported payload; returns array of entries or null. */
function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch { return null; }
  if (!Array.isArray(data)) return null;
  const out = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const e = makeEntry(item.name, item.category, item.license, item.url, item.notes);
    if (e) out.push(e);
  }
  return out;
}

/** Serialize entries for export. */
function serializeExport(list) {
  return JSON.stringify(list.map(e => ({
    name: e.name, category: e.category, license: e.license, url: e.url, notes: e.notes
  })), null, 2);
}
// ENGINE-END

/* ================= Storage ================= */
const KEY = 'ossEntries';
const MAX_ENTRIES = 500;

async function loadEntries() {
  const { [KEY]: list } = await chrome.storage.local.get(KEY);
  return Array.isArray(list) ? list : [];
}
async function saveEntries(list) {
  await chrome.storage.local.set({ [KEY]: list.slice(0, MAX_ENTRIES) });
}

/* ================= UI ================= */
const $ = id => document.getElementById(id);

function esc(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function render() {
  const list = sortEntries(await loadEntries());
  const shown = filterEntries(list, $('q').value);
  $('count').textContent = list.length;
  const box = $('entries');
  box.innerHTML = '';
  if (!shown.length) {
    box.innerHTML = '<div class="empty">No entries yet — add your first open-source tool above.</div>';
    return;
  }
  for (const e of shown) {
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML =
      '<div class="name">' + esc(e.name) + '</div>' +
      '<div class="meta">' + esc([e.category, e.license].filter(Boolean).join(' · ') || 'Uncategorized') + '</div>' +
      (e.notes ? '<div class="notes">' + esc(e.notes) + '</div>' : '') +
      '<div class="actions">' +
        (e.url ? '<a href="' + esc(e.url) + '" target="_blank" rel="noopener">Open link</a>' : '') +
        '<button class="del" data-id="' + e.id + '">Delete</button>' +
      '</div>';
    box.appendChild(div);
  }
  box.querySelectorAll('.del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const list2 = await loadEntries();
      await saveEntries(list2.filter(e => e.id !== btn.dataset.id));
      render();
    });
  });
}

function msg(t) { $('formMsg').textContent = t; }

document.addEventListener('DOMContentLoaded', () => {
  render();

  $('btnAdd').addEventListener('click', async () => {
    const e = makeEntry($('fName').value, $('fCat').value, $('fLic').value, $('fUrl').value, $('fNotes').value);
    if (!e) {
      msg('Add a name, and use an http(s) URL or leave it blank.');
      return;
    }
    const list = await loadEntries();
    if (list.length >= MAX_ENTRIES) { msg('Directory is full (500 entries).'); return; }
    list.push(e);
    await saveEntries(list);
    for (const id of ['fName', 'fCat', 'fLic', 'fUrl', 'fNotes']) $(id).value = '';
    msg('Added "' + e.name + '".');
    render();
  });

  $('q').addEventListener('input', render);

  $('btnClear').addEventListener('click', async () => {
    if (!confirm('Delete all directory entries? This cannot be undone.')) return;
    await saveEntries([]);
    render();
  });

  $('btnExport').addEventListener('click', async () => {
    const list = await loadEntries();
    const blob = new Blob([serializeExport(list)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'oss-directory.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });

  $('btnImport').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', async ev => {
    const file = ev.target.files[0];
    if (!file) return;
    const text = await file.text();
    const imported = parseImport(text);
    if (imported === null) { msg('Import failed: not a valid JSON array.'); return; }
    const list = (await loadEntries()).concat(imported).slice(0, MAX_ENTRIES);
    await saveEntries(list);
    msg('Imported ' + imported.length + ' entr' + (imported.length === 1 ? 'y' : 'ies') + '.');
    render();
    ev.target.value = '';
  });
});
