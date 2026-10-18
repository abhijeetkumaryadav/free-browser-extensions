/* Report Library — bookmark organizer for Salesforce report links. No API, no credentials. */
'use strict';

const KEY = 'reports';
const $ = (id) => document.getElementById(id);
let reports = []; // [{id, name, url, folder, notes, created}]

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

async function load() {
  const data = await chrome.storage.local.get(KEY);
  reports = data[KEY] || [];
}
async function save() {
  await chrome.storage.local.set({ [KEY]: reports });
}

function folders() {
  const set = new Set();
  for (const r of reports) if (r.folder) set.add(r.folder);
  return [...set].sort((a, b) => a.localeCompare(b));
}

function filtered() {
  const q = $('searchInput').value.trim().toLowerCase();
  const f = $('folderFilter').value;
  return reports.filter((r) =>
    (!f || r.folder === f) &&
    (!q || (r.name + ' ' + (r.notes || '') + ' ' + hostOf(r.url)).toLowerCase().includes(q))
  );
}

function render() {
  const list = $('reportList');
  list.innerHTML = '';
  const items = filtered().sort((a, b) => b.created - a.created);

  $('countBadge').textContent = reports.length;
  $('emptyState').classList.toggle('hidden', reports.length > 0);

  // folder filter options
  const sel = $('folderFilter');
  const current = sel.value;
  sel.innerHTML = '<option value="">All folders</option>';
  for (const f of folders()) {
    const opt = document.createElement('option');
    opt.value = f; opt.textContent = f;
    sel.appendChild(opt);
  }
  sel.value = current;
  // datalist hints
  $('folderHints').innerHTML = folders().map((f) => '<option value="' + esc(f) + '">').join('');

  for (const r of items) {
    const li = document.createElement('li');
    li.className = 'report';
    li.innerHTML =
      '<div class="report-top"><span class="report-name" title="' + esc(r.name) + '">' + esc(r.name) + '</span>' +
      (r.folder ? '<span class="folder-chip">' + esc(r.folder) + '</span>' : '') + '</div>' +
      (r.notes ? '<div class="report-notes">' + esc(r.notes) + '</div>' : '') +
      '<div class="report-actions">' +
      '<button class="mini open" data-open="' + r.id + '">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>' +
      'Open</button>' +
      '<button class="mini" data-copy="' + r.id + '">Copy URL</button>' +
      '<button class="mini del" data-del="' + r.id + '">Delete</button>' +
      '</div>';
    list.appendChild(li);
  }

  list.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
    const r = reports.find((x) => x.id === b.dataset.open);
    if (r) chrome.tabs.create({ url: r.url });
  }));
  list.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const r = reports.find((x) => x.id === b.dataset.copy);
    if (r) { try { await navigator.clipboard.writeText(r.url); b.textContent = 'Copied!'; setTimeout(() => b.textContent = 'Copy URL', 1200); } catch {} }
  }));
  list.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Delete this report bookmark?')) return;
    reports = reports.filter((x) => x.id !== b.dataset.del);
    await save(); render();
  }));
}

function exportCSV() {
  const rows = [['name', 'url', 'folder', 'notes']];
  for (const r of reports) {
    const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    rows.push([q(r.name), q(r.url), q(r.folder), q(r.notes)]);
  }
  const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'report-library.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function init() {
  $('addBtn').addEventListener('click', async () => {
    const name = $('nameInput').value.trim();
    const url = $('urlInput').value.trim();
    const valid = /^https?:\/\/.+\..+/.test(url);
    $('formError').classList.toggle('hidden', !!(name && valid));
    if (!name || !valid) return;
    reports.push({
      id: 'r' + Date.now().toString(36),
      name,
      url,
      folder: $('folderInput').value.trim(),
      notes: $('notesInput').value.trim(),
      created: Date.now()
    });
    $('nameInput').value = ''; $('urlInput').value = '';
    $('folderInput').value = ''; $('notesInput').value = '';
    await save(); render();
  });

  $('searchInput').addEventListener('input', render);
  $('folderFilter').addEventListener('change', render);
  $('csvBtn').addEventListener('click', exportCSV);
  $('clearBtn').addEventListener('click', async () => {
    if (!reports.length || !confirm('Delete ALL saved report bookmarks?')) return;
    reports = [];
    await save(); render();
  });

  load().then(render);
}

document.addEventListener('DOMContentLoaded', init);
