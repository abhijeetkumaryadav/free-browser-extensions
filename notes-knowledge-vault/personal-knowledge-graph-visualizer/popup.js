/* GraphMind — personal knowledge graph visualizer.
   All state lives in chrome.storage.local. Canvas uses screen-space
   coordinates with an adjustable pan/zoom camera. */
'use strict';

const DEFAULT_GRAPH = { id: 'g1', name: 'My Graph', nodes: [], edges: [] };
let graphs = [];          // [{id,name,nodes:[{id,label,color,notes}],edges:[{id,from,to,type}]}]
let activeId = null;
let cam = { x: 0, y: 0, z: 1 };   // pan offset + zoom
let selectedNodeId = null;
let drag = null;                  // {mode:'node'|'pan', id, dx, dy, moved}

/* ---------- storage ---------- */
async function load() {
  const s = await chrome.storage.local.get({ graphs: [], activeId: null });
  graphs = s.graphs;
  if (!graphs.length) { graphs = [structuredClone(DEFAULT_GRAPH)]; }
  activeId = graphs.some(g => g.id === s.activeId) ? s.activeId : graphs[0].id;
}
async function save() {
  await chrome.storage.local.set({ graphs, activeId });
}
const graph = () => graphs.find(g => g.id === activeId);
const uid = () => 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- tabs ---------- */
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('pane-' + t.dataset.tab).classList.add('active');
  });
});

/* ---------- canvas rendering ---------- */
const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');
const DPR = window.devicePixelRatio || 1;
const W = 700, H = 380;
canvas.width = W * DPR; canvas.height = H * DPR; ctx.scale(DPR, DPR);

const toScreen = (x, y) => [x * cam.z + cam.x + W / 2, y * cam.z + cam.y + H / 2];
const toWorld = (sx, sy) => [(sx - W / 2 - cam.x) / cam.z, (sy - H / 2 - cam.y) / cam.z];

function draw() {
  const g = graph();
  ctx.clearRect(0, 0, W, H);
  // edges
  for (const e of g.edges) {
    const a = g.nodes.find(n => n.id === e.from);
    const b = g.nodes.find(n => n.id === e.to);
    if (!a || !b) continue;
    const [ax, ay] = toScreen(a.x, a.y), [bx, by] = toScreen(b.x, b.y);
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1;
    const r = 16 * cam.z;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ax + dx / d * r, ay + dy / d * r);
    ctx.lineTo(bx - dx / d * r, by - dy / d * r);
    ctx.stroke();
    // arrowhead
    const ang = Math.atan2(dy, dx);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.save(); ctx.translate(bx - dx / d * (r + 2), by - dy / d * (r + 2)); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-8, -4); ctx.lineTo(-8, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    // edge type label
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    ctx.font = '10px sans-serif'; ctx.fillStyle = 'rgba(154,154,165,0.9)';
    ctx.textAlign = 'center';
    ctx.fillText(e.type, mx, my - 5);
  }
  // nodes
  for (const n of g.nodes) {
    const [sx, sy] = toScreen(n.x, n.y);
    const r = 16 * cam.z;
    const sel = n.id === selectedNodeId;
    ctx.beginPath(); ctx.arc(sx, sy, r + (sel ? 3 : 0), 0, Math.PI * 2);
    ctx.fillStyle = n.color || '#10b981'; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
    if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.font = `${Math.max(10, 11 * cam.z)}px sans-serif`;
    ctx.fillStyle = '#ececf1'; ctx.textAlign = 'center';
    const label = n.label.length > 16 ? n.label.slice(0, 15) + '…' : n.label;
    ctx.fillText(label, sx, sy + r + 15);
  }
}

/* ---------- canvas interaction ---------- */
function nodeAt(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  return graph().nodes.find(n => Math.hypot(n.x - wx, n.y - wy) < 18);
}
function pos(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

canvas.addEventListener('mousedown', e => {
  const [sx, sy] = pos(e);
  const n = nodeAt(sx, sy);
  if (n) {
    const [wx, wy] = toWorld(sx, sy);
    drag = { mode: 'node', id: n.id, dx: n.x - wx, dy: n.y - wy, moved: false };
  } else {
    drag = { mode: 'pan', sx, sy, cx: cam.x, cy: cam.y, moved: false };
  }
});
canvas.addEventListener('mousemove', e => {
  if (!drag) return;
  const [sx, sy] = pos(e);
  if (drag.mode === 'node') {
    const [wx, wy] = toWorld(sx, sy);
    const n = graph().nodes.find(x => x.id === drag.id);
    if (n) { n.x = wx + drag.dx; n.y = wy + drag.dy; drag.moved = true; }
  } else {
    cam.x = drag.cx + (sx - drag.sx); cam.y = drag.cy + (sy - drag.sy);
    if (Math.abs(sx - drag.sx) + Math.abs(sy - drag.sy) > 3) drag.moved = true;
  }
  draw();
});
window.addEventListener('mouseup', async e => {
  if (!drag) return;
  const wasNodeDrag = drag.mode === 'node' && drag.moved;
  const clickedNode = drag.mode === 'node' && !drag.moved ? graph().nodes.find(n => n.id === drag.id) : null;
  drag = null;
  if (wasNodeDrag) await save();
  else if (clickedNode) selectNode(clickedNode.id);
  else { selectedNodeId = null; renderCard(); draw(); }
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const [sx, sy] = pos(e);
  const [wx, wy] = toWorld(sx, sy);
  cam.z = Math.min(3, Math.max(0.3, cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  cam.x = sx - W / 2 - wx * cam.z; cam.y = sy - H / 2 - wy * cam.z;
  draw();
}, { passive: false });

document.getElementById('zoomIn').addEventListener('click', () => { cam.z = Math.min(3, cam.z * 1.25); draw(); });
document.getElementById('zoomOut').addEventListener('click', () => { cam.z = Math.max(0.3, cam.z / 1.25); draw(); });
document.getElementById('zoomReset').addEventListener('click', () => { cam = { x: 0, y: 0, z: 1 }; draw(); });

/* ---------- node detail card ---------- */
function selectNode(id) {
  selectedNodeId = id;
  renderCard(); draw();
}
function renderCard() {
  const card = document.getElementById('nodeCard');
  const g = graph();
  const n = g.nodes.find(x => x.id === selectedNodeId);
  if (!n) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  document.getElementById('ncDot').style.background = n.color || '#10b981';
  document.getElementById('ncTitle').textContent = n.label;
  document.getElementById('ncNotes').textContent = n.notes || 'No notes.';
  const ul = document.getElementById('ncNeighbors');
  ul.innerHTML = '';
  const links = g.edges.filter(e => e.from === n.id || e.to === n.id);
  if (!links.length) ul.innerHTML = '<li class="empty">No connections yet.</li>';
  for (const e of links) {
    const other = g.nodes.find(x => x.id === (e.from === n.id ? e.to : e.from));
    if (!other) continue;
    const li = document.createElement('li');
    const dir = e.from === n.id ? '→' : '←';
    li.innerHTML = `<span class="rel">${dir} ${e.type}</span> · `;
    const s = document.createElement('span'); s.textContent = other.label;
    li.appendChild(s);
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => selectNode(other.id));
    ul.appendChild(li);
  }
}
document.getElementById('ncClose').addEventListener('click', () => {
  selectedNodeId = null; renderCard(); draw();
});

/* ---------- graph switching ---------- */
const graphSelect = document.getElementById('graphSelect');
function renderGraphSelect() {
  graphSelect.innerHTML = '';
  for (const g of graphs) {
    const o = document.createElement('option');
    o.value = g.id; o.textContent = g.name;
    if (g.id === activeId) o.selected = true;
    graphSelect.appendChild(o);
  }
}
graphSelect.addEventListener('change', async () => {
  activeId = graphSelect.value; selectedNodeId = null;
  cam = { x: 0, y: 0, z: 1 };
  await save(); renderAll();
});
document.getElementById('newGraphBtn').addEventListener('click', async () => {
  const name = prompt('Name for the new graph:', 'New Graph');
  if (!name) return;
  const g = { id: uid(), name: name.slice(0, 40), nodes: [], edges: [] };
  graphs.push(g); activeId = g.id;
  await save(); renderAll();
});

/* ---------- nodes ---------- */
function layoutNode(g, i) {
  const a = (i / Math.max(1, g.nodes.length)) * Math.PI * 2;
  return { x: Math.cos(a) * 120, y: Math.sin(a) * 90 };
}
document.getElementById('nodeForm').addEventListener('submit', async e => {
  e.preventDefault();
  const g = graph();
  const label = document.getElementById('nodeLabel').value.trim();
  if (!label) return;
  const { x, y } = layoutNode(g, g.nodes.length);
  g.nodes.push({
    id: uid(), label,
    color: document.getElementById('nodeColor').value,
    notes: document.getElementById('nodeNotes').value.trim(),
    x, y
  });
  e.target.reset();
  document.getElementById('nodeColor').value = '#10b981';
  await save(); renderAll();
});

function renderNodeList() {
  const g = graph();
  const ul = document.getElementById('nodeList');
  ul.innerHTML = '';
  if (!g.nodes.length) { ul.innerHTML = '<li class="empty">No nodes yet — add your first concept above.</li>'; }
  for (const n of g.nodes) {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'dot'; dot.style.background = n.color || '#10b981';
    const grow = document.createElement('span');
    grow.className = 'grow'; grow.textContent = n.label;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = g.edges.filter(e => e.from === n.id || e.to === n.id).length + ' links';
    const del = document.createElement('button');
    del.className = 'del'; del.textContent = '✕'; del.title = 'Delete node';
    del.addEventListener('click', async () => {
      g.nodes = g.nodes.filter(x => x.id !== n.id);
      g.edges = g.edges.filter(x => x.from !== n.id && x.to !== n.id);
      if (selectedNodeId === n.id) selectedNodeId = null;
      await save(); renderAll();
    });
    li.append(dot, grow, meta, del);
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => selectNode(n.id));
    ul.appendChild(li);
  }
}

/* ---------- edges ---------- */
function renderEdgeSelects() {
  const g = graph();
  for (const id of ['edgeFrom', 'edgeTo']) {
    const sel = document.getElementById(id);
    sel.innerHTML = '';
    for (const n of g.nodes) {
      const o = document.createElement('option');
      o.value = n.id; o.textContent = n.label;
      sel.appendChild(o);
    }
  }
}
document.getElementById('edgeForm').addEventListener('submit', async e => {
  e.preventDefault();
  const g = graph();
  const from = document.getElementById('edgeFrom').value;
  const to = document.getElementById('edgeTo').value;
  const type = document.getElementById('edgeType').value;
  if (!from || !to || from === to) return;
  if (g.edges.some(x => x.from === from && x.to === to && x.type === type)) return;
  g.edges.push({ id: uid(), from, to, type });
  await save(); renderAll();
});
function renderEdgeList() {
  const g = graph();
  const ul = document.getElementById('edgeList');
  ul.innerHTML = '';
  if (!g.edges.length) { ul.innerHTML = '<li class="empty">No edges yet — link two nodes above.</li>'; }
  const name = id => { const n = g.nodes.find(x => x.id === id); return n ? n.label : '?'; };
  for (const e of g.edges) {
    const li = document.createElement('li');
    const grow = document.createElement('span'); grow.className = 'grow';
    grow.textContent = `${name(e.from)} → ${name(e.to)}`;
    const meta = document.createElement('span'); meta.className = 'meta'; meta.textContent = e.type;
    const del = document.createElement('button');
    del.className = 'del'; del.textContent = '✕'; del.title = 'Delete edge';
    del.addEventListener('click', async () => {
      g.edges = g.edges.filter(x => x.id !== e.id);
      await save(); renderAll();
    });
    li.append(grow, meta, del);
    ul.appendChild(li);
  }
}

/* ---------- export / import ---------- */
document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(graph(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = graph().name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json';
  a.click(); URL.revokeObjectURL(a.href);
});
document.getElementById('importBtn').addEventListener('click', () =>
  document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error('bad');
    data.nodes.forEach((n, i) => {
      n.id = String(n.id || uid());
      n.label = String(n.label || 'Node');
      n.color = String(n.color || '#10b981');
      n.notes = String(n.notes || '');
      if (typeof n.x !== 'number') { const p = layoutNode(data, i); n.x = p.x; n.y = p.y; }
    });
    data.edges.forEach(ed => { ed.id = String(ed.id || uid()); });
    graphs.push({ id: uid(), name: String(data.name || f.name.replace(/\.json$/i, '')), nodes: data.nodes, edges: data.edges });
    activeId = graphs[graphs.length - 1].id;
    await save(); renderAll();
  } catch { alert('That file is not a valid GraphMind export.'); }
  e.target.value = '';
});

/* ---------- render all ---------- */
function renderStats() {
  const g = graph();
  document.getElementById('stats').textContent =
    `${graphs.length} graph${graphs.length === 1 ? '' : 's'} · ${g.nodes.length} nodes · ${g.edges.length} edges`;
}
function renderAll() {
  renderGraphSelect(); renderNodeList(); renderEdgeSelects(); renderEdgeList();
  renderCard(); renderStats(); draw();
}

(async () => { await load(); renderAll(); })();
