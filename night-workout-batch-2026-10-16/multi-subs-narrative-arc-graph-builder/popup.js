/* ============================================================================
 * ArcSmith — popup logic
 * Narrative-arc planner: the user defines projects, beats and tension levels;
 * the popup renders arc graphs (SVG), compares up to 3 projects, and exports.
 * 100% local, zero network.
 * ========================================================================== */
'use strict';

const $ = (id) => document.getElementById(id);

const PHASES = {
  setup:      { label: 'Setup',          color: '#38bdf8' },
  rising:     { label: 'Rising action',  color: '#a78bfa' },
  climax:     { label: 'Climax',         color: '#f472b6' },
  falling:    { label: 'Falling action', color: '#fbbf24' },
  resolution: { label: 'Resolution',     color: '#4ade80' },
};

const COMPARE_COLORS = ['#818cf8', '#f472b6', '#4ade80'];
const STORAGE_KEY = 'arcsmith.projects.v1';

let store = { projects: {}, order: [] }; // projects: id -> {name, created, beats:[{id,title,tension,phase}]}
let activeId = null;
let compareIds = [];

const uid = () => 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

async function load() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  if (data[STORAGE_KEY] && typeof data[STORAGE_KEY] === 'object') store = data[STORAGE_KEY];
  if (!Array.isArray(store.order)) store.order = Object.keys(store.projects || {});
  if (!store.projects) store = { projects: {}, order: [] };
}
async function save() {
  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ------------------------------ projects --------------------------------- */
async function addProject() {
  const name = $('projectName').value.trim();
  if (!name) { $('projectName').focus(); return; }
  const id = uid();
  store.projects[id] = { name, created: Date.now(), beats: [] };
  store.order.push(id);
  activeId = id;
  $('projectName').value = '';
  await save();
  render();
}

async function deleteProject(id) {
  if (!confirm(`Delete project "${store.projects[id].name}" and all its beats?`)) return;
  delete store.projects[id];
  store.order = store.order.filter((x) => x !== id);
  compareIds = compareIds.filter((x) => x !== id);
  if (activeId === id) activeId = store.order[0] || null;
  await save();
  render();
}

/* -------------------------------- beats ---------------------------------- */
async function addBeat() {
  if (!activeId) return;
  const title = $('beatTitle').value.trim();
  if (!title) { $('beatTitle').focus(); return; }
  const p = store.projects[activeId];
  p.beats.push({
    id: uid(),
    title,
    tension: parseInt($('beatTension').value, 10),
    phase: $('beatPhase').value,
  });
  $('beatTitle').value = '';
  $('beatTension').value = '5';
  $('tensionVal').textContent = '5';
  await save();
  render();
}

async function deleteBeat(beatId) {
  const p = store.projects[activeId];
  p.beats = p.beats.filter((b) => b.id !== beatId);
  await save();
  render();
}

/* ------------------------------- arc graph ------------------------------- */
/* Renders a project's tension curve as SVG. Beats are plotted in order. */
function arcGraphSVG(project, color, opts = {}) {
  const W = 348, H = 150, PAD = 26;
  const beats = project.beats;
  if (!beats.length) {
    return `<svg viewBox="0 0 ${W} ${H}"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#9a9aa6" font-size="11">Add beats to draw the arc.</text></svg>`;
  }
  const x = (i) => beats.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (beats.length - 1);
  const y = (t) => H - PAD - (t / 10) * (H - 2 * PAD - 14);

  const pts = beats.map((b, i) => `${x(i).toFixed(1)},${y(b.tension).toFixed(1)}`).join(' ');
  const area = `${PAD},${H - PAD} ${pts} ${x(beats.length - 1).toFixed(1)},${H - PAD}`;
  const gid = 'g' + Math.random().toString(36).slice(2, 8);

  const dots = beats.map((b, i) => `
    <circle cx="${x(i).toFixed(1)}" cy="${y(b.tension).toFixed(1)}" r="4.5" fill="${color}" stroke="#0b0b10" stroke-width="2">
      <title>${esc(b.title)} — tension ${b.tension}/10 (${PHASES[b.phase].label})</title>
    </circle>`).join('');

  // Tension gridlines at 0/5/10.
  const grid = [0, 5, 10].map((t) => `
    <line x1="${PAD}" y1="${y(t).toFixed(1)}" x2="${W - PAD}" y2="${y(t).toFixed(1)}"
      stroke="rgba(255,255,255,.08)" stroke-width="1"/>
    <text x="6" y="${(y(t) + 3.5).toFixed(1)}" fill="#9a9aa6" font-size="9">${t}</text>`).join('');

  return `
  <svg viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    ${grid}
    <polygon points="${area}" fill="url(#${gid})"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
  </svg>`;
}

function projectStats(p) {
  const beats = p.beats;
  if (!beats.length) return null;
  const tensions = beats.map((b) => b.tension);
  const peak = Math.max(...tensions);
  const peakIdx = tensions.indexOf(peak);
  const avg = tensions.reduce((a, b) => a + b, 0) / tensions.length;
  const climaxPos = beats.length === 1 ? 100 : Math.round((peakIdx / (beats.length - 1)) * 100);
  return { beats: beats.length, peak, avg: avg.toFixed(1), climaxPos };
}

/* --------------------------------- render -------------------------------- */
function render() {
  renderProjectList();
  renderEditor();
  renderGraph();
  renderCompare();
}

function renderProjectList() {
  const ul = $('projectList');
  ul.innerHTML = '';
  if (!store.order.length) {
    ul.innerHTML = '<li class="empty">No projects yet — name one above to begin.</li>';
    return;
  }
  store.order.forEach((id) => {
    const p = store.projects[id];
    if (!p) return;
    const li = document.createElement('li');
    li.className = 'proj-item' + (id === activeId ? ' active' : '');
    li.innerHTML = `
      <span class="name" title="${esc(p.name)}">${esc(p.name)}</span>
      <span class="n">${p.beats.length} beat${p.beats.length === 1 ? '' : 's'}</span>`;
    li.addEventListener('click', () => { activeId = id; render(); });
    ul.appendChild(li);
  });
}

function renderEditor() {
  const card = $('editorCard');
  const p = activeId ? store.projects[activeId] : null;
  card.style.display = p ? '' : 'none';
  if (!p) return;
  $('editorTitle').textContent = p.name;

  const ul = $('beatList');
  ul.innerHTML = '';
  if (!p.beats.length) {
    ul.innerHTML = '<li class="empty">No beats yet — add the first scene above.</li>';
  }
  p.beats.forEach((b) => {
    const li = document.createElement('li');
    li.className = 'beat-item';
    li.innerHTML = `
      <span class="phase-tag" style="--c:${PHASES[b.phase].color}">${esc(PHASES[b.phase].label)}</span>
      <span class="tt" title="${esc(b.title)}">${esc(b.title)}</span>
      <span class="ten">${b.tension}</span>
      <button class="del" title="Delete beat">&times;</button>`;
    li.querySelector('.del').addEventListener('click', () => deleteBeat(b.id));
    ul.appendChild(li);
  });
}

function renderGraph() {
  const card = $('graphCard');
  const p = activeId ? store.projects[activeId] : null;
  card.style.display = p ? '' : 'none';
  if (!p) return;

  $('arcGraph').innerHTML = arcGraphSVG(p, COMPARE_COLORS[0]);

  const s = projectStats(p);
  $('arcStats').innerHTML = s ? `
    <div class="stat"><div class="v">${s.beats}</div><div class="k">beats</div></div>
    <div class="stat"><div class="v">${s.peak}</div><div class="k">peak tension</div></div>
    <div class="stat"><div class="v">${s.avg}</div><div class="k">avg tension</div></div>
    <div class="stat"><div class="v">${s.climaxPos}%</div><div class="k">climax at</div></div>
  ` : '';
}

function renderCompare() {
  const box = $('compareList');
  box.innerHTML = '';
  const ids = store.order.filter((id) => store.projects[id] && store.projects[id].beats.length);
  if (ids.length < 2) {
    box.innerHTML = '<div class="empty">Log beats in at least 2 projects to compare arcs.</div>';
    $('compareGraph').innerHTML = '';
    return;
  }
  ids.forEach((id) => {
    const idx = compareIds.indexOf(id);
    const color = COMPARE_COLORS[idx % COMPARE_COLORS.length];
    const row = document.createElement('label');
    row.className = 'compare-item';
    row.innerHTML = `
      <input type="checkbox" ${idx >= 0 ? 'checked' : ''}>
      <span class="swatch" style="background:${idx >= 0 ? color : 'rgba(255,255,255,.15)'}"></span>
      <span class="name" title="${esc(store.projects[id].name)}">${esc(store.projects[id].name)}</span>`;
    row.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) {
        if (compareIds.length >= 3) { e.target.checked = false; return; }
        compareIds.push(id);
      } else {
        compareIds = compareIds.filter((x) => x !== id);
      }
      renderCompare();
    });
    box.appendChild(row);
  });

  // Overlay the selected arcs (normalized by beat order).
  const W = 348, H = 150, PAD = 26;
  let inner = '';
  const legend = [];
  compareIds.slice(0, 3).forEach((id, k) => {
    const p = store.projects[id];
    if (!p || !p.beats.length) return;
    const color = COMPARE_COLORS[k % COMPARE_COLORS.length];
    const x = (i) => p.beats.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (p.beats.length - 1);
    const y = (t) => H - PAD - (t / 10) * (H - 2 * PAD - 14);
    const pts = p.beats.map((b, i) => `${x(i).toFixed(1)},${y(b.tension).toFixed(1)}`).join(' ');
    inner += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5"
      stroke-linejoin="round" stroke-linecap="round"><title>${esc(p.name)}</title></polyline>`;
    legend.push(`<span><i style="background:${color}"></i>${esc(p.name)}</span>`);
  });
  const grid = [0, 5, 10].map((t) => `
    <line x1="${PAD}" y1="${(H - PAD - (t / 10) * (H - 2 * PAD - 14)).toFixed(1)}" x2="${W - PAD}"
      y2="${(H - PAD - (t / 10) * (H - 2 * PAD - 14)).toFixed(1)}" stroke="rgba(255,255,255,.08)"/>`).join('');
  $('compareGraph').innerHTML = compareIds.length
    ? `<svg viewBox="0 0 ${W} ${H}">${grid}${inner}</svg><div class="legend">${legend.join('')}</div>`
    : '';
}

/* --------------------------------- export -------------------------------- */
function exportJSON() {
  const payload = {
    tool: 'ArcSmith',
    exportedAt: new Date().toISOString(),
    projects: store.order.map((id) => ({ id, ...store.projects[id] })),
    note: 'User-defined story plans — beats and tension levels are the user\u2019s own creative input.',
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `arcsmith-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------------------------- init --------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  await load();
  if (!activeId && store.order.length) activeId = store.order[0];
  render();

  $('addProjectBtn').addEventListener('click', addProject);
  $('projectName').addEventListener('keydown', (e) => { if (e.key === 'Enter') addProject(); });
  $('addBeatBtn').addEventListener('click', addBeat);
  $('beatTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') addBeat(); });
  $('beatTension').addEventListener('input', (e) => { $('tensionVal').textContent = e.target.value; });
  $('exportBtn').addEventListener('click', exportJSON);
  $('deleteProjectBtn').addEventListener('click', () => { if (activeId) deleteProject(activeId); });
});
