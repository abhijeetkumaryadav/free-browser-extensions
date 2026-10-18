/* Recall — smart history search.
 * Honest scope: this is NOT semantic search and NOT AI. It calls
 * chrome.history.search, then re-ranks results by keyword matches
 * (title weighted 3x, URL 1x) plus a small visit-count boost.
 * Everything stays on-device; zero network calls. */

'use strict';

const RANGE_KEY = 'recall_range';
const MAX_RESULTS = 1000;

const state = { query: '', range: 'all', items: [] };

const $ = id => document.getElementById(id);
const resultsEl = () => $('results');
const emptyEl = () => $('emptyState');
const statusEl = () => $('statusLine');

/* ---------- Query / ranking ---------- */

/** Tokenize a query: lowercase words, drop tiny tokens. No stopword list here —
 *  history titles are short, so every token counts. */
function tokenize(q) {
  return (q || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 1);
}

/**
 * Score one history item against query terms.
 * Title hits weigh 3x (intent lives in titles), URL/host hits 1x.
 * A small log-scaled visit-count bonus surfaces pages you actually use.
 */
function scoreItem(item, terms) {
  if (!terms.length) return 0;
  const title = (item.title || '').toLowerCase();
  let host = '';
  try { host = new URL(item.url).hostname.toLowerCase(); } catch (e) { /* ignore */ }
  const url = (item.url || '').toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (title.includes(t)) score += 3;
    if (host.includes(t)) score += 1.5;
    else if (url.includes(t)) score += 1;
  }
  if (score > 0) score += Math.log(1 + (item.visitCount || 0)) * 0.4;
  return score;
}

function rankItems(items, query) {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) {
    // No query: pure recency.
    return [...items].sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0));
  }
  return items
    .map(item => ({ item, score: scoreItem(item, terms) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score || (b.item.lastVisitTime || 0) - (a.item.lastVisitTime || 0))
    .map(r => r.item);
}

/* ---------- Date helpers ---------- */

function rangeStart(range) {
  const now = new Date();
  if (range === 'today') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return d.getTime();
  }
  if (range === 'week') return Date.now() - 7 * 864e5;
  if (range === 'month') return Date.now() - 30 * 864e5;
  return 0;
}

/** "Today" / "Yesterday" / "Mon, Oct 14". */
function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function timeOf(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch (e) { return url; }
}

/* ---------- Rendering ---------- */

function esc(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function highlight(text, terms) {
  let out = esc(text);
  for (const t of [...terms].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    out = out.replace(re, '<mark>$1</mark>');
  }
  return out;
}

function render() {
  const box = resultsEl();
  box.innerHTML = '';
  const ranked = rankItems(state.items, state.query);
  const terms = [...new Set(tokenize(state.query))];

  emptyEl().classList.toggle('hidden', ranked.length > 0);
  $('clearFiltered').classList.toggle('hidden', ranked.length === 0);

  if (!ranked.length) {
    statusEl().textContent = '';
    $('emptyText').innerHTML = state.query
      ? `No history matches “${esc(state.query)}”.<br>Try fewer or different keywords.`
      : 'No history in this range.<br>Browse the web and come back.';
    return;
  }

  statusEl().textContent = `${ranked.length} result${ranked.length === 1 ? '' : 's'}` +
    (state.query ? ` for “${state.query}”` : ' — most recent first');

  // Group consecutive items by day label.
  let lastLabel = null;
  let group = null;
  for (const item of ranked) {
    const label = dayLabel(item.lastVisitTime || 0);
    if (label !== lastLabel) {
      group = document.createElement('div');
      group.className = 'day-group';
      const h = document.createElement('div');
      h.className = 'day-label';
      h.textContent = label;
      group.appendChild(h);
      box.appendChild(group);
      lastLabel = label;
    }
    const card = document.createElement('div');
    card.className = 'card';
    const host = hostOf(item.url);
    const title = item.title || host;
    card.innerHTML = `
      <div class="domain-dot">${esc((host[0] || '?'))}</div>
      <div class="card-body">
        <div class="card-title"><a href="${esc(item.url)}" data-open="${esc(item.url)}" title="${esc(item.url)}">${highlight(title, terms)}</a></div>
        <div class="card-url">${highlight(host, terms)}</div>
        <div class="card-foot">
          <span class="visit-info">${timeOf(item.lastVisitTime || 0)}${item.visitCount > 1 ? ` · ${item.visitCount} visits` : ''}</span>
          <span class="card-actions">
            <button class="mini-btn" data-open="${esc(item.url)}">Open</button>
            <button class="mini-btn danger" data-del="${esc(item.url)}">Delete</button>
          </span>
        </div>
      </div>`;
    group.appendChild(card);
  }

  box.querySelectorAll('[data-open]').forEach(b => b.onclick = e => {
    e.preventDefault();
    chrome.tabs.create({ url: b.dataset.open });
  });
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => deleteEntry(b.dataset.del));
}

/* ---------- Data ---------- */

async function load() {
  try {
    const items = await chrome.history.search({
      text: state.query,
      maxResults: MAX_RESULTS,
      startTime: rangeStart(state.range)
    });
    // history.search already filters by range; keep client-side too for safety.
    const start = rangeStart(state.range);
    state.items = (items || []).filter(i => (i.lastVisitTime || 0) >= start && i.url && !i.url.startsWith('chrome://'));
  } catch (err) {
    state.items = [];
  }
  render();
}

async function deleteEntry(url) {
  await chrome.history.deleteUrl({ url });
  state.items = state.items.filter(i => i.url !== url);
  render();
}

/** Two-step confirm: first click arms, second click within 3s clears. */
let clearArmed = false;
let clearTimer = null;
async function clearFiltered() {
  const btn = $('clearFiltered');
  if (!clearArmed) {
    clearArmed = true;
    btn.textContent = 'Confirm clear?';
    clearTimer = setTimeout(() => {
      clearArmed = false;
      btn.textContent = 'Clear shown';
    }, 3000);
    return;
  }
  clearTimeout(clearTimer);
  clearArmed = false;
  btn.textContent = 'Clear shown';
  const ranked = rankItems(state.items, state.query);
  for (const item of ranked) {
    try { await chrome.history.deleteUrl({ url: item.url }); } catch (e) { /* keep going */ }
  }
  const gone = new Set(ranked.map(i => i.url));
  state.items = state.items.filter(i => !gone.has(i.url));
  render();
}

/* ---------- Wire up ---------- */

let debounce = null;
$('searchInput').addEventListener('input', () => {
  $('clearSearch').classList.toggle('hidden', !$('searchInput').value);
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    state.query = $('searchInput').value.trim();
    load();
  }, 180);
});
$('clearSearch').onclick = () => {
  $('searchInput').value = '';
  $('clearSearch').classList.add('hidden');
  state.query = '';
  load();
};

document.querySelectorAll('.chip').forEach(chip => {
  chip.onclick = async () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.range = chip.dataset.range;
    await chrome.storage.local.set({ [RANGE_KEY]: state.range });
    load();
  };
});

$('clearFiltered').onclick = clearFiltered;

(async function init() {
  const { [RANGE_KEY]: saved } = await chrome.storage.local.get(RANGE_KEY);
  if (saved && ['all', 'today', 'week', 'month'].includes(saved)) {
    state.range = saved;
    document.querySelectorAll('.chip').forEach(c =>
      c.classList.toggle('active', c.dataset.range === saved));
  }
  load();
})();
