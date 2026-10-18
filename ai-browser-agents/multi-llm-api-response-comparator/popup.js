/* PromptBench — manual multi-LLM response comparator.
   All analysis is local: tokenization, unique-word detection, Jaccard similarity.
   No API keys, no network calls — the user pastes everything by hand. */
'use strict';

const MAX_PANELS = 4;
const PANEL_COLORS = ['#10b981', '#38bdf8', '#f59e0b', '#f472b6'];
const DEFAULT_LABELS = ['Model A', 'Model B', 'Model C', 'Model D'];
// Small stopword list so "unique words" are meaningful content words.
const STOPWORDS = new Set(('a,an,the,and,or,but,if,then,else,when,at,by,for,with,about,into,through,during,of,to,in,on,is,are,was,were,be,been,being,have,has,had,do,does,did,will,would,should,can,could,may,might,must,shall,it,its,this,that,these,those,i,you,he,she,we,they,them,his,her,their,our,your,as,from,not,no,so,than,too,very,just,also,only,there,here,what,which,who,whom,how,why,where,all,any,both,each,few,more,most,other,some,such,own,same').split(','));

const state = {
  panels: [],          // {id, label, text, notes}
  analysis: null,      // {uniqueSets: {id: Set}, sims: [{a,b,score}]}
  nextId: 1,
};

const $ = (sel) => document.querySelector(sel);
const panelsEl = $('#panels');

/* ---------- helpers ---------- */
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Tokenize into meaningful content words (lowercased, len>=4, no stopwords).
function tokenize(text) {
  const words = (text.toLowerCase().match(/[a-z0-9'-]+/g) || []);
  return words.filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function wordCount(text) {
  const w = text.trim().split(/\s+/).filter(Boolean);
  return text.trim() ? w.length : 0;
}

function jaccard(setA, setB) {
  if (!setA.size && !setB.size) return 1;
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter++;
  return inter / (setA.size + setB.size - inter);
}

/* ---------- panel rendering ---------- */
function renderPanels() {
  panelsEl.innerHTML = '';
  state.panels.forEach((p, idx) => {
    const color = PANEL_COLORS[idx % PANEL_COLORS.length];
    const div = document.createElement('div');
    div.className = 'panel';
    div.dataset.id = p.id;

    // Highlighted read-only view (shown after analysis when toggle is on)
    const showHl = state.analysis && $('#highlightToggle').checked &&
      state.analysis.uniqueSets[p.id] && state.analysis.uniqueSets[p.id].size > 0;
    const bodyHtml = showHl
      ? `<div class="hl-view">${highlightUnique(p.text, state.analysis.uniqueSets[p.id])}</div>`
      : `<textarea rows="3" placeholder="Paste this model's response here…">${escapeHtml(p.text)}</textarea>`;

    div.innerHTML = `
      <div class="panel-head">
        <span class="panel-dot" style="background:${color}"></span>
        <input type="text" class="label-input" value="${escapeHtml(p.label)}" maxlength="32" aria-label="Model label">
        <button class="icon-btn remove-btn" title="Remove panel" ${state.panels.length <= 2 ? 'disabled style="opacity:.3"' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
      ${bodyHtml}
      <div class="panel-foot">
        <span class="word-count"><b>${wordCount(p.text)}</b> words</span>
        <input type="text" class="notes" placeholder="Notes (strengths, issues…)" value="${escapeHtml(p.notes)}" maxlength="140">
      </div>`;

    // Wire events
    const ta = div.querySelector('textarea');
    if (ta) ta.addEventListener('input', (e) => {
      p.text = e.target.value;
      div.querySelector('.word-count b').textContent = wordCount(p.text);
    });
    div.querySelector('.label-input').addEventListener('input', (e) => { p.label = e.target.value; });
    div.querySelector('.notes').addEventListener('input', (e) => { p.notes = e.target.value; });
    div.querySelector('.remove-btn').addEventListener('click', () => removePanel(p.id));

    panelsEl.appendChild(div);
  });
  $('#addPanel').disabled = state.panels.length >= MAX_PANELS;
}

// Wrap unique words in <mark>, preserving original casing.
function highlightUnique(text, uniqueSet) {
  return escapeHtml(text).replace(/[a-zA-Z0-9'-]+/g, (m) => {
    const key = m.toLowerCase();
    return (key.length >= 4 && !STOPWORDS.has(key) && uniqueSet.has(key)) ? `<mark>${m}</mark>` : m;
  });
}

function addPanel() {
  if (state.panels.length >= MAX_PANELS) return;
  state.panels.push({ id: state.nextId++, label: DEFAULT_LABELS[state.panels.length] || `Model ${state.nextId}`, text: '', notes: '' });
  state.analysis = null;
  renderPanels();
}

function removePanel(id) {
  if (state.panels.length <= 2) return;
  state.panels = state.panels.filter((p) => p.id !== id);
  state.analysis = null;
  renderPanels();
}

/* ---------- analysis ---------- */
function analyze() {
  const filled = state.panels.filter((p) => p.text.trim());
  if (filled.length < 2) {
    $('#results').classList.add('hidden');
    $('#exportBtn').classList.add('hidden');
    return;
  }
  const tokenSets = {};
  filled.forEach((p) => { tokenSets[p.id] = new Set(tokenize(p.text)); });

  // Unique words per panel: in this panel but in no other panel.
  const uniqueSets = {};
  filled.forEach((p) => {
    const others = new Set();
    filled.forEach((q) => { if (q.id !== p.id) tokenSets[q.id].forEach((w) => others.add(w)); });
    uniqueSets[p.id] = new Set([...tokenSets[p.id]].filter((w) => !others.has(w)));
  });

  // Pairwise Jaccard similarity.
  const sims = [];
  for (let i = 0; i < filled.length; i++) {
    for (let j = i + 1; j < filled.length; j++) {
      sims.push({ a: filled[i], b: filled[j], score: jaccard(tokenSets[filled[i].id], tokenSets[filled[j].id]) });
    }
  }
  sims.sort((x, y) => y.score - x.score);

  state.analysis = { uniqueSets, sims, panels: filled.map((p) => p.id) };
  renderResults(filled);
  renderPanels(); // re-render to show highlight views
  $('#results').classList.remove('hidden');
  $('#exportBtn').classList.remove('hidden');
  $('#results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderResults(filled) {
  const grid = $('#statsGrid');
  grid.innerHTML = '';
  filled.forEach((p, idx) => {
    const color = PANEL_COLORS[state.panels.indexOf(p) % PANEL_COLORS.length];
    const uniq = state.analysis.uniqueSets[p.id].size;
    const wc = wordCount(p.text);
    const div = document.createElement('div');
    div.className = 'stat';
    div.innerHTML = `
      <div class="s-label"><span class="panel-dot" style="background:${color}"></span>${escapeHtml(p.label) || 'Untitled'}</div>
      <div class="s-row"><span>Words</span><b>${wc}</b></div>
      <div class="s-row"><span>Unique words</span><b>${uniq}</b></div>
      <div class="s-row"><span>Chars</span><b>${p.text.length}</b></div>`;
    grid.appendChild(div);
  });

  const mx = $('#simMatrix');
  mx.innerHTML = '';
  state.analysis.sims.forEach((s) => {
    const pct = Math.round(s.score * 100);
    const row = document.createElement('div');
    row.className = 'sim-row';
    row.innerHTML = `
      <span class="names">${escapeHtml(s.a.label)} ↔ ${escapeHtml(s.b.label)}</span>
      <span class="sim-bar"><i style="width:${pct}%"></i></span>
      <span class="pct">${pct}%</span>`;
    mx.appendChild(row);
  });
}

/* ---------- persistence ---------- */
async function getSaved() {
  const { comparisons = [] } = await chrome.storage.local.get('comparisons');
  return comparisons;
}

async function saveComparison() {
  const name = $('#saveName').value.trim();
  if (!name) { $('#saveName').focus(); return; }
  const list = await getSaved();
  list.unshift({
    name,
    date: new Date().toISOString(),
    prompt: $('#prompt').value,
    panels: state.panels.map((p) => ({ label: p.label, text: p.text, notes: p.notes })),
  });
  await chrome.storage.local.set({ comparisons: list.slice(0, 50) });
  $('#saveName').value = '';
  renderSaved();
}

async function renderSaved() {
  const list = await getSaved();
  const el = $('#savedList');
  el.innerHTML = '';
  if (!list.length) {
    el.innerHTML = '<div class="empty">No saved comparisons yet.</div>';
    return;
  }
  list.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'saved-item';
    const date = new Date(c.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    d.innerHTML = `
      <span class="nm">${escapeHtml(c.name)}</span>
      <span class="dt">${date} · ${c.panels.length} models</span>
      <button class="icon-btn load-btn" title="Load">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
      </button>
      <button class="icon-btn del-btn" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>`;
    d.querySelector('.load-btn').addEventListener('click', () => loadComparison(c));
    d.querySelector('.del-btn').addEventListener('click', async () => {
      const l = await getSaved();
      l.splice(i, 1);
      await chrome.storage.local.set({ comparisons: l });
      renderSaved();
    });
    el.appendChild(d);
  });
}

function loadComparison(c) {
  $('#prompt').value = c.prompt || '';
  state.panels = c.panels.map((p) => ({ id: state.nextId++, label: p.label, text: p.text, notes: p.notes || '' }));
  state.analysis = null;
  $('#results').classList.add('hidden');
  $('#exportBtn').classList.add('hidden');
  renderPanels();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- markdown export ---------- */
function exportMarkdown() {
  const lines = [`# ${'PromptBench comparison'}`, '', `**Prompt:** ${$('#prompt').value.trim() || '—'}`, ''];
  state.panels.forEach((p) => {
    lines.push(`## ${p.label || 'Untitled'} (${wordCount(p.text)} words)`, '', p.text.trim() || '—', '');
    if (p.notes.trim()) { lines.push(`> Notes: ${p.notes.trim()}`, ''); }
  });
  if (state.analysis) {
    lines.push('## Similarity', '');
    state.analysis.sims.forEach((s) => {
      lines.push(`- ${s.a.label} ↔ ${s.b.label}: ${Math.round(s.score * 100)}%`);
    });
    lines.push('');
  }
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const b = $('#exportBtn');
    const orig = b.innerHTML;
    b.innerHTML = 'Copied to clipboard ✓';
    setTimeout(() => { b.innerHTML = orig; }, 1500);
  });
}

/* ---------- init ---------- */
$('#addPanel').addEventListener('click', addPanel);
$('#analyze').addEventListener('click', analyze);
$('#saveBtn').addEventListener('click', saveComparison);
$('#saveName').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveComparison(); });
$('#exportBtn').addEventListener('click', exportMarkdown);
$('#highlightToggle').addEventListener('change', renderPanels);

addPanel();
addPanel();
renderSaved();
