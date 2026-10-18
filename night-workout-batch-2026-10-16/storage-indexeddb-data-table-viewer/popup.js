/* Storage Inspector — self storage.local table viewer.
   Honest scope: chrome.storage.local is scoped to THIS extension; no API
   exposes other extensions' or websites' storage. */

'use strict';

const $ = (id) => document.getElementById(id);
const rowsEl = $('rows'), searchEl = $('search'), emptyEl = $('empty');
const tableEl = $('table'), toastEl = $('toast');
let entries = []; // [key, value]

/** Short human-readable byte size. */
function humanBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
}

/** Truncate a JSON preview to a sane length. */
function preview(value) {
  let s;
  try {
    s = JSON.stringify(value, null, 1);
  } catch (e) {
    s = String(value);
  }
  if (s.length > 220) s = s.slice(0, 220) + '…';
  return s;
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toastEl.classList.add('hidden'), 2200);
}

/** Render rows filtered by the current search term. */
function render() {
  const q = searchEl.value.trim().toLowerCase();
  const list = entries.filter(([k]) => !q || String(k).toLowerCase().includes(q));
  rowsEl.innerHTML = '';
  list.forEach(([key, value]) => {
    const tr = document.createElement('tr');
    const tdK = document.createElement('td');
    tdK.textContent = key;
    const tdV = document.createElement('td');
    const div = document.createElement('div');
    div.className = 'val';
    div.textContent = preview(value);
    tdV.appendChild(div);
    const tdA = document.createElement('td');
    const btn = document.createElement('button');
    btn.className = 'btn danger';
    btn.textContent = 'Delete';
    btn.addEventListener('click', () => deleteKey(key));
    tdA.appendChild(btn);
    tr.append(tdK, tdV, tdA);
    rowsEl.appendChild(tr);
  });
  const any = list.length > 0;
  tableEl.classList.toggle('hidden', !any);
  emptyEl.classList.toggle('hidden', any);
  $('count').textContent = entries.length;
}

/** Load all storage.local keys and refresh stats. */
async function load() {
  entries = Object.entries(await chrome.storage.local.get(null));
  // bytesInUse may not exist on all browsers; fall back to JSON size.
  let bytes = 0;
  try {
    bytes = await chrome.storage.local.getBytesInUse(null);
  } catch (e) {
    bytes = JSON.stringify(Object.fromEntries(entries)).length;
  }
  $('bytes').textContent = humanBytes(bytes || 0);
  render();
}

async function deleteKey(key) {
  await chrome.storage.local.remove(key);
  showToast('Deleted "' + key + '"');
  await load();
}

async function exportJson() {
  const data = Object.fromEntries(entries);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'extension-storage-export.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  showToast('Exported ' + entries.length + ' keys');
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('not an object');
      }
      const keys = Object.keys(data);
      await chrome.storage.local.set(data);
      showToast('Imported ' + keys.length + ' keys');
      await load();
    } catch (e) {
      showToast('Import failed: not valid JSON object');
    }
  };
  reader.readAsText(file);
}

// ---- events ----
searchEl.addEventListener('input', render);
$('refresh').addEventListener('click', load);
$('export').addEventListener('click', exportJson);
$('import').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', (e) => {
  if (e.target.files[0]) importJson(e.target.files[0]);
  e.target.value = '';
});

load();
