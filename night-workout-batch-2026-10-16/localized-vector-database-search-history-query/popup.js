// Local History Search — fuzzy full-text search over chrome.history.
// NOT semantic/vector search: scoring = trigram overlap + substring bonuses.
// All data stays in memory in the popup; nothing leaves the device.

const $ = (id) => document.getElementById(id);

let ENTRIES = [];          // [{id, url, title, lastVisitTime, visitCount, host, text, trigrams:Set}]
let INDEXED = false;
const MAX_RESULTS = 5_000;

// --- Text helpers ------------------------------------------------------------
function normalize(s) {
  return (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s.:/_-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function trigrams(s) {
  const t = '  ' + normalize(s) + '  ';
  const set = new Set();
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
  return set;
}

// --- Indexing ----------------------------------------------------------------
async function buildIndex() {
  const status = $('status');
  try {
    const raw = await chrome.history.search({ text: '', maxResults: MAX_RESULTS, startTime: 0 });
    ENTRIES = raw.map(h => {
      let host = '';
      try { host = new URL(h.url).hostname.replace(/^www\./, ''); } catch (e) { /* ignore */ }
      const text = normalize((h.title || '') + ' ' + h.url);
      return {
        id: h.id, url: h.url, title: h.title || h.url,
        lastVisitTime: h.lastVisitTime || 0, visitCount: h.visitCount || 0,
        host, text, tris: trigrams(text)
      };
    });
    INDEXED = true;
    $('indexCount').textContent = `${ENTRIES.length.toLocaleString()} indexed`;
    status.textContent = 'Start typing to search — tolerant of typos.';
    runSearch();
  } catch (e) {
    status.textContent = 'History permission denied or unavailable.';
  }
}

// --- Scoring -----------------------------------------------------------------
// score(entry, queryTris, queryNorm):
//   0.55 * trigram cosine-ish overlap + exact-phrase bonus + title-start bonus
function scoreEntry(e, qTris, qNorm, qWords) {
  let overlap = 0;
  for (const t of qTris) if (e.tris.has(t)) overlap++;
  const triScore = overlap / qTris.size;                       // 0..1
  let score = triScore * 55;

  const titleN = normalize(e.title);
  if (qNorm && e.text.includes(qNorm)) score += 25;           // exact phrase
  if (titleN.startsWith(qWords[0] || '')) score += 10;        // title starts with first word
  let wordHits = 0;
  for (const w of qWords) if (w && e.text.includes(w)) wordHits++;
  score += Math.min(10, wordHits * 3);                         // partial word coverage

  return score; // roughly 0..100
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

function runSearch() {
  if (!INDEXED) return;
  const q = normalize($('query').value);
  const range = $('range').value;
  const dom = normalize($('domain').value).replace(/^www\./, '');
  const sort = $('sort').value;
  const box = $('results');
  const status = $('status');

  const now = Date.now();
  const cutoff = range === 'day' ? now - 864e5
    : range === 'week' ? now - 7 * 864e5
    : range === 'month' ? now - 30 * 864e5 : 0;

  const qTris = q ? trigrams(q) : new Set();
  const qWords = q ? q.split(' ') : [];

  const scored = [];
  for (const e of ENTRIES) {
    if (e.lastVisitTime < cutoff) continue;
    if (dom && !e.host.includes(dom)) continue;
    let score;
    if (!q) {
      score = sort === 'visits' ? Math.log1p(e.visitCount) * 20 : e.lastVisitTime / 1e13 * 100;
    } else {
      score = scoreEntry(e, qTris, q, qWords);
      if (score < 8) continue; // relevance floor
    }
    scored.push([score, e]);
  }

  if (!q && sort === 'relevance') scored.sort((a, b) => b[1].lastVisitTime - a[1].lastVisitTime);
  else if (sort === 'recent') scored.sort((a, b) => b[1].lastVisitTime - a[1].lastVisitTime);
  else if (sort === 'visits') scored.sort((a, b) => b[1].visitCount - a[1].visitCount);
  else scored.sort((a, b) => b[0] - a[0]);

  const top = scored.slice(0, 60);
  status.textContent = `${top.length} result${top.length === 1 ? '' : 's'}${q ? ` for “${$('query').value.trim()}”` : ''} · fuzzy text match`;
  box.innerHTML = '';
  if (!top.length) {
    box.innerHTML = '<p class="empty">No matches. Try fewer words or check the domain filter.</p>';
    return;
  }
  for (const [, e] of top) {
    const div = document.createElement('div');
    div.className = 'result';

    const title = document.createElement('div');
    title.className = 'title';
    title.innerHTML = highlight(e.title, qWords);

    const url = document.createElement('div');
    url.className = 'url';
    url.textContent = e.url.length > 90 ? e.url.slice(0, 90) + '…' : e.url;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const when = new Date(e.lastVisitTime).toLocaleString();
    meta.innerHTML = `<span>${escapeHtml(when)} · ${e.visitCount} visit${e.visitCount === 1 ? '' : 's'}</span>`;
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = 'remove';
    del.title = 'Remove from history';
    del.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await chrome.history.deleteUrl({ url: e.url });
      ENTRIES = ENTRIES.filter(x => x.url !== e.url);
      runSearch();
    });
    meta.appendChild(del);

    div.append(title, url, meta);
    div.addEventListener('click', () => chrome.tabs.create({ url: e.url }));
    box.appendChild(div);
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function highlight(title, words) {
  let out = escapeHtml(title);
  for (const w of words) {
    if (!w || w.length < 2) continue;
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      out = out.replace(new RegExp('(' + esc + ')', 'gi'), '<mark>$1</mark>');
    } catch (e) { /* bad pattern — skip */ }
  }
  return out;
}

// --- Events -------------------------------------------------------------------
let debounce;
$('query').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(runSearch, 120); });
$('range').addEventListener('change', runSearch);
$('domain').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(runSearch, 200); });
$('sort').addEventListener('change', runSearch);

buildIndex();

// Expose scoring for the smoke test (deleted in the packaged popup context; harmless).
if (typeof module !== 'undefined') module.exports = { normalize, trigrams, scoreEntry };
