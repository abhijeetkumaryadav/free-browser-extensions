/* LexiMatch — keyword similarity search (TF-IDF, on-device).
 * Honest scope: this is NOT vector embeddings and NOT AI. It ranks saved
 * pages/notes by keyword overlap using TF-IDF scoring, all locally. */

'use strict';

const STORE_KEY = 'leximatch_docs';
const MAX_TEXT = 20000;      // chars stored per document
const MAX_RESULTS = 30;

// Common English stopwords — excluded from scoring so matches are meaningful.
const STOPWORDS = new Set(
  ('a,an,and,are,as,at,be,been,but,by,for,from,had,has,have,he,her,hers,' +
   'him,his,i,if,in,into,is,it,its,me,my,not,of,on,or,our,ours,she,so,' +
   'that,the,their,them,they,this,those,to,was,we,were,will,with,you,your,' +
   'can,could,should,would,do,does,did,than,then,when,where,which,while,' +
   'who,whom,what,how,all,any,both,each,few,more,most,other,some,such,' +
   'no,nor,only,own,same,too,very,just,also,over,under,again,once,here,' +
   'there').split(',')
);

/* ---------- Text utilities ---------- */

/** Lowercase, strip punctuation, split, drop stopwords and tiny tokens. */
function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

/** term -> count for a token list. */
function termFreq(tokens) {
  const map = new Map();
  for (const t of tokens) map.set(t, (map.get(t) || 0) + 1);
  return map;
}

/* ---------- Scoring (TF-IDF) ---------- */

/**
 * Build an IDF map from the whole corpus: idf(t) = ln(1 + N / df(t)).
 * Rare terms across your saved docs score higher — that's the "similarity".
 */
function buildIdf(docs) {
  const df = new Map();
  const docTerms = docs.map(d => {
    const terms = new Set(tokenize(d.title + ' ' + d.text));
    for (const t of terms) df.set(t, (df.get(t) || 0) + 1);
    return terms;
  });
  const N = Math.max(docs.length, 1);
  const idf = new Map();
  for (const [t, count] of df) idf.set(t, Math.log(1 + N / count));
  return { idf, docTerms };
}

/**
 * Score one doc against query terms.
 * Title matches count 3x (titles are dense with intent), body matches 1x.
 */
function scoreDoc(queryTerms, doc, idf) {
  const titleTf = termFreq(tokenize(doc.title));
  const bodyTf = termFreq(tokenize(doc.text));
  let score = 0;
  const matched = new Set();
  for (const q of queryTerms) {
    const w = idf.get(q) || 0;
    if (w === 0) continue;
    const tf = (titleTf.get(q) || 0) * 3 + (bodyTf.get(q) || 0);
    if (tf > 0) {
      // Log-scaled TF so a 50x repeated word doesn't dominate.
      score += w * (1 + Math.log(tf));
      matched.add(q);
    }
  }
  return { score, matched: [...matched] };
}

/** Rank docs for a query string. Returns [{doc, score(0-100), matched}]. */
function rankDocs(query, docs) {
  const queryTerms = [...new Set(tokenize(query))];
  if (!queryTerms.length || !docs.length) return [];
  const { idf } = buildIdf(docs);
  const scored = docs
    .map(doc => ({ doc, ...scoreDoc(queryTerms, doc, idf) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
  const max = scored.length ? scored[0].score : 1;
  return scored.map(r => ({ ...r, score: Math.round((r.score / max) * 100) }));
}

/** "Find similar": use a doc's own top terms as the query (excluding itself). */
function findSimilar(target, docs) {
  const tf = termFreq(tokenize(target.title + ' ' + target.text));
  const { idf } = buildIdf(docs);
  const topTerms = [...tf.entries()]
    .map(([t, c]) => ({ t, w: c * (idf.get(t) || 0) }))
    .sort((a, b) => b.w - a.w)
    .slice(0, 12)
    .map(x => x.t);
  return rankDocs(topTerms.join(' '), docs.filter(d => d.id !== target.id));
}

/* ---------- Page text extraction (injected on demand, MAIN world) ---------- */

/** Runs inside the tab via chrome.scripting.executeScript — must stay self-contained. */
function extractPageText() {
  const el = document.querySelector('article') || document.querySelector('main') || document.body;
  const clone = el.cloneNode(true);
  clone.querySelectorAll('script, style, noscript, nav, header, footer, aside, form').forEach(n => n.remove());
  const text = (clone.innerText || '').replace(/\s+/g, ' ').trim();
  return { title: document.title || 'Untitled page', text: text.slice(0, 20000), url: location.href };
}

/* ---------- Storage ---------- */

async function loadDocs() {
  const { [STORE_KEY]: docs } = await chrome.storage.local.get(STORE_KEY);
  return Array.isArray(docs) ? docs : [];
}
async function saveDocs(docs) {
  await chrome.storage.local.set({ [STORE_KEY]: docs });
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- Rendering ---------- */

const $ = id => document.getElementById(id);
const resultsEl = () => $('results');
const emptyEl = () => $('emptyState');
const statusEl = () => $('statusLine');

function esc(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Wrap matched terms in <mark> inside a snippet. */
function highlight(text, terms) {
  let out = esc(text);
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  for (const t of sorted) {
    const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    out = out.replace(re, '<mark>$1</mark>');
  }
  return out;
}

function snippetFor(doc, matched) {
  const src = doc.text || '';
  if (!matched.length) return esc(src.slice(0, 160)) + (src.length > 160 ? '…' : '');
  // Find first occurrence of any matched term, show context around it.
  const lower = src.toLowerCase();
  let idx = -1;
  for (const t of matched) { const i = lower.indexOf(t); if (i !== -1 && (idx === -1 || i < idx)) idx = i; }
  const start = Math.max(0, idx - 60);
  const end = Math.min(src.length, idx + 140);
  return (start > 0 ? '…' : '') + highlight(src.slice(start, end), matched) + (end < src.length ? '…' : '');
}

function renderList(items, queryTermsForHighlight) {
  const box = resultsEl();
  box.innerHTML = '';
  emptyEl().classList.toggle('hidden', items.length > 0);
  for (const { doc, score, matched } of items) {
    const card = document.createElement('div');
    card.className = 'card';
    const titleHtml = doc.url
      ? `<a href="${esc(doc.url)}" data-open="${esc(doc.url)}">${esc(doc.title)}</a>`
      : esc(doc.title);
    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-title">${titleHtml}</div>
          <div class="card-meta">${doc.type === 'page' ? 'Saved page' : 'Note'} · ${new Date(doc.created).toLocaleDateString()}</div>
        </div>
        <div class="score-wrap">
          <div class="score-bar"><div class="score-fill" style="width:${score}%"></div></div>
          <span class="score-num">${score}%</span>
        </div>
      </div>
      <div class="snippet">${snippetFor(doc, matched)}</div>
      ${matched.length ? `<div class="terms">${matched.slice(0, 8).map(t => `<span class="term-chip">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="card-actions">
        <button class="mini-btn" data-similar="${doc.id}">Find similar</button>
        ${doc.url ? `<button class="mini-btn" data-open="${esc(doc.url)}">Open page</button>` : ''}
        <button class="mini-btn danger" data-del="${doc.id}">Delete</button>
      </div>`;
    box.appendChild(card);
  }
  // Wire card buttons (event delegation would also work; explicit is clearer).
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => deleteDoc(b.dataset.del));
  box.querySelectorAll('[data-similar]').forEach(b => b.onclick = () => showSimilar(b.dataset.similar));
  box.querySelectorAll('[data-open]').forEach(b => b.onclick = e => {
    e.preventDefault();
    chrome.tabs.create({ url: b.dataset.open });
  });
}

function renderAll(docs) {
  // No query: list everything newest-first, no scores.
  const items = [...docs].sort((a, b) => b.created - a.created)
    .map(doc => ({ doc, score: 100, matched: [] }));
  // Hide score UI when browsing all — render simpler cards.
  const box = resultsEl();
  box.innerHTML = '';
  emptyEl().classList.toggle('hidden', docs.length > 0);
  statusEl().textContent = docs.length ? `${docs.length} saved item${docs.length === 1 ? '' : 's'}` : '';
  for (const { doc } of items) {
    const card = document.createElement('div');
    card.className = 'card';
    const titleHtml = doc.url
      ? `<a href="${esc(doc.url)}" data-open="${esc(doc.url)}">${esc(doc.title)}</a>`
      : esc(doc.title);
    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-title">${titleHtml}</div>
          <div class="card-meta">${doc.type === 'page' ? 'Saved page' : 'Note'} · ${new Date(doc.created).toLocaleDateString()}</div>
        </div>
      </div>
      <div class="snippet">${esc((doc.text || '').slice(0, 160))}${(doc.text || '').length > 160 ? '…' : ''}</div>
      <div class="card-actions">
        <button class="mini-btn" data-similar="${doc.id}">Find similar</button>
        ${doc.url ? `<button class="mini-btn" data-open="${esc(doc.url)}">Open page</button>` : ''}
        <button class="mini-btn danger" data-del="${doc.id}">Delete</button>
      </div>`;
    box.appendChild(card);
  }
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => deleteDoc(b.dataset.del));
  box.querySelectorAll('[data-similar]').forEach(b => b.onclick = () => showSimilar(b.dataset.similar));
  box.querySelectorAll('[data-open]').forEach(b => b.onclick = e => {
    e.preventDefault();
    chrome.tabs.create({ url: b.dataset.open });
  });
}

/* ---------- Actions ---------- */

async function refresh() {
  const docs = await loadDocs();
  const q = $('searchInput').value.trim();
  if (!q) { renderAll(docs); return; }
  const ranked = rankDocs(q, docs);
  statusEl().textContent = ranked.length
    ? `${ranked.length} match${ranked.length === 1 ? '' : 'es'} for “${q}”`
    : `No keyword matches for “${q}”`;
  renderList(ranked, tokenize(q));
}

async function showSimilar(id) {
  const docs = await loadDocs();
  const target = docs.find(d => d.id === id);
  if (!target) return;
  const ranked = findSimilar(target, docs);
  statusEl().textContent = ranked.length
    ? `Similar to “${target.title.slice(0, 32)}${target.title.length > 32 ? '…' : ''}”`
    : 'Nothing similar saved yet.';
  renderList(ranked, []);
  resultsEl().scrollIntoView({ block: 'start' });
}

async function deleteDoc(id) {
  const docs = (await loadDocs()).filter(d => d.id !== id);
  await saveDocs(docs);
  refresh();
}

async function saveCurrentPage() {
  const btn = $('savePageBtn');
  btn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || /^chrome:\/\//.test(tab.url || '')) {
      statusEl().textContent = 'Cannot save this page (browser internal page).';
      return;
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageText
    });
    if (!result || !result.text) {
      statusEl().textContent = 'No readable text found on this page.';
      return;
    }
    const docs = await loadDocs();
    // Avoid exact-URL duplicates: replace the old snapshot.
    const existing = docs.findIndex(d => d.url === result.url);
    const doc = {
      id: existing >= 0 ? docs[existing].id : uid(),
      title: result.title, url: result.url,
      text: result.text.slice(0, MAX_TEXT),
      type: 'page', created: Date.now()
    };
    if (existing >= 0) docs[existing] = doc; else docs.push(doc);
    await saveDocs(docs);
    statusEl().textContent = `Saved “${result.title.slice(0, 40)}${result.title.length > 40 ? '…' : ''}”.`;
    refresh();
  } catch (err) {
    statusEl().textContent = 'Could not read this page.';
  } finally {
    btn.disabled = false;
  }
}

/* ---------- Wire up ---------- */

$('searchInput').addEventListener('input', () => {
  $('clearSearch').classList.toggle('hidden', !$('searchInput').value);
  refresh();
});
$('clearSearch').onclick = () => {
  $('searchInput').value = '';
  $('clearSearch').classList.add('hidden');
  refresh();
};
$('savePageBtn').onclick = saveCurrentPage;
$('addNoteBtn').onclick = () => $('noteForm').classList.toggle('hidden');
$('noteCancel').onclick = () => {
  $('noteForm').classList.add('hidden');
  $('noteTitle').value = ''; $('noteText').value = '';
};
$('noteSave').onclick = async () => {
  const title = $('noteTitle').value.trim();
  const text = $('noteText').value.trim();
  if (!title && !text) { statusEl().textContent = 'Give the note a title or some text first.'; return; }
  const docs = await loadDocs();
  docs.push({ id: uid(), title: title || 'Untitled note', url: '', text: text.slice(0, MAX_TEXT), type: 'note', created: Date.now() });
  await saveDocs(docs);
  $('noteForm').classList.add('hidden');
  $('noteTitle').value = ''; $('noteText').value = '';
  statusEl().textContent = 'Note saved.';
  refresh();
};

refresh();
