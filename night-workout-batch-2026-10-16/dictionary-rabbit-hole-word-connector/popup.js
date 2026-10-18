/* Word Rabbit Hole — personal word map.
   Data model: { words: [name], links: [{a, b, kind, note}] } stored in chrome.storage.local.
   Graph: simple spring layout on canvas, nodes draggable, click to inspect. */

/* ---------- state ---------- */
let data = { words: [], links: [] };
let positions = {};      // name -> {x, y, vx, vy}
let selected = null;     // inspected node name
let filter = '';
let dragging = null;

/* ---------- storage ---------- */
async function load() {
  const res = await chrome.storage.local.get('rabbithole');
  if (res.rabbithole) data = res.rabbithole;
  seedIfEmpty();
  layout();
  renderAll();
}
function save() {
  return chrome.storage.local.set({ rabbithole: data });
}
/* Starter demo words so the map isn't empty on first run — clearly user-editable. */
function seedIfEmpty() {
  if (data.words.length > 0) return;
  data.words = ['serendipity', 'petrichor', 'sonder', 'vellichor'];
  data.links = [
    { a: 'serendipity', b: 'sonder', kind: 'association', note: 'chance encounters with strangers' },
    { a: 'petrichor', b: 'vellichor', kind: 'association', note: 'smell-words I love' },
  ];
  save();
}

/* ---------- layout (simple radial + spring relax) ---------- */
const W = 348, H = 300, CX = W / 2, CY = H / 2;
function layout() {
  const n = data.words.length;
  data.words.forEach((w, i) => {
    if (!positions[w]) {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      const r = Math.min(W, H) * 0.32;
      positions[w] = { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r, vx: 0, vy: 0 };
    }
  });
  // drop positions of removed words
  for (const k of Object.keys(positions)) {
    if (!data.words.includes(k)) delete positions[k];
  }
}
function neighbors(name) {
  const out = [];
  for (const l of data.links) {
    if (l.a === name) out.push({ other: l.b, link: l });
    else if (l.b === name) out.push({ other: l.a, link: l });
  }
  return out;
}
function tick() {
  // gentle spring toward center + repulsion between nodes
  const names = data.words;
  for (const n of names) {
    const p = positions[n];
    if (p === dragging) continue;
    p.vx += (CX - p.x) * 0.0015;
    p.vy += (CY - p.y) * 0.0015;
  }
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = positions[names[i]], b = positions[names[j]];
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx * dx + dy * dy + 1;
      const f = 2200 / d2;
      const d = Math.sqrt(d2);
      a.vx += (dx / d) * f * 0.05; a.vy += (dy / d) * f * 0.05;
      b.vx -= (dx / d) * f * 0.05; b.vy -= (dy / d) * f * 0.05;
    }
  }
  // edge springs
  for (const l of data.links) {
    const a = positions[l.a], b = positions[l.b];
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = (d - 110) * 0.002;
    if (a !== dragging) { a.vx += (dx / d) * f; a.vy += (dy / d) * f; }
    if (b !== dragging) { b.vx -= (dx / d) * f; b.vy -= (dy / d) * f; }
  }
  for (const n of names) {
    const p = positions[n];
    if (p === dragging) continue;
    p.vx *= 0.9; p.vy *= 0.9;
    p.x = Math.max(24, Math.min(W - 24, p.x + p.vx));
    p.y = Math.max(24, Math.min(H - 24, p.y + p.vy));
  }
}

/* ---------- rendering ---------- */
const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');

function nodeAt(mx, my) {
  for (const n of data.words) {
    const p = positions[n];
    if (!p) continue;
    if ((mx - p.x) ** 2 + (my - p.y) ** 2 < 18 * 18) return n;
  }
  return null;
}

function draw() {
  tick();
  ctx.clearRect(0, 0, W, H);
  // edges
  for (const l of data.links) {
    const a = positions[l.a], b = positions[l.b];
    if (!a || !b) continue;
    const hot = selected && (l.a === selected || l.b === selected);
    ctx.strokeStyle = hot ? 'rgba(167,139,250,0.85)' : 'rgba(167,139,250,0.25)';
    ctx.lineWidth = hot ? 2.5 : 1.5;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // nodes
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const n of data.words) {
    const p = positions[n];
    if (!p) continue;
    const deg = neighbors(n).length;
    const r = 14 + Math.min(10, deg * 2);
    const isSel = selected === n;
    const isFilt = filter && !n.toLowerCase().includes(filter);
    ctx.globalAlpha = isFilt ? 0.25 : 1;
    const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r);
    g.addColorStop(0, isSel ? '#c4b5fd' : '#a78bfa');
    g.addColorStop(1, isSel ? '#7c3aed' : '#5b4a8a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '600 10px Inter, sans-serif';
    const label = n.length > 12 ? n.slice(0, 11) + '…' : n;
    ctx.fillText(label, p.x, p.y);
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(draw);
}

/* ---------- node inspection ---------- */
function inspect(name) {
  selected = name;
  const box = document.getElementById('nodeinfo');
  if (!name) { box.innerHTML = ''; return; }
  const ns = neighbors(name);
  let html = '<b>' + esc(name) + '</b> — ' + ns.length + ' connection' + (ns.length === 1 ? '' : 's') + '<br>';
  html += ns.map(({ other, link }) =>
    '<span class="kind-badge">' + esc(link.kind) + '</span> ' + esc(other) +
    (link.note ? ' — <i>' + esc(link.note) + '</i>' : '')
  ).join('<br>');
  box.innerHTML = html || '<i>No connections yet — link it from the Links tab.</i>';
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- canvas interaction ---------- */
let dragOffset = { x: 0, y: 0 };
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) * (W / r.width);
  const my = (e.clientY - r.top) * (H / r.height);
  const n = nodeAt(mx, my);
  if (n) {
    dragging = positions[n];
    dragOffset = { x: dragging.x - mx, y: dragging.y - my };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const r = canvas.getBoundingClientRect();
  dragging.x = Math.max(24, Math.min(W - 24, (e.clientX - r.left) * (W / r.width) + dragOffset.x));
  dragging.y = Math.max(24, Math.min(H - 24, (e.clientY - r.top) * (H / r.height) + dragOffset.y));
  dragging.vx = dragging.vy = 0;
});
canvas.addEventListener('pointerup', (e) => {
  if (dragging) { dragging = null; canvas.style.cursor = 'grab'; return; }
  const r = canvas.getBoundingClientRect();
  const n = nodeAt((e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height));
  inspect(n === selected ? null : n);
});

/* ---------- tabs ---------- */
document.querySelectorAll('.tabs button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById('tab-' + b.dataset.tab).classList.add('active');
  });
});

/* ---------- words tab ---------- */
function renderWords() {
  const list = document.getElementById('wordlist');
  list.innerHTML = '';
  const q = filter;
  const shown = data.words.filter((w) => !q || w.toLowerCase().includes(q)).sort();
  for (const w of shown) {
    const row = document.createElement('div');
    row.className = 'chip-row';
    const g = document.createElement('span'); g.className = 'grow'; g.textContent = w;
    const m = document.createElement('span'); m.className = 'meta';
    m.textContent = neighbors(w).length + ' links';
    const del = document.createElement('button'); del.className = 'del'; del.textContent = '×';
    del.title = 'Delete word and its links';
    del.addEventListener('click', () => removeWord(w));
    row.append(g, m, del);
    list.appendChild(row);
  }
  if (!shown.length) list.innerHTML = '<p class="hint">No words yet. Add your first word above.</p>';
}
async function addWord() {
  const inp = document.getElementById('newword');
  const w = inp.value.trim().toLowerCase();
  if (!w) return;
  if (data.words.includes(w)) { inp.value = ''; return; }
  data.words.push(w);
  await save(); layout(); renderAll();
  inp.value = '';
}
async function removeWord(w) {
  data.words = data.words.filter((x) => x !== w);
  data.links = data.links.filter((l) => l.a !== w && l.b !== w);
  if (selected === w) inspect(null);
  await save(); layout(); renderAll();
}

/* ---------- links tab ---------- */
function renderSelects() {
  const opts = data.words.slice().sort();
  for (const id of ['from', 'to']) {
    const sel = document.getElementById(id);
    sel.innerHTML = '';
    for (const w of opts) {
      const o = document.createElement('option'); o.value = o.textContent = w;
      sel.appendChild(o);
    }
  }
}
function renderLinks() {
  const list = document.getElementById('linklist');
  list.innerHTML = '';
  for (const l of data.links) {
    const row = document.createElement('div');
    row.className = 'chip-row';
    const badge = document.createElement('span'); badge.className = 'kind-badge'; badge.textContent = l.kind;
    const g = document.createElement('span'); g.className = 'grow';
    g.textContent = l.a + ' ↔ ' + l.b + (l.note ? ' — ' + l.note : '');
    const del = document.createElement('button'); del.className = 'del'; del.textContent = '×';
    del.addEventListener('click', async () => {
      data.links = data.links.filter((x) => x !== l);
      await save(); renderAll();
    });
    row.append(badge, g, del);
    list.appendChild(row);
  }
  if (!data.links.length) list.innerHTML = '<p class="hint">No links yet. Pick two words and link them.</p>';
}
async function addLink() {
  const a = document.getElementById('from').value;
  const b = document.getElementById('to').value;
  if (!a || !b || a === b) return;
  const exists = data.links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
  if (exists) return;
  data.links.push({
    a, b,
    kind: document.getElementById('kind').value,
    note: document.getElementById('note').value.trim(),
  });
  document.getElementById('note').value = '';
  await save(); renderAll();
}

/* ---------- export / wipe ---------- */
document.getElementById('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'word-rabbit-hole.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById('wipe').addEventListener('click', async () => {
  if (!confirm('Delete all words and links?')) return;
  data = { words: [], links: [] };
  positions = {}; inspect(null);
  await save(); layout(); renderAll();
});

/* ---------- wiring ---------- */
document.getElementById('addword').addEventListener('click', addWord);
document.getElementById('newword').addEventListener('keydown', (e) => { if (e.key === 'Enter') addWord(); });
document.getElementById('addlink').addEventListener('click', addLink);
document.getElementById('center').addEventListener('click', () => { positions = {}; layout(); });
document.getElementById('search').addEventListener('input', (e) => {
  filter = e.target.value.trim().toLowerCase();
  renderWords();
});

function renderAll() {
  renderWords(); renderSelects(); renderLinks();
}

load().then(() => requestAnimationFrame(draw));
