/* Linkrot Estimator — heuristic decay signals, no live checking. Zero network. */
// ENGINE-START
// Pure engine — safe to unit-test headless.

const MAX_LINKS = 500;

// Heuristic host types that historically rot faster.
const RISKY_HOST_RE = /(blogspot\.|wordpress\.com|weebly\.com|wixsite\.com|github\.io|glitch\.me|herokuapp\.com|netlify\.app|pages\.dev|tripod\.|geocities)/i;

// Build a link entry. Returns {ok, entry} or {ok:false, error}.
function makeLink({ title, url, good, notes }) {
  title = (title || '').trim();
  if (!title) return { ok: false, error: 'title-required' };
  if (title.length > 150) return { ok: false, error: 'title-too-long' };
  url = (url || '').trim();
  if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url)) return { ok: false, error: 'bad-url' };
  if (url.length > 500) return { ok: false, error: 'url-too-long' };
  notes = (notes || '').trim();
  if (notes.length > 500) return { ok: false, error: 'notes-too-long' };
  let goodDate = null;
  if (good) {
    const d = new Date(good + 'T00:00:00');
    if (isNaN(d.getTime())) return { ok: false, error: 'bad-date' };
    goodDate = good;
  }
  return {
    ok: true,
    entry: {
      id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      title, url, good: goodDate, notes,
      created: new Date().toISOString(),
    },
  };
}

// Host of a URL, lowercased.
function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

// Path depth (segments after the host, excluding query).
function pathDepth(url) {
  try {
    const p = new URL(url).pathname.split('/').filter(Boolean);
    return p.length;
  } catch { return 0; }
}

// Years (fractional) since a YYYY-MM-DD date; null if none.
function yearsSince(dateStr) {
  if (!dateStr) return null;
  const t = new Date(dateStr + 'T00:00:00').getTime();
  if (isNaN(t)) return null;
  return Math.max(0, (Date.now() - t) / (365.25 * 86400000));
}

// Heuristic decay score 0–100 with per-signal breakdown.
// NOTE: heuristic only — counts patterns, checks nothing live.
function decayScore({ url, good }) {
  const signals = [];
  let score = 0;

  const yrs = yearsSince(good);
  let agePts = 0;
  if (yrs === null) {
    agePts = 15; // unknown history is mildly risky
    signals.push({ name: 'No last-known-good date', pts: agePts, note: 'Unknown history — counted as mildly risky.' });
  } else {
    agePts = Math.min(60, Math.round(yrs * 12)); // ~12 pts/year, capped
    signals.push({ name: 'Age', pts: agePts, note: yrs < 1 ? 'Fresh (under a year).' : yrs.toFixed(1) + ' years since last known good.' });
  }
  score += agePts;

  const depth = pathDepth(url);
  const depthPts = depth >= 4 ? 15 : depth >= 2 ? 8 : 0;
  if (depthPts) signals.push({ name: 'Deep path', pts: depthPts, note: depth + ' path segments — deep pages rot faster.' });
  score += depthPts;

  const host = hostOf(url);
  if (RISKY_HOST_RE.test(host)) {
    score += 10;
    signals.push({ name: 'Host type', pts: 10, note: 'Free/personal hosting has historically higher churn.' });
  }

  score = Math.max(0, Math.min(100, score));
  return { score, signals, ageYears: yrs, depth, host };
}

// Verdict bucket for a score.
function verdictFor(score) {
  if (score < 25) return { label: 'Low risk signals', color: '#34d399' };
  if (score < 50) return { label: 'Moderate risk signals', color: '#fbbf24' };
  if (score < 75) return { label: 'High risk signals', color: '#fb923c' };
  return { label: 'Very high risk signals', color: '#f87171' };
}

// Newest-first sort; does not mutate.
function sortLinks(list) {
  return [...list].sort((a, b) => (b.created || '').localeCompare(a.created || ''));
}

// Case-insensitive search across title, url, notes.
function filterLinks(list, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [...list];
  return list.filter(l =>
    (l.title || '').toLowerCase().includes(q) ||
    (l.url || '').toLowerCase().includes(q) ||
    (l.notes || '').toLowerCase().includes(q));
}

// Validate an import payload. Returns {ok, list} or {ok:false, error}.
function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'bad-json' }; }
  if (!Array.isArray(data)) return { ok: false, error: 'not-array' };
  const list = [];
  for (const item of data.slice(0, MAX_LINKS)) {
    const r = makeLink({ title: item.title, url: item.url, good: item.good, notes: item.notes });
    if (r.ok) list.push(r.entry);
  }
  return { ok: true, list };
}

// Escape for HTML insertion.
function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// ENGINE-END

/* ---------------- Popup UI (browser only) ---------------- */

const $ = (id) => document.getElementById(id);
let links = [];

async function load() {
  const { links: saved } = await chrome.storage.local.get({ links: [] });
  links = Array.isArray(saved) ? saved : [];
  render();
}

function save() {
  return chrome.storage.local.set({ links });
}

function ringSvg(score, color) {
  const r = 18, c = 2 * Math.PI * r, off = c * (1 - score / 100);
  return `<svg class="ring" viewBox="0 0 44 44">
    <circle cx="22" cy="22" r="${r}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="5"/>
    <circle cx="22" cy="22" r="${r}" fill="none" stroke="${color}" stroke-width="5"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
      stroke-linecap="round" transform="rotate(-90 22 22)"/>
    <text x="22" y="26" text-anchor="middle" class="pct">${score}</text>
  </svg>`;
}

function render() {
  const q = $('search').value;
  const list = sortLinks(filterLinks(links, q));
  $('count').textContent = links.length;
  $('empty').style.display = links.length ? 'none' : '';
  const ul = $('link-list');
  ul.innerHTML = '';
  for (const l of list) {
    const { score, ageYears } = decayScore(l);
    const v = verdictFor(score);
    const li = document.createElement('li');
    li.className = 'link';
    li.innerHTML = `
      <div class="top">
        <span class="title">${escHtml(l.title)}</span>
        ${ringSvg(score, v.color)}
      </div>
      <div class="url">${escHtml(l.url)}</div>
      <div class="meta">${l.good ? 'Last known good: ' + escHtml(l.good) : 'Last known good: unknown'}</div>
      <div class="verdict" style="color:${v.color}">${escHtml(v.label)}</div>
      ${l.notes ? `<div class="notes">${escHtml(l.notes)}</div>` : ''}
      <div class="actions">
        <button type="button" data-del="${l.id}">Delete</button>
      </div>`;
    ul.appendChild(li);
  }
  ul.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', () => {
      links = links.filter(l => l.id !== btn.dataset.del);
      save().then(render);
    }));
}

function wire() {
  $('add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const r = makeLink({
      title: $('l-title').value,
      url: $('l-url').value,
      good: $('l-good').value,
      notes: $('l-notes').value,
    });
    if (!r.ok) { alert('Could not save: ' + r.error); return; }
    if (links.length >= MAX_LINKS) { alert('Link list is full (500).'); return; }
    links.push(r.entry);
    e.target.reset();
    save().then(render);
  });
  $('search').addEventListener('input', render);
  $('export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(links, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'linkrot-estimator.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  $('import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      const r = parseImport(String(rd.result || ''));
      if (!r.ok) { alert('Import failed: ' + r.error); return; }
      links = sortLinks([...links, ...r.list]).slice(0, MAX_LINKS);
      save().then(render);
    };
    rd.readAsText(file);
    e.target.value = '';
  });
  $('clear').addEventListener('click', () => {
    if (!links.length || !confirm('Delete all saved links?')) return;
    links = [];
    save().then(render);
  });
}

if (typeof chrome !== 'undefined' && chrome.storage) {
  document.addEventListener('DOMContentLoaded', () => { wire(); load(); });
}
