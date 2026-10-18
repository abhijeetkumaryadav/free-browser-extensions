// Journey Terrain — popup logic (fully local, zero network)
// Engine (pure, headless-testable) lives between ENGINE-START / ENGINE-END.

'use strict';

// ENGINE-START

/** Simple deterministic string hash for terrain pseudo-randomness. */
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Build a journal entry. Returns null when input is invalid.
 * entry: { id, site, url, note, date, createdAt }
 */
function makeEntry(site, url, note, date) {
  const s = String(site || '').trim();
  if (!s) return null;
  if (s.length > 80) return null;
  let u = String(url || '').trim();
  if (u && !/^https?:\/\//i.test(u)) return null;
  if (u.length > 300) return null;
  const n = String(note || '').trim().slice(0, 140);
  let d = String(date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    d = new Date().toISOString().slice(0, 10);
  }
  return {
    id: 'e' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    site: s,
    url: u,
    note: n,
    date: d,
    createdAt: Date.now()
  };
}

/** Oldest-first so the trail reads in visit order. Returns a new array. */
function sortEntries(entries) {
  return entries.slice().sort((a, b) =>
    (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || a.createdAt - b.createdAt);
}

/** Case-insensitive filter across site + note + url. Empty query returns all. */
function filterEntries(entries, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return entries.slice();
  return entries.filter(e =>
    e.site.toLowerCase().includes(q) ||
    (e.note || '').toLowerCase().includes(q) ||
    (e.url || '').toLowerCase().includes(q));
}

/**
 * Compute the trail across the terrain for a list of entries (oldest first).
 * Returns { points: [{x, y, label}], peaks: [{x, y, h}] } in canvas pixels
 * for a canvas of width W and height H. Pure and deterministic.
 */
function terrainTrail(entries, W, H) {
  const n = entries.length;
  // Terrain: a few deterministic "peaks" drawn as isometric ridges.
  const peaks = [];
  for (let i = 0; i < 5; i++) {
    const hx = hashString('peak' + i);
    peaks.push({
      x: W * (0.08 + 0.84 * ((hx % 1000) / 1000)),
      y: H * (0.25 + 0.45 * (((hx >> 10) % 1000) / 1000)),
      h: 18 + ((hx >> 20) % 30)
    });
  }
  const points = [];
  if (n === 0) return { points, peaks };
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    // Trail snakes left->right with a gentle sine wave across the middle band.
    const x = W * (0.08 + 0.84 * t);
    const wave = Math.sin(t * Math.PI * 2 + 0.6) * H * 0.10;
    const y = H * 0.62 + wave - i * 0; // deterministic; no dependence on entry content
    points.push({ x, y, label: entries[i].site });
  }
  return { points, peaks };
}

/** "2026-10-17" -> "17 Oct 2026". Returns input unchanged if malformed. */
function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return String(iso);
  return Number(m[3]) + ' ' + months[mo - 1] + ' ' + m[1];
}

/** Escape HTML for safe rendering. */
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ENGINE-END

const ACCENT = '#2dd4bf';
const STORE_KEY = 'journeyTerrainEntries';

const $ = id => document.getElementById(id);
let entries = [];

/* ---------- storage ---------- */
async function load() {
  try {
    const r = await chrome.storage.local.get(STORE_KEY);
    entries = Array.isArray(r[STORE_KEY]) ? r[STORE_KEY] : [];
  } catch { entries = []; }
}
async function save() {
  try { await chrome.storage.local.set({ [STORE_KEY]: entries }); } catch {}
}

/* ---------- list ---------- */
function renderList() {
  const list = $('list');
  const rows = filterEntries(entries, $('search').value).reverse(); // newest first in list
  list.innerHTML = '';
  if (!rows.length) {
    list.innerHTML = '<li class="empty">No entries yet — add your first stop above.</li>';
    return;
  }
  for (const e of rows) {
    const li = document.createElement('li');
    const siteHtml = e.url
      ? `<a href="${escHtml(e.url)}" target="_blank" rel="noopener">${escHtml(e.site)}</a>`
      : escHtml(e.site);
    li.innerHTML =
      `<div class="site">${siteHtml}</div>` +
      `<div class="meta">${escHtml(fmtDate(e.date))}</div>` +
      (e.note ? `<div class="note">${escHtml(e.note)}</div>` : '') +
      `<button class="del" data-id="${escHtml(e.id)}">Delete</button>`;
    list.appendChild(li);
  }
  list.querySelectorAll('.del').forEach(b => b.addEventListener('click', async () => {
    entries = entries.filter(x => x.id !== b.dataset.id);
    await save();
    renderList();
    drawTerrain();
  }));
}

/* ---------- terrain canvas ---------- */
function drawTerrain() {
  const canvas = $('terrain');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Night sky gradient.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0b0b10');
  sky.addColorStop(1, '#101820');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Stars.
  for (let i = 0; i < 60; i++) {
    const h = hashString('star' + i);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.15 + (h % 50) / 140) + ')';
    ctx.fillRect((h % (W - 4)) + 2, (h >> 8) % 70, 1.5, 1.5);
  }

  const ordered = sortEntries(entries);
  const trail = terrainTrail(ordered, W, H);

  // Terrain ridges (isometric-ish triangles).
  for (const p of trail.peaks) {
    ctx.beginPath();
    ctx.moveTo(p.x - 46, p.y + 26);
    ctx.lineTo(p.x, p.y - p.h);
    ctx.lineTo(p.x + 46, p.y + 26);
    ctx.closePath();
    ctx.fillStyle = 'rgba(45,212,191,0.10)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(45,212,191,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Ground band.
  ctx.fillStyle = 'rgba(45,212,191,0.06)';
  ctx.fillRect(0, H * 0.78, W, H * 0.22);

  if (!ordered.length) {
    ctx.fillStyle = '#9aa0ae';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Add your first stop to draw a trail.', W / 2, H / 2);
    return;
  }

  // Trail path.
  ctx.beginPath();
  trail.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = ACCENT;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Waypoint dots.
  trail.points.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = i === trail.points.length - 1 ? '#fff' : ACCENT;
    ctx.fill();
    ctx.fillStyle = '#0b0b10';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Label of the latest stop.
  const last = trail.points[trail.points.length - 1];
  ctx.fillStyle = '#f1f2f6';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  const label = last.label.length > 26 ? last.label.slice(0, 25) + '…' : last.label;
  ctx.fillText(label, Math.min(Math.max(last.x, 60), W - 60), Math.max(last.y - 14, 14));
}

/* ---------- export ---------- */
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function entriesMarkdown() {
  const lines = ['# Browsing Journey', ''];
  for (const e of sortEntries(entries)) {
    lines.push(`- **${e.site}** — ${e.date}`);
    if (e.url) lines.push(`  ${e.url}`);
    if (e.note) lines.push(`  _${e.note}_`);
  }
  return lines.join('\n') + '\n';
}

/* ---------- wiring ---------- */
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  $('tab-' + t.dataset.tab).classList.add('active');
  if (t.dataset.tab === 'terrain') drawTerrain();
}));

$('addForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  const e = makeEntry($('fSite').value, $('fUrl').value, $('fNote').value, $('fDate').value);
  if (!e) { alert('Please add a site name (and use http(s) URLs only).'); return; }
  entries.push(e);
  if (entries.length > 500) entries = entries.slice(-500);
  await save();
  ev.target.reset();
  renderList();
  drawTerrain();
});
$('search').addEventListener('input', renderList);
$('clearAll').addEventListener('click', async () => {
  if (!entries.length || !confirm('Delete all journal entries?')) return;
  entries = [];
  await save();
  renderList();
  drawTerrain();
});
$('exportJson').addEventListener('click', () =>
  download('journey-terrain.json', JSON.stringify(entries, null, 2), 'application/json'));
$('exportMd').addEventListener('click', () =>
  download('journey-terrain.md', entriesMarkdown(), 'text/markdown'));

(async function init() {
  $('fDate').value = new Date().toISOString().slice(0, 10);
  await load();
  renderList();
  drawTerrain();
})();
