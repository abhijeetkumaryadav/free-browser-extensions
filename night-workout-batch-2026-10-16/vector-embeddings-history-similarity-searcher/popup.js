'use strict';
/* ------------------------------------------------------------------
 * History Similarity Search — fuzzy trigram similarity over chrome.history
 *
 * Honest scope: this is typo-tolerant TEXT similarity. There is no
 * embedding model, no vectors, and no semantic understanding.
 * Scoring blends: trigram overlap (typo-tolerant), exact-phrase bonus,
 * title-start bonus, and word-coverage bonus.
 * ------------------------------------------------------------------ */

const MAX_ITEMS   = 5000;   // history entries indexed in memory
const INDEX_LIMIT = 5000;
const MIN_SCORE   = 12;     // below this = not similar enough to show

let historyItems = [];      // {id, url, title, lastVisitTime, visitCount, _hay}
let debounceTimer = null;

/* ---------- text helpers ---------- */

/** Lowercase, collapse whitespace, strip punctuation-ish chars. */
function normalize(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Set of character trigrams for a normalized string. */
function trigrams(text) {
  const s = normalize(text).replace(/\s+/g, ' ');
  const set = new Set();
  for (let i = 0; i + 3 <= s.length; i++) set.add(s.slice(i, i + 3));
  return set;
}

/** Overlap coefficient: |A ∩ B| / min(|A|, |B|), in [0,1]. */
function trigramOverlap(a, b) {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (big.has(t)) hit++;
  return hit / small.size;
}

function words(text) {
  return normalize(text).split(' ').filter(w => w.length > 1);
}

/** Word-coverage: fraction of query words appearing in the target. */
function wordCoverage(qWords, targetWordsSet) {
  if (!qWords.length) return 0;
  let hit = 0;
  for (const w of qWords) if (targetWordsSet.has(w)) hit++;
  return hit / qWords.length;
}

/* ---------- scoring ---------- */

/**
 * Similarity score 0–100 for one history entry against a query.
 * Blend: 50% trigram overlap, 20% exact-phrase, 15% title-start, 15% word coverage.
 */
function similarityScore(query, entry) {
  const q = normalize(query);
  if (!q) return 0;
  const qWords = words(query);
  const titleN = normalize(entry.title);
  const urlN = normalize(entry.url);

  const qTri = trigrams(query);
  const triTitle = trigramOverlap(qTri, trigrams(entry.title));
  const triUrl = trigramOverlap(qTri, trigrams(entry.url));
  const tri = Math.max(triTitle, triUrl);

  const exact = (titleN.includes(q) || urlN.includes(q)) ? 1 : 0;
  const starts = titleN.startsWith(q) ? 1 : 0;

  const entryWordSet = new Set([...words(entry.title), ...words(entry.url)]);
  const coverage = wordCoverage(qWords, entryWordSet);

  return Math.round(tri * 50 + exact * 20 + starts * 15 + coverage * 15);
}

/* ---------- search pipeline ---------- */

function searchHistory(query, rangeMs, sortMode) {
  const now = Date.now();
  let pool = historyItems;
  if (rangeMs !== Infinity) pool = pool.filter(e => now - e.lastVisitTime <= rangeMs);

  if (!query.trim()) {
    // Empty query: show recent entries without scores.
    const list = [...pool].sort((a, b) => b.lastVisitTime - a.lastVisitTime).slice(0, 50);
    return list.map(e => ({ entry: e, score: null }));
  }

  const scored = [];
  for (const e of pool) {
    const score = similarityScore(query, e);
    if (score >= MIN_SCORE) scored.push({ entry: e, score });
  }

  if (sortMode === 'recent') scored.sort((a, b) => b.entry.lastVisitTime - a.entry.lastVisitTime);
  else if (sortMode === 'visited') scored.sort((a, b) => (b.entry.visitCount || 0) - (a.entry.visitCount || 0));
  else scored.sort((a, b) => b.score - a.score || b.entry.lastVisitTime - a.entry.lastVisitTime);

  return scored.slice(0, 100);
}

/* ---------- rendering ---------- */

const qInput = document.getElementById('q');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const rangeEl = document.getElementById('range');
const sortEl = document.getElementById('sort');

function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60000) return 'just now';
  if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
  if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
  return Math.floor(d / 86400000) + 'd ago';
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render(results) {
  resultsEl.innerHTML = '';
  if (!results.length) {
    resultsEl.innerHTML = '<li class="empty">No similar history entries found.<br>Try fewer words or check the spelling.</li>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const { entry, score } of results) {
    const li = document.createElement('li');
    li.className = 'card';
    const title = entry.title || '(no title)';
    li.innerHTML =
      '<div class="title">' + escapeHtml(title) + '</div>' +
      '<div class="url">' + escapeHtml(hostOf(entry.url)) + '</div>' +
      '<div class="bar"><i style="width:' + (score === null ? 0 : score) + '%"></i></div>' +
      '<div class="meta"><span>' + timeAgo(entry.lastVisitTime) + '</span><span>' +
      (entry.visitCount || 0) + ' visit' + ((entry.visitCount || 0) === 1 ? '' : 's') + '</span>' +
      (score === null ? '' : '<span class="score">' + score + '% similar</span>') + '</div>' +
      '<div class="rowbtns">' +
        '<button class="mini open" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/></svg>Open</button>' +
        '<button class="mini danger remove" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>Remove</button>' +
      '</div>';
    li.querySelector('.open').addEventListener('click', ev => {
      ev.stopPropagation();
      chrome.tabs.create({ url: entry.url });
    });
    li.querySelector('.remove').addEventListener('click', ev => {
      ev.stopPropagation();
      chrome.history.deleteUrl({ url: entry.url }, () => {
        historyItems = historyItems.filter(e => e.url !== entry.url);
        runSearch();
      });
    });
    li.addEventListener('click', () => chrome.tabs.create({ url: entry.url }));
    frag.appendChild(li);
  }
  resultsEl.appendChild(frag);
}

function runSearch() {
  const query = qInput.value;
  const rangeVal = rangeEl.value;
  const rangeMs = rangeVal === 'all' ? Infinity : Number(rangeVal);
  const sortMode = sortEl.value;
  const results = searchHistory(query, rangeMs, sortMode);
  const label = query.trim()
    ? results.length + ' similar entr' + (results.length === 1 ? 'y' : 'ies')
    : historyItems.length.toLocaleString() + ' entries indexed';
  statusEl.textContent = label;
  render(results);
}

/* ---------- init ---------- */

function init() {
  chrome.history.search({ text: '', maxResults: MAX_ITEMS, startTime: 0 }, items => {
    historyItems = (items || []).slice(0, INDEX_LIMIT);
    statusEl.textContent = historyItems.length.toLocaleString() + ' entries indexed';
    runSearch();
  });

  qInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 120);
  });
  rangeEl.addEventListener('change', runSearch);
  sortEl.addEventListener('change', runSearch);
  document.getElementById('clear').addEventListener('click', () => {
    qInput.value = '';
    runSearch();
    qInput.focus();
  });
  qInput.focus();
}

document.addEventListener('DOMContentLoaded', init);
