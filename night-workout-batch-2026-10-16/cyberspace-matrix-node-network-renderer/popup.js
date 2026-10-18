// ============================================================================
// Matrix Node Network — engine + UI
// Cosmetic visualizer: bookmarks as nodes over a matrix-rain canvas.
// ============================================================================

// ENGINE-START
'use strict';

/** Deterministic PRNG (LCG). Same seed -> same sequence. */
function seededRandom(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Flatten a chrome.bookmarks tree into [{id,title,url}]. Skips folders & non-http(s). */
function flattenBookmarks(nodes, out) {
  out = out || [];
  for (const n of nodes || []) {
    if (n.url && /^https?:\/\//i.test(n.url)) {
      out.push({ id: String(n.id), title: n.title || n.url, url: n.url });
    }
    if (n.children) flattenBookmarks(n.children, out);
  }
  return out;
}

const GROUP_COLORS = ['#00ff88', '#22d3ee', '#f59e0b', '#f472b6', '#a78bfa', '#f87171'];

/** Create a group record. Returns null when the name is blank. */
function makeGroup(name, existing) {
  const clean = String(name || '').trim().slice(0, 40);
  if (!clean) return null;
  const used = new Set((existing || []).map(g => g.color));
  const color = GROUP_COLORS.find(c => !used.has(c)) || GROUP_COLORS[(existing || []).length % GROUP_COLORS.length];
  return {
    id: 'g' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36),
    name: clean,
    color
  };
}

/** Deterministic circle layout with seeded jitter. All points stay inside the canvas. */
function nodeLayout(nodes, w, h, seed) {
  const rand = seededRandom(seed);
  const n = nodes.length;
  const cx = w / 2, cy = h / 2;
  const r = Math.max(20, Math.min(w, h) / 2 - 46);
  return nodes.map((node, i) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    const jx = (rand() - 0.5) * 36;
    const jy = (rand() - 0.5) * 36;
    return Object.assign({}, node, {
      x: Math.min(w - 16, Math.max(16, cx + Math.cos(a) * r + jx)),
      y: Math.min(h - 16, Math.max(16, cy + Math.sin(a) * r + jy)),
      r: 12
    });
  });
}

/** Hit-test a click against laid-out nodes (front-most first). Returns node or null. */
function hitNode(laidOut, x, y) {
  for (let i = laidOut.length - 1; i >= 0; i--) {
    const nd = laidOut[i];
    const dx = x - nd.x, dy = y - nd.y;
    if (dx * dx + dy * dy <= nd.r * nd.r) return nd;
  }
  return null;
}

/** Build edges between consecutive laid-out nodes that share a group id. */
function groupEdges(laidOut, assignments) {
  const byGroup = {};
  for (const nd of laidOut) {
    const g = assignments[nd.id];
    if (!g) continue;
    (byGroup[g] = byGroup[g] || []).push(nd);
  }
  const edges = [];
  for (const g of Object.keys(byGroup)) {
    const arr = byGroup[g];
    for (let i = 1; i < arr.length; i++) edges.push({ a: arr[i - 1], b: arr[i], group: g });
  }
  return edges;
}

/** Number of rain columns for a canvas width at a given font size. */
function rainColumnCount(width, fontSize) {
  return Math.max(1, Math.floor(width / fontSize));
}
// ENGINE-END

/* ---------------------------------------------------------------------------
   UI layer (DOM + chrome APIs). Not part of the headless engine.
--------------------------------------------------------------------------- */
const KATAKANA = 'アカサタナハマヤラワ0123456789$#@%&';
const MAX_NODES = 16;
const STORE_KEY = 'cmnn_state_v1';

const stage = document.getElementById('stage');
const ctx = stage.getContext('2d');
const hintEl = document.getElementById('nodeHint');
const groupListEl = document.getElementById('groupList');
const bookmarkListEl = document.getElementById('bookmarkList');

let bookmarks = [];        // flat bookmark records (max 16 shown)
let laidOut = [];          // nodes with x/y
let groups = [];           // group records
let assignments = {};      // bookmarkId -> groupId
let rainCols = [];         // rain column state
const FONT = 13;

function shortTitle(t) {
  t = String(t || '');
  return t.length > 26 ? t.slice(0, 25) + '…' : t;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function loadState() {
  return new Promise(resolve => {
    chrome.storage.local.get([STORE_KEY], res => {
      const s = res[STORE_KEY] || {};
      groups = Array.isArray(s.groups) ? s.groups : [];
      assignments = s.assignments && typeof s.assignments === 'object' ? s.assignments : {};
      resolve();
    });
  });
}

function saveState() {
  chrome.storage.local.set({ [STORE_KEY]: { groups, assignments } });
}

function renderGroups() {
  groupListEl.innerHTML = '';
  if (!groups.length) {
    groupListEl.innerHTML = '<li class="empty">No groups yet — create one above.</li>';
    return;
  }
  for (const g of groups) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="dot"></span><span class="gname"></span><button class="iconbtn" title="Delete group">✕</button>';
    li.querySelector('.dot').style.background = g.color;
    li.querySelector('.gname').textContent = g.name;
    li.querySelector('.iconbtn').addEventListener('click', () => {
      groups = groups.filter(x => x.id !== g.id);
      for (const k of Object.keys(assignments)) if (assignments[k] === g.id) delete assignments[k];
      saveState(); renderGroups(); renderBookmarks();
    });
    groupListEl.appendChild(li);
  }
}

function renderBookmarks() {
  bookmarkListEl.innerHTML = '';
  if (!bookmarks.length) {
    bookmarkListEl.innerHTML = '<li class="empty">No http(s) bookmarks found.</li>';
    return;
  }
  for (const b of bookmarks) {
    const li = document.createElement('li');
    const title = document.createElement('span');
    title.className = 'btitle';
    title.textContent = shortTitle(b.title);
    title.title = b.url;
    const sel = document.createElement('select');
    sel.innerHTML = '<option value="">No group</option>' +
      groups.map(g => '<option value="' + esc(g.id) + '">' + esc(g.name) + '</option>').join('');
    sel.value = assignments[b.id] || '';
    if (sel.value && !groups.some(g => g.id === sel.value)) sel.value = '';
    sel.addEventListener('change', () => {
      if (sel.value) assignments[b.id] = sel.value; else delete assignments[b.id];
      saveState();
    });
    li.appendChild(title);
    li.appendChild(sel);
    bookmarkListEl.appendChild(li);
  }
}

function resetRain() {
  const n = rainColumnCount(stage.width, FONT);
  const rand = seededRandom(1337);
  rainCols = [];
  for (let i = 0; i < n; i++) {
    rainCols.push({ y: rand() * stage.height, speed: 1.2 + rand() * 2.2, ch: KATAKANA[Math.floor(rand() * KATAKANA.length)] });
  }
}

function groupColor(id) {
  const g = groups.find(x => x.id === id);
  return g ? g.color : '#00ff88';
}

function drawFrame() {
  // Fade the previous frame (creates the rain trails).
  ctx.fillStyle = 'rgba(4, 8, 5, 0.22)';
  ctx.fillRect(0, 0, stage.width, stage.height);

  // Matrix rain columns.
  ctx.font = FONT + 'px monospace';
  for (let i = 0; i < rainCols.length; i++) {
    const c = rainCols[i];
    ctx.fillStyle = 'rgba(0, 255, 136, 0.55)';
    ctx.fillText(c.ch, i * FONT, c.y);
    c.y += c.speed;
    if (c.y > stage.height + FONT) {
      c.y = -FONT * Math.random();
      c.ch = KATAKANA[Math.floor(Math.random() * KATAKANA.length)];
    }
  }

  // Group edges under the nodes.
  const edges = groupEdges(laidOut, assignments);
  for (const e of edges) {
    ctx.strokeStyle = groupColor(e.group);
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(e.a.x, e.a.y);
    ctx.lineTo(e.b.x, e.b.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Nodes.
  for (const nd of laidOut) {
    const col = groupColor(assignments[nd.id]);
    ctx.shadowColor = col;
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#06130c';
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, nd.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(232, 234, 240, 0.85)';
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(shortTitle(nd.title), nd.x, nd.y + nd.r + 11);
  }

  requestAnimationFrame(drawFrame);
}

stage.addEventListener('click', ev => {
  const rect = stage.getBoundingClientRect();
  const sx = stage.width / rect.width, sy = stage.height / rect.height;
  const nd = hitNode(laidOut, (ev.clientX - rect.left) * sx, (ev.clientY - rect.top) * sy);
  if (nd) {
    hintEl.textContent = 'Opening: ' + shortTitle(nd.title);
    chrome.tabs.create({ url: nd.url });
  } else {
    hintEl.textContent = 'Click a glowing node to open its bookmark.';
  }
});

document.getElementById('addGroup').addEventListener('click', () => {
  const input = document.getElementById('groupName');
  const g = makeGroup(input.value, groups);
  if (!g) { input.focus(); return; }
  groups.push(g);
  input.value = '';
  saveState(); renderGroups(); renderBookmarks();
});
document.getElementById('groupName').addEventListener('keydown', ev => {
  if (ev.key === 'Enter') document.getElementById('addGroup').click();
});

async function init() {
  resetRain();
  await loadState();
  try {
    const tree = await chrome.bookmarks.getTree();
    bookmarks = flattenBookmarks(tree).slice(0, MAX_NODES);
  } catch (e) {
    bookmarks = [];
  }
  laidOut = nodeLayout(bookmarks, stage.width, stage.height, 20261017);
  hintEl.textContent = bookmarks.length
    ? bookmarks.length + ' bookmark node(s) on the grid. Click one to open it.'
    : 'No bookmarks found — add some in your browser first.';
  renderGroups();
  renderBookmarks();
  requestAnimationFrame(drawFrame);
}

init();
