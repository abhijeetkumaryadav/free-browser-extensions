/* Interview Theme Grouper — popup logic.
 * Honest scope: ALL tagging is manual. This tool only stores and groups
 * the quotes, themes, and sentiment labels the user assigns. Nothing is
 * detected or analyzed automatically.
 */
'use strict';

/* ---------- constants ---------- */
const STORE = { QUOTES: 'itg_quotes', THEMES: 'itg_themes' };
const STARTER_THEMES = [
  'Pain points', 'Pricing', 'Onboarding', 'Feature requests',
  'Workarounds', 'Trust', 'UX feedback', 'Competitors'
];

/* ---------- state ---------- */
let quotes = [];          // {id, text, speaker, themes:[], sentiment, ts}
let themes = [];          // [name,...]
let selectedThemes = new Set();
let selectedSentiment = 'positive';

/* ---------- storage helpers ---------- */
async function loadState() {
  const res = await chrome.storage.local.get([STORE.QUOTES, STORE.THEMES]);
  quotes = res[STORE.QUOTES] || [];
  themes = res[STORE.THEMES];
  if (!Array.isArray(themes)) {
    themes = [...STARTER_THEMES];
    await chrome.storage.local.set({ [STORE.THEMES]: themes });
  }
}
async function saveQuotes() {
  await chrome.storage.local.set({ [STORE.QUOTES]: quotes });
}
async function saveThemes() {
  await chrome.storage.local.set({ [STORE.THEMES]: themes });
}

/* ---------- dom helpers ---------- */
const $ = (id) => document.getElementById(id);
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------- tabs ---------- */
function initTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.panel').forEach((p) => p.classList.add('hidden'));
      $('tab-' + btn.dataset.tab).classList.remove('hidden');
      if (btn.dataset.tab === 'themes') renderThemesView();
      if (btn.dataset.tab === 'manage') renderManageView();
    });
  });
}

/* ---------- add-quote view ---------- */
function renderChips() {
  const box = $('themeChips');
  box.innerHTML = '';
  themes.forEach((name) => {
    const b = document.createElement('button');
    b.className = 'chip' + (selectedThemes.has(name) ? ' on' : '');
    b.textContent = name;
    b.addEventListener('click', () => {
      if (selectedThemes.has(name)) selectedThemes.delete(name);
      else selectedThemes.add(name);
      renderChips();
    });
    box.appendChild(b);
  });
  if (themes.length === 0) box.innerHTML = '<span class="empty">No themes yet — add one in Manage.</span>';
}

function initAddView() {
  document.querySelectorAll('#sentimentSeg button').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#sentimentSeg button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      selectedSentiment = b.dataset.sent;
    });
  });
  $('saveQuote').addEventListener('click', async () => {
    const text = $('quoteText').value.trim();
    if (!text) { $('quoteText').focus(); return; }
    if (selectedThemes.size === 0) {
      alert('Pick at least one theme for this quote.');
      return;
    }
    quotes.unshift({
      id: 'q' + Date.now(),
      text,
      speaker: $('speaker').value.trim(),
      themes: [...selectedThemes],
      sentiment: selectedSentiment,
      ts: Date.now()
    });
    await saveQuotes();
    $('quoteText').value = '';
    $('speaker').value = '';
    selectedThemes.clear();
    renderChips();
    updateStats();
  });
}

/* ---------- themes view (grouped) ---------- */
function themeCounts() {
  const map = {};
  themes.forEach((t) => { map[t] = { total: 0, positive: 0, neutral: 0, negative: 0 }; });
  quotes.forEach((q) => {
    q.themes.forEach((t) => {
      if (!map[t]) map[t] = { total: 0, positive: 0, neutral: 0, negative: 0 };
      map[t].total++;
      if (map[t][q.sentiment] !== undefined) map[t][q.sentiment]++;
    });
  });
  return map;
}

function renderThemesView() {
  // filter dropdown
  const sel = $('themeFilter');
  const prev = sel.value || 'all';
  sel.innerHTML = '<option value="all">All themes</option>';
  themes.forEach((t) => {
    const o = document.createElement('option');
    o.value = t; o.textContent = t;
    sel.appendChild(o);
  });
  sel.value = [...sel.options].some((o) => o.value === prev) ? prev : 'all';

  // summary chips with counts
  const counts = themeCounts();
  const sum = $('themeSummary');
  sum.innerHTML = '';
  themes.forEach((t) => {
    const c = counts[t];
    const d = document.createElement('div');
    d.className = 'sum-chip';
    d.innerHTML = `<b>${c.total}</b> ${esc(t)}`;
    sum.appendChild(d);
  });
  if (themes.length === 0) sum.innerHTML = '<span class="empty">No themes defined.</span>';

  renderQuoteList();
}

function renderQuoteList() {
  const tf = $('themeFilter').value;
  const sf = $('sentFilter').value;
  const box = $('quoteList');
  box.innerHTML = '';
  const list = quotes.filter((q) =>
    (tf === 'all' || q.themes.includes(tf)) &&
    (sf === 'all' || q.sentiment === sf)
  );
  if (list.length === 0) {
    box.innerHTML = '<div class="empty">No quotes match. Add quotes in the first tab.</div>';
    return;
  }
  list.forEach((q) => {
    const el = document.createElement('div');
    el.className = 'quote';
    el.innerHTML =
      `<div class="q-text">${esc(q.text)}</div>` +
      `<div class="q-meta">` +
        `<span class="q-sent ${q.sentiment}">${q.sentiment}</span>` +
        q.themes.map((t) => `<span class="q-theme">${esc(t)}</span>`).join('') +
        (q.speaker ? `<span class="q-speaker">— ${esc(q.speaker)}</span>` : '') +
        `<button class="q-del" title="Delete quote">×</button>` +
      `</div>`;
    el.querySelector('.q-del').addEventListener('click', async () => {
      quotes = quotes.filter((x) => x.id !== q.id);
      await saveQuotes();
      renderThemesView();
      updateStats();
    });
    box.appendChild(el);
  });
}

/* ---------- manage view ---------- */
function renderManageView() {
  const box = $('themeManager');
  box.innerHTML = '';
  const counts = themeCounts();
  themes.forEach((t) => {
    const row = document.createElement('div');
    row.className = 'manage-row';
    row.innerHTML =
      `<span><span class="m-name">${esc(t)}</span>` +
      `<span class="m-count">${(counts[t] || { total: 0 }).total} quote(s)</span></span>` +
      `<button class="m-del" title="Delete theme">×</button>`;
    row.querySelector('.m-del').addEventListener('click', async () => {
      if (!confirm(`Delete theme "${t}"? Quotes keep their text but lose this tag.`)) return;
      themes = themes.filter((x) => x !== t);
      quotes.forEach((q) => { q.themes = q.themes.filter((x) => x !== t); });
      await saveThemes(); await saveQuotes();
      selectedThemes.delete(t);
      renderChips(); renderManageView(); updateStats();
    });
    box.appendChild(row);
  });
  updateStats();
}

function initManageView() {
  $('addTheme').addEventListener('click', async () => {
    const name = $('newTheme').value.trim();
    if (!name) return;
    if (themes.includes(name)) { alert('That theme already exists.'); return; }
    themes.push(name);
    await saveThemes();
    $('newTheme').value = '';
    renderChips(); renderManageView();
  });
  $('newTheme').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('addTheme').click();
  });
  $('exportCsv').addEventListener('click', () => exportData('csv'));
  $('exportJson').addEventListener('click', () => exportData('json'));
  $('clearAll').addEventListener('click', async () => {
    if (!confirm('Delete ALL quotes and themes? This cannot be undone.')) return;
    quotes = []; themes = [...STARTER_THEMES];
    await chrome.storage.local.set({ [STORE.QUOTES]: quotes, [STORE.THEMES]: themes });
    selectedThemes.clear();
    renderChips(); renderThemesView(); renderManageView(); updateStats();
  });
}

function updateStats() {
  $('statsLine').textContent =
    `${quotes.length} quote(s) · ${themes.length} theme(s) — all labels are yours; nothing is auto-detected.`;
}

/* ---------- export ---------- */
function csvCell(v) {
  const s = String(v == null ? '' : v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}
function download(filename, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function exportData(fmt) {
  if (fmt === 'csv') {
    const rows = [['quote', 'speaker', 'themes', 'sentiment', 'date']];
    quotes.forEach((q) => rows.push([
      q.text, q.speaker, q.themes.join('; '), q.sentiment,
      new Date(q.ts).toISOString().slice(0, 10)
    ]));
    download('interview-quotes.csv', rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv');
  } else {
    download('interview-quotes.json', JSON.stringify({ themes, quotes }, null, 2), 'application/json');
  }
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  initTabs();
  renderChips();
  initAddView();
  initManageView();
  $('themeFilter').addEventListener('change', renderQuoteList);
  $('sentFilter').addEventListener('change', renderQuoteList);
  renderThemesView();
  updateStats();
});
