// Island Map — popup logic (fully local, zero network)
// Engine (pure, headless-testable) lives between ENGINE-START / ENGINE-END.

'use strict';

// ENGINE-START

/** Deterministic string hash for stable island placement. */
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Build a link entry. Returns null when invalid.
 * link: { id, title, url, group, createdAt }
 */
function makeLink(title, url, group) {
  const t = String(title || '').trim();
  const u = String(url || '').trim();
  if (!t || t.length > 80) return null;
  if (!/^https?:\/\//i.test(u) || u.length > 300) return null;
  const g = String(group || '').trim().slice(0, 40) || 'ungrouped';
  return {
    id: 'l' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    title: t,
    url: u,
    group: g,
    createdAt: Date.now()
  };
}

/** Case-insensitive filter across title/url/group. Empty query returns all. */
function filterLinks(links, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return links.slice();
  return links.filter(l =>
    l.title.toLowerCase().includes(q) ||
    l.url.toLowerCase().includes(q) ||
    l.group.toLowerCase().includes(q));
}

/**
 * Deterministic island layout for links on a W×H canvas.
 * Groups become clusters on a ring; islands fan out within their cluster.
 * Returns [{ id, x, y, r, group }]. Pure and deterministic.
 */
function islandLayout(links, W, H) {
  const out = [];
  if (!links.length) return out;
  const groups = [];
  for (const l of links) if (!groups.includes(l.group)) groups.push(l.group);
  const cx = W / 2, cy = H / 2, ring = Math.min(W, H) * 0.30;
  groups.forEach((g, gi) => {
    const members = links.filter(l => l.group === g);
    const ang = groups.length === 1 ? -Math.PI / 2 : (gi / groups.length) * Math.PI * 2 - Math.PI / 2;
    const gx = cx + ring * Math.cos(ang);
    const gy = cy + ring * 0.8 * Math.sin(ang);
    members.forEach((l, mi) => {
      const h = hashStr(l.id);
      const ma = (h % 628) / 100;                 // pseudo-angle from id hash
      const mr = 8 + (h % 26);                     // cluster radius offset
      out.push({
        id: l.id,
        x: Math.min(Math.max(gx + mr * Math.cos(ma), 26), W - 26),
        y: Math.min(Math.max(gy + mr * Math.sin(ma), 26), H - 26),
        r: 15 + (h % 8),
        group: g
      });
    });
  });
  return out;
}

/**
 * Bridge pairs: connect islands of the same group in layout order.
 * Returns [{ ax, ay, bx, by }]. Pure.
 */
function bridgePairs(layout) {
  const byGroup = {};
  for (const isl of layout) (byGroup[isl.group] = byGroup[isl.group] || []).push(isl);
  const bridges = [];
  for (const g of Object.keys(byGroup)) {
    const arr = byGroup[g];
    for (let i = 1; i < arr.length; i++) {
      bridges.push({ ax: arr[i - 1].x, ay: arr[i - 1].y, bx: arr[i].x, by: arr[i].y });
    }
  }
  return bridges;
}

/** Hit-test: island whose radius contains (x, y), or null. */
function islandAt(layout, x, y) {
  for (let i = layout.length - 1; i >= 0; i--) {
    const isl = layout[i];
    const dx = x - isl.x, dy = y - isl.y;
    if (dx * dx + dy * dy <= isl.r * isl.r) return isl;
  }
  return null;
}

/** Host of a URL for display. Returns '' on failure. */
function hostOf(url) {
  try { return new URL(url).host; } catch { return ''; }
}

/** Escape HTML. */
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ENGINE-END

const ACCENT = '#a78bfa';
const STORE_KEY = 'islandMapLinks';
const $ = id => document.getElementById(id);
let links = [];
let layout = [];

async function load() {
  try {
    const r = await chrome.storage.local.get(STORE_KEY);
    links = Array.isArray(r[STORE_KEY]) ? r[STORE_KEY] : [];
  } catch { links = []; }
}
async function save() {
  try { await chrome.storage.local.set({ [STORE_KEY]: links }); } catch {}
}

function visibleLinks() {
  const q = $('search').value;
  const g = $('groupFilter').value;
  return filterLinks(links, q).filter(l => !g || l.group === g);
}

function refreshGroups() {
  const sel = $('groupFilter');
  const cur = sel.value;
  const groups = [...new Set(links.map(l => l.group))].sort();
  sel.innerHTML = '<option value="">All groups</option>' +
    groups.map(g => `<option value="${escHtml(g)}">${escHtml(g)}</option>`).join('');
  sel.value = groups.includes(cur) ? cur : '';
}

function renderList() {
  const list = $('list');
  const rows = visibleLinks();
  list.innerHTML = '';
  if (!rows.length) {
    list.innerHTML = '<li class="empty">No islands yet — add your first link above.</li>';
    return;
  }
  for (const l of rows) {
    const li = document.createElement('li');
    li.innerHTML =
      `<div class="info"><div class="title"><a href="${escHtml(l.url)}" target="_blank" rel="noopener">${escHtml(l.title)}</a></div>` +
      `<div class="grp">${escHtml(l.group)} · ${escHtml(hostOf(l.url))}</div></div>` +
      `<button class="del" data-id="${escHtml(l.id)}">Delete</button>`;
    list.appendChild(li);
  }
  list.querySelectorAll('.del').forEach(b => b.addEventListener('click', async () => {
    links = links.filter(x => x.id !== b.dataset.id);
    await save();
    refreshGroups();
    renderList();
    drawMap();
  }));
}

function drawMap() {
  const canvas = $('map');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Ocean gradient.
  const sea = ctx.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, '#0a0a14');
  sea.addColorStop(1, '#101828');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, W, H);

  // Decorative waves.
  ctx.strokeStyle = 'rgba(167,139,250,0.08)';
  ctx.lineWidth = 1;
  for (let r = 0; r < 4; r++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = H * 0.15 + r * 28 + Math.sin(x / 40 + r) * 4;
      r || x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  layout = islandLayout(visibleLinks(), W, H);
  if (!layout.length) {
    ctx.fillStyle = '#9aa0ae';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Add your first link to grow an island.', W / 2, H / 2);
    return;
  }

  // Bridges (same group).
  ctx.strokeStyle = 'rgba(167,139,250,0.45)';
  ctx.lineWidth = 2;
  for (const b of bridgePairs(layout)) {
    ctx.beginPath();
    ctx.moveTo(b.ax, b.ay);
    ctx.quadraticCurveTo((b.ax + b.bx) / 2, (b.ay + b.by) / 2 - 8, b.bx, b.by);
    ctx.stroke();
  }

  // Islands.
  for (const isl of layout) {
    ctx.beginPath();
    ctx.arc(isl.x, isl.y, isl.r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(isl.x - 4, isl.y - 4, 2, isl.x, isl.y, isl.r);
    g.addColorStop(0, '#3b3560');
    g.addColorStop(1, '#1c1830');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Palm-tree-ish marker dot.
    ctx.beginPath();
    ctx.arc(isl.x, isl.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = ACCENT;
    ctx.fill();
  }
}

$('map').addEventListener('click', ev => {
  const rect = $('map').getBoundingClientRect();
  const x = (ev.clientX - rect.left) * ($('map').width / rect.width);
  const y = (ev.clientY - rect.top) * ($('map').height / rect.height);
  const hit = islandAt(layout, x, y);
  if (!hit) return;
  const link = links.find(l => l.id === hit.id);
  if (link) window.open(link.url, '_blank', 'noopener');
});

$('addForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  const l = makeLink($('fTitle').value, $('fUrl').value, $('fGroup').value);
  if (!l) { alert('Please add a title and an http(s) URL.'); return; }
  links.push(l);
  if (links.length > 500) links = links.slice(-500);
  await save();
  ev.target.reset();
  refreshGroups();
  renderList();
  drawMap();
});
$('search').addEventListener('input', () => { renderList(); drawMap(); });
$('groupFilter').addEventListener('change', () => { renderList(); drawMap(); });
$('clearAll').addEventListener('click', async () => {
  if (!links.length || !confirm('Delete all islands?')) return;
  links = [];
  await save();
  refreshGroups();
  renderList();
  drawMap();
});

(async function init() {
  await load();
  refreshGroups();
  renderList();
  drawMap();
})();
