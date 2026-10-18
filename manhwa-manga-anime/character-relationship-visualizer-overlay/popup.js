/* CharMap — character relationship visualizer. All state in chrome.storage.local. */
'use strict';

// ---------- Relationship type styling ----------
const REL = {
  ally:    {label:'Ally',    color:'#34d399'},
  rival:   {label:'Rival',   color:'#fb7185'},
  family:  {label:'Family',  color:'#fbbf24'},
  romantic:{label:'Romantic',color:'#ec4899'},
  mentor:  {label:'Mentor',  color:'#38bdf8'},
  neutral: {label:'Neutral', color:'#9ca3af'},
};

// ---------- State ----------
const store = {
  maps: [],          // [{id, name, chars:[{id,name,series,color}], rels:[{id,from,to,type,note}]}]
  activeMap: null,
};
const uid = () => Math.random().toString(36).slice(2, 10);

function activeMap() { return store.maps.find(m => m.id === store.activeMap) || null; }

async function load() {
  const d = await chrome.storage.local.get(['maps','activeMap']);
  store.maps = d.maps || [];
  store.activeMap = d.activeMap || null;
  if (!store.maps.length) { // seed a starter map so the graph isn't empty
    const m = {id:uid(), name:'Sample — Odyssey', chars:[], rels:[]};
    const names = [['Odysseus','Odyssey','#ec4899'],['Penelope','Odyssey','#38bdf8'],
      ['Telemachus','Odyssey','#34d399'],['Athena','Odyssey','#a78bfa'],
      ['Poseidon','Odyssey','#fbbf24']];
    const ids = names.map(n => { const c={id:uid(),name:n[0],series:n[1],color:n[2]}; m.chars.push(c); return c.id; });
    const rel = (f,t,type,note='') => m.rels.push({id:uid(),from:ids[f],to:ids[t],type,note});
    rel(0,1,'romantic','spouses'); rel(0,2,'family','father & son'); rel(1,2,'family','mother & son');
    rel(0,3,'ally','goddess protector'); rel(0,4,'rival','godly wrath'); rel(3,4,'rival','divine feud');
    store.maps.push(m); store.activeMap = m.id;
    await save();
  }
  if (!activeMap() && store.maps.length) store.activeMap = store.maps[0].id;
}
async function save() {
  await chrome.storage.local.set({maps:store.maps, activeMap:store.activeMap});
}

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById('pane-' + t.dataset.tab).classList.add('active');
  if (t.dataset.tab === 'graph') requestAnimationFrame(draw);
}));

// ---------- Canvas graph ----------
const cv = document.getElementById('graph');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;
const view = {x:0, y:0, zoom:1};          // pan offset + zoom
const nodes = new Map();                  // charId -> {x,y}
let selected = null, dragNode = null, panning = false, panStart = null;

const toScreen = (x,y) => [ (x + view.x) * view.zoom + W/2, (y + view.y) * view.zoom + H/2 ];
const toWorld  = (sx,sy) => [ (sx - W/2) / view.zoom - view.x, (sy - H/2) / view.zoom - view.y ];

function layoutGraph() { // circle layout, keeps previous node positions stable-ish
  const m = activeMap(); if (!m) return;
  const n = m.chars.length, R = Math.min(120, 30 + n * 14);
  m.chars.forEach((c,i) => {
    if (!nodes.has(c.id)) {
      const a = (i / Math.max(n,1)) * Math.PI * 2 - Math.PI/2;
      nodes.set(c.id, {x: Math.cos(a)*R, y: Math.sin(a)*R});
    }
  });
  for (const id of [...nodes.keys()]) // drop nodes of deleted chars
    if (!m.chars.some(c => c.id === id)) nodes.delete(id);
}

function draw() {
  const m = activeMap();
  ctx.clearRect(0,0,W,H);
  if (!m || !m.chars.length) {
    ctx.fillStyle = '#a3a3ad'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('No characters yet — add some in the People tab.', W/2, H/2);
    return;
  }
  // edges
  m.rels.forEach(r => {
    const a = nodes.get(r.from), b = nodes.get(r.to);
    if (!a || !b) return;
    const [x1,y1] = toScreen(a.x,a.y), [x2,y2] = toScreen(b.x,b.y);
    const col = REL[r.type]?.color || '#9ca3af';
    ctx.strokeStyle = col + 'cc'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    // midpoint label
    ctx.fillStyle = col; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(REL[r.type]?.label || r.type, (x1+x2)/2, (y1+y2)/2 - 4);
  });
  // nodes
  m.chars.forEach(c => {
    const n = nodes.get(c.id); if (!n) return;
    const [x,y] = toScreen(n.x,n.y);
    const r = (c.id === selected ? 17 : 14) * Math.sqrt(view.zoom);
    if (c.id === selected) { ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x,y,r+5,0,7); ctx.stroke(); }
    const g = ctx.createRadialGradient(x-4,y-4,2,x,y,r);
    g.addColorStop(0, c.color); g.addColorStop(1, shade(c.color));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '600 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(initials(c.name), x, y+3.5);
    ctx.fillStyle = '#e8e8ec'; ctx.font = '11px sans-serif';
    ctx.fillText(trunc(c.name, 14), x, y + r + 13);
  });
}
const initials = n => n.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
const trunc = (s,n) => s.length > n ? s.slice(0,n-1)+'…' : s;
function shade(hex){ // darken for gradient edge
  const v = parseInt(hex.slice(1),16);
  const f = c => Math.max(0, Math.round(c*0.55));
  const r=f(v>>16&255), g=f(v>>8&255), b=f(v&255);
  return `rgb(${r},${g},${b})`;
}

// pointer interactions: pan background, drag nodes, click selects
let downPos = null, moved = false;
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId);
  const rect = cv.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const [wx,wy] = toWorld(sx,sy);
  const m = activeMap();
  dragNode = null;
  if (m) for (const c of m.chars) {
    const n = nodes.get(c.id); if (!n) continue;
    if (Math.hypot(n.x-wx, n.y-wy) < 20 / view.zoom + 6) { dragNode = c.id; break; }
  }
  downPos = {sx,sy,wx,wy,vx:view.x,vy:view.y};
  moved = false; panning = !dragNode;
});
cv.addEventListener('pointermove', e => {
  if (!downPos) return;
  const rect = cv.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  if (Math.hypot(sx-downPos.sx, sy-downPos.sy) > 4) moved = true;
  if (dragNode) {
    const [wx,wy] = toWorld(sx,sy);
    nodes.set(dragNode, {x:wx, y:wy});
  } else if (panning) {
    view.x = downPos.vx + (sx-downPos.sx)/view.zoom;
    view.y = downPos.vy + (sy-downPos.sy)/view.zoom;
  }
  requestAnimationFrame(draw);
});
cv.addEventListener('pointerup', e => {
  const m = activeMap();
  if (!moved && m) { // click: select node or clear
    const rect = cv.getBoundingClientRect();
    const [wx,wy] = toWorld(e.clientX-rect.left, e.clientY-rect.top);
    selected = null;
    for (const c of m.chars) {
      const n = nodes.get(c.id); if (!n) continue;
      if (Math.hypot(n.x-wx, n.y-wy) < 20 / view.zoom + 6) { selected = c.id; break; }
    }
    renderDetail();
  }
  downPos = null; dragNode = null; panning = false;
  requestAnimationFrame(draw);
});
cv.addEventListener('wheel', e => {
  e.preventDefault();
  view.zoom = Math.min(2.5, Math.max(0.4, view.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
  requestAnimationFrame(draw);
}, {passive:false});

function renderDetail() {
  const box = document.getElementById('detail'), m = activeMap();
  const c = m?.chars.find(x => x.id === selected);
  if (!c) { box.hidden = true; return; }
  box.hidden = false;
  document.getElementById('detailDot').style.background = c.color;
  document.getElementById('detailName').textContent = c.name;
  document.getElementById('detailSeries').textContent = c.series || 'No series set';
  const list = document.getElementById('detailConns'); list.innerHTML = '';
  const rels = m.rels.filter(r => r.from === c.id || r.to === c.id);
  if (!rels.length) list.innerHTML = '<li>No links yet.</li>';
  rels.forEach(r => {
    const other = m.chars.find(x => x.id === (r.from === c.id ? r.to : r.from));
    const li = document.createElement('li');
    li.innerHTML = `<span class="rtype">${REL[r.type]?.label||r.type}</span> · ${esc(other?.name||'?')}${r.note?` — <span class="muted">${esc(r.note)}</span>`:''}`;
    li.addEventListener('click', () => { selected = other?.id || null; renderDetail(); requestAnimationFrame(draw); });
    list.appendChild(li);
  });
}
document.getElementById('detailClose').addEventListener('click', () => {
  selected = null; renderDetail(); requestAnimationFrame(draw);
});

function renderLegend() {
  const box = document.getElementById('legend'); box.innerHTML = '';
  const used = new Set((activeMap()?.rels||[]).map(r => r.type));
  Object.entries(REL).filter(([k]) => used.has(k)).forEach(([k,v]) => {
    const s = document.createElement('span');
    s.innerHTML = `<i style="border-color:${v.color}"></i>${v.label}`;
    box.appendChild(s);
  });
}

// ---------- People ----------
document.getElementById('charForm').addEventListener('submit', async e => {
  e.preventDefault();
  const m = activeMap(); if (!m) return;
  m.chars.push({id:uid(),
    name:document.getElementById('cName').value.trim(),
    series:document.getElementById('cSeries').value.trim(),
    color:document.getElementById('cColor').value});
  e.target.reset(); document.getElementById('cColor').value = '#ec4899';
  await save(); renderAll();
});
function renderChars() {
  const m = activeMap(), list = document.getElementById('charList');
  list.innerHTML = '';
  (m?.chars||[]).forEach(c => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="dot" style="background:${c.color}"></span>
      <div class="grow"><strong>${esc(c.name)}</strong><span>${esc(c.series||'—')}</span></div>
      <button class="mini" data-view>View</button><button class="mini danger" data-del>✕</button>`;
    li.querySelector('[data-view]').addEventListener('click', () => {
      selected = c.id; renderDetail();
      document.querySelector('[data-tab=graph]').click();
    });
    li.querySelector('[data-del]').addEventListener('click', async () => {
      m.chars = m.chars.filter(x => x.id !== c.id);
      m.rels = m.rels.filter(r => r.from !== c.id && r.to !== c.id);
      if (selected === c.id) selected = null;
      await save(); renderAll();
    });
    list.appendChild(li);
  });
  // refresh link dropdowns
  const opts = (m?.chars||[]).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  document.getElementById('rFrom').innerHTML = opts;
  document.getElementById('rTo').innerHTML = opts;
}

// ---------- Links ----------
document.getElementById('relForm').addEventListener('submit', async e => {
  e.preventDefault();
  const m = activeMap(); if (!m) return;
  const from = document.getElementById('rFrom').value, to = document.getElementById('rTo').value;
  if (!from || !to || from === to) return;
  m.rels.push({id:uid(), from, to, type:document.getElementById('rType').value,
    note:document.getElementById('rNote').value.trim()});
  e.target.reset(); await save(); renderAll();
});
function renderRels() {
  const m = activeMap(), list = document.getElementById('relList');
  list.innerHTML = '';
  (m?.rels||[]).forEach(r => {
    const a = m.chars.find(c => c.id === r.from), b = m.chars.find(c => c.id === r.to);
    const li = document.createElement('li');
    li.innerHTML = `<div class="grow"><strong>${esc(a?.name||'?')} <span class="badge" style="color:${REL[r.type]?.color}">${REL[r.type]?.label||r.type}</span> ${esc(b?.name||'?')}</strong>
      <span>${esc(r.note||'')}</span></div><button class="mini danger" data-del>✕</button>`;
    li.querySelector('[data-del]').addEventListener('click', async () => {
      m.rels = m.rels.filter(x => x.id !== r.id); await save(); renderAll();
    });
    list.appendChild(li);
  });
}

// ---------- Maps ----------
document.getElementById('mapForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('mName').value.trim(); if (!name) return;
  const m = {id:uid(), name, chars:[], rels:[]};
  store.maps.push(m); store.activeMap = m.id;
  e.target.reset(); await save(); renderAll();
});
function renderMaps() {
  const sel = document.getElementById('mapSelect');
  sel.innerHTML = store.maps.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  sel.value = store.activeMap;
  const list = document.getElementById('mapList'); list.innerHTML = '';
  store.maps.forEach(m => {
    const li = document.createElement('li');
    li.innerHTML = `<div class="grow"><strong>${esc(m.name)}</strong>
      <span>${m.chars.length} characters · ${m.rels.length} links</span></div>
      ${m.id===store.activeMap?'<span class="badge">Active</span>':''}
      <button class="mini danger" data-del>✕</button>`;
    li.querySelector('[data-del]').addEventListener('click', async () => {
      if (store.maps.length <= 1) return; // keep at least one map
      store.maps = store.maps.filter(x => x.id !== m.id);
      if (store.activeMap === m.id) store.activeMap = store.maps[0].id;
      await save(); renderAll();
    });
    list.appendChild(li);
  });
}
document.getElementById('mapSelect').addEventListener('change', async e => {
  store.activeMap = e.target.value; selected = null; nodes.clear();
  await save(); renderAll();
});

// ---------- Export / import ----------
document.getElementById('exportBtn').addEventListener('click', () => {
  const m = activeMap(); if (!m) return;
  const blob = new Blob([JSON.stringify(m, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = m.name.toLowerCase().replace(/[^a-z0-9]+/g,'-') + '.charmap.json';
  a.click(); URL.revokeObjectURL(a.href);
});
document.getElementById('importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const m = JSON.parse(await f.text());
    if (!m.name || !Array.isArray(m.chars) || !Array.isArray(m.rels)) throw 0;
    m.id = uid(); m.name += ' (imported)';
    m.chars.forEach(c => c.id = uid());
    store.maps.push(m); store.activeMap = m.id;
    await save(); renderAll();
  } catch { /* invalid file — ignore */ }
  e.target.value = '';
});

const esc = s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function renderAll() { layoutGraph(); renderLegend(); renderDetail(); renderChars(); renderRels(); renderMaps(); requestAnimationFrame(draw); }

load().then(renderAll);
