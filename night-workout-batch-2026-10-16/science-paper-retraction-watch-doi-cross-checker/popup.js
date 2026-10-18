/* ============================================================
 * Paper Logbook — Retraction Watch (personal)
 * Fully local: papers are logged in chrome.storage.local.
 * Honest scope: your logbook — NOT live retraction data.
 * ============================================================
'use strict';

// ENGINE-START
const DOI_RE = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;
const STATUSES = ['ok', 'concerned', 'retracted-by-you'];
const STATUS_LABEL = {
  'ok': 'OK',
  'concerned': 'Concerned',
  'retracted-by-you': 'Retracted (my call)',
};

/** Build a paper entry from user input; returns {ok, entry} or {ok:false, error}. */
function makeEntry(doi, title, status, notes) {
  const d = (doi || '').trim();
  const t = (title || '').trim();
  if (!d || !t) return { ok: false, error: 'DOI and title are required.' };
  if (!DOI_RE.test(d)) return { ok: false, error: 'That does not look like a valid DOI (expected 10.xxxx/…).' };
  if (!STATUSES.includes(status)) return { ok: false, error: 'Unknown status.' };
  return {
    ok: true,
    entry: {
      id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      doi: d,
      title: t.slice(0, 300),
      status,
      notes: (notes || '').trim().slice(0, 1000),
      addedAt: Date.now(),
    },
  };
}

/** Newest-first, non-mutating sort. */
function sortEntries(entries) {
  return entries.slice().sort((a, b) => b.addedAt - a.addedAt);
}

/** Filter by free-text query across doi/title/notes. */
function filterEntries(entries, q) {
  const s = (q || '').trim().toLowerCase();
  if (!s) return entries.slice();
  return entries.filter((e) =>
    e.doi.toLowerCase().includes(s) ||
    e.title.toLowerCase().includes(s) ||
    (e.notes || '').toLowerCase().includes(s)
  );
}

/** Per-status counts. */
function statusCounts(entries) {
  const c = { ok: 0, concerned: 0, 'retracted-by-you': 0 };
  for (const e of entries) if (c[e.status] !== undefined) c[e.status] += 1;
  return c;
}

/** Format a timestamp for the list. */
function fmtDate(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
// ENGINE-END

// ---------- storage ----------
const KEY = 'papers';
async function loadPapers() {
  const r = await chrome.storage.local.get(KEY);
  return Array.isArray(r[KEY]) ? r[KEY] : [];
}
async function savePapers(papers) {
  await chrome.storage.local.set({ [KEY]: papers });
}

// ---------- ui ----------
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function showErr(msg) {
  const el = $('err');
  el.textContent = msg;
  el.hidden = !msg;
}

function render(papers, q) {
  const shown = sortEntries(filterEntries(papers, q));
  const list = $('list');
  list.innerHTML = '';
  for (const p of shown) {
    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML =
      `<div class="row"><span class="badge ${esc(p.status)}">${esc(STATUS_LABEL[p.status] || p.status)}</span>` +
      `<span class="doi">${esc(p.doi)}</span></div>` +
      `<div class="title">${esc(p.title)}</div>` +
      (p.notes ? `<p class="notes">${esc(p.notes)}</p>` : '') +
      `<div class="meta"><time>${esc(fmtDate(p.addedAt))}</time>` +
      `<button class="del" data-id="${esc(p.id)}" title="Delete">×</button></div>`;
    list.appendChild(li);
  }
  $('empty').hidden = shown.length > 0;
  const c = statusCounts(papers);
  $('stats').innerHTML =
    `<span class="chip">Total <b>${papers.length}</b></span>` +
    `<span class="chip">OK <b>${c.ok}</b></span>` +
    `<span class="chip">Concerned <b>${c.concerned}</b></span>` +
    `<span class="chip">Retracted (mine) <b>${c['retracted-by-you']}</b></span>`;
}

// ---------- events ----------
let papers = [];

document.addEventListener('DOMContentLoaded', async () => {
  papers = await loadPapers();
  render(papers, '');

  $('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showErr('');
    const r = makeEntry($('doi').value, $('title').value, $('status').value, $('notes').value);
    if (!r.ok) {
      showErr(r.error);
      return;
    }
    papers.push(r.entry);
    await savePapers(papers);
    $('doi').value = '';
    $('title').value = '';
    $('notes').value = '';
    $('status').value = 'ok';
    render(papers, $('q').value);
  });

  $('q').addEventListener('input', (e) => render(papers, e.target.value));

  $('list').addEventListener('click', async (e) => {
    const btn = e.target.closest('.del');
    if (!btn) return;
    papers = papers.filter((p) => p.id !== btn.dataset.id);
    await savePapers(papers);
    render(papers, $('q').value);
  });
});
