/* Political Ad Funding Guide — popup logic. Educational explainer + personal ad log. */

'use strict';

// ---------------- Pure engine (headless-testable) ----------------
// ENGINE-START
const MAX_ENTRIES = 200;

function makeEntry(platform, sponsor, notes, now) {
  const p = String(platform || '').trim();
  const s = String(sponsor || '').trim();
  if (!p && !s) return null;
  return {
    id: String(now) + '-' + Math.floor(Math.random() * 1e6),
    platform: p.slice(0, 60),
    sponsor: s.slice(0, 120),
    notes: String(notes || '').trim().slice(0, 500),
    ts: now,
  };
}

function addEntry(list, entry) {
  const next = [entry, ...list];
  return next.slice(0, MAX_ENTRIES);
}

function removeEntry(list, id) {
  return list.filter((e) => e.id !== id);
}

function filterEntries(list, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((e) =>
    e.platform.toLowerCase().includes(q) ||
    e.sponsor.toLowerCase().includes(q) ||
    e.notes.toLowerCase().includes(q));
}

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
// ENGINE-END

// ---------------- UI ----------------
const $ = (id) => document.getElementById(id);
let entries = [];

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function render() {
  const q = $('search').value;
  const list = filterEntries(entries, q);
  $('count').textContent = entries.length;
  const box = $('entries');
  if (!list.length) {
    box.innerHTML = '<p class="empty">' + (entries.length ? 'No matches.' : 'No ads logged yet.') + '</p>';
    return;
  }
  box.innerHTML = list.map((e) => `
    <div class="entry" data-id="${esc(e.id)}">
      <button class="del" data-del="${esc(e.id)}" title="Delete">✕</button>
      <div class="sponsor">${esc(e.sponsor) || '<span style="color:var(--dim)">(no sponsor noted)</span>'}</div>
      <div class="meta">${esc(e.platform) || 'unknown platform'} · ${esc(fmtDate(e.ts))}</div>
      ${e.notes ? `<div class="notes">${esc(e.notes)}</div>` : ''}
    </div>`).join('');
}

async function load() {
  try {
    const s = await chrome.storage.local.get('adLog');
    entries = Array.isArray(s.adLog) ? s.adLog : [];
  } catch { entries = []; }
  render();
}

function save() {
  chrome.storage.local.set({ adLog: entries }).catch(() => {});
}

$('add').addEventListener('click', () => {
  const e = makeEntry($('platform').value, $('sponsor').value, $('notes').value, Date.now());
  if (!e) { $('platform').focus(); return; }
  entries = addEntry(entries, e);
  $('platform').value = ''; $('sponsor').value = ''; $('notes').value = '';
  save(); render();
});

$('entries').addEventListener('click', (ev) => {
  const id = ev.target.getAttribute('data-del');
  if (id) { entries = removeEntry(entries, id); save(); render(); }
});

$('search').addEventListener('input', render);

$('tabLearn').addEventListener('click', () => {
  $('tabLearn').classList.add('active'); $('tabLog').classList.remove('active');
  $('learn').classList.remove('hidden'); $('log').classList.add('hidden');
});
$('tabLog').addEventListener('click', () => {
  $('tabLog').classList.add('active'); $('tabLearn').classList.remove('active');
  $('log').classList.remove('hidden'); $('learn').classList.add('hidden');
});

load();
