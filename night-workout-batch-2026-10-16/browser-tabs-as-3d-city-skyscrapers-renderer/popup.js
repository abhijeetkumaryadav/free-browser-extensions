/* Tab City — pseudo-3D skyscraper renderer for open tabs.
   Layout math is pure and testable (see // ENGINE-START … // ENGINE-END). */

// ENGINE-START
'use strict';

/** Building height in px from a tab title (pure, testable). */
function buildingHeight(title) {
  const n = (title || '').length;
  return Math.round(26 + Math.min(150, n * 1.1));
}

/**
 * Lay out `count` buildings on a ground grid, back rows first.
 * cfg: { w, gap, cols, baseY, rowGap, canvasW }
 * Returns [{ col, row, x, yBot, w }]. Painter order: row ascending.
 */
function layoutBuildings(count, cfg) {
  const c = Object.assign({ w: 36, gap: 12, cols: 5, baseY: 282, rowGap: 26, canvasW: 348 }, cfg || {});
  const out = [];
  for (let i = 0; i < count; i++) {
    const col = i % c.cols, row = Math.floor(i / c.cols);
    const gridW = c.cols * c.w + (c.cols - 1) * c.gap;
    const x = (c.canvasW - gridW) / 2 + col * (c.w + c.gap);
    out.push({ col, row, x, yBot: c.baseY - row * c.rowGap, w: c.w });
  }
  return out;
}

/** Point-in-polygon for the roof parallelogram (pure, testable). */
function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

/** Roof parallelogram corners for a building footprint. dx/dy: iso offset. */
function roofPoly(x, yTop, w, dx, dy) {
  return [[x, yTop], [x + w, yTop], [x + w + dx, yTop + dy], [x + dx, yTop + dy]];
}

/** Hit test: front face rect or roof parallelogram contains (px,py). */
function hitBuilding(b, px, py, dx, dy) {
  if (px >= b.x && px <= b.x + b.w && py >= b.yTop && py <= b.yBot) return true;
  return pointInPoly(px, py, roofPoly(b.x, b.yTop, b.w, dx, dy));
}
// ENGINE-END

/* ---------------- Renderer + UI ---------------- */
const canvas = document.getElementById('city');
const ctx = canvas.getContext('2d');
const DX = 12, DY = -9;              // isometric offset
const ACCENT = '#22d3ee';
let buildings = [];                   // [{..., yTop, tabId, title, lit}]
let hoverIdx = -1;

function seededRand(seed) {           // deterministic windows pattern per tab id
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => (s = s * 16807 % 2147483647) / 2147483647;
}

function drawBuilding(b, hovered) {
  const { x, yTop, yBot, w } = b;
  const h = yBot - yTop;
  const front = hovered ? '#1d3a44' : '#161a24';
  const side  = hovered ? '#122b35' : '#10131c';
  const top   = hovered ? '#274b5a' : '#1e2432';
  // side face
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(x + w, yTop); ctx.lineTo(x + w + DX, yTop + DY);
  ctx.lineTo(x + w + DX, yBot + DY); ctx.lineTo(x + w, yBot); ctx.closePath(); ctx.fill();
  // roof
  ctx.fillStyle = top;
  ctx.beginPath();
  roofPoly(x, yTop, w, DX, DY).forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1; ctx.stroke();
  // front face
  ctx.fillStyle = front;
  ctx.fillRect(x, yTop, w, h);
  ctx.strokeStyle = hovered ? ACCENT : 'rgba(255,255,255,.10)';
  ctx.strokeRect(x + .5, yTop + .5, w - 1, h - 1);
  // windows: deterministic lit grid
  const rnd = seededRand(b.tabId + 7);
  const cols = Math.max(2, Math.floor(w / 9)), rows = Math.max(2, Math.floor(h / 12));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (rnd() < 0.42) {
      ctx.fillStyle = 'rgba(34,211,238,.55)';
      ctx.fillRect(x + 4 + c * 9, yTop + 6 + r * 12, 5, 7);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      ctx.fillRect(x + 4 + c * 9, yTop + 6 + r * 12, 5, 7);
    }
  }
}

function drawGround() {
  ctx.fillStyle = '#0b0b10';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // ground plane
  const g = ctx.createLinearGradient(0, 190, 0, 300);
  g.addColorStop(0, 'rgba(34,211,238,.06)'); g.addColorStop(1, 'rgba(34,211,238,.16)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 300); ctx.lineTo(0, 210); ctx.lineTo(348, 190); ctx.lineTo(348, 300); ctx.closePath(); ctx.fill();
  // stars
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  const rnd = seededRand(42);
  for (let i = 0; i < 40; i++) ctx.fillRect(rnd() * 348, rnd() * 170, 1, 1);
}

function render(tabs) {
  drawGround();
  const lay = layoutBuildings(tabs.length);
  buildings = lay.map((L, i) => {
    const h = buildingHeight(tabs[i].title);
    return Object.assign({}, L, { yTop: L.yBot - h, tabId: tabs[i].id, title: tabs[i].title || '(untitled)' });
  });
  // back rows first
  buildings.forEach((b, i) => drawBuilding(b, i === hoverIdx));
  document.getElementById('tabCount').textContent = tabs.length + (tabs.length === 1 ? ' tab' : ' tabs');
}

function refresh() {
  chrome.tabs.query({ currentWindow: true }, tabs => render(tabs || []));
}

function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return [ (e.clientX - r.left) * (canvas.width / r.width),
           (e.clientY - r.top) * (canvas.height / r.height) ];
}

canvas.addEventListener('mousemove', e => {
  const [px, py] = canvasPos(e);
  let found = -1;
  for (let i = buildings.length - 1; i >= 0; i--) {
    if (hitBuilding(buildings[i], px, py, DX, DY)) { found = i; break; }
  }
  if (found !== hoverIdx) { hoverIdx = found; paint(); }
  canvas.title = found >= 0 ? buildings[found].title : '';
});

let lastTabs = [];
function paint() {
  drawGround();
  buildings.forEach((b, i) => drawBuilding(b, i === hoverIdx));
}

canvas.addEventListener('mouseleave', () => { hoverIdx = -1; paint(); canvas.title = ''; });

canvas.addEventListener('click', e => {
  const [px, py] = canvasPos(e);
  for (let i = buildings.length - 1; i >= 0; i--) {
    if (hitBuilding(buildings[i], px, py, DX, DY)) {
      chrome.tabs.update(buildings[i].tabId, { active: true }, () => {
        chrome.windows.getCurrent(w => chrome.windows.update(w.id, { focused: true }, () => window.close()));
      });
      break;
    }
  }
});

document.getElementById('refresh').addEventListener('click', () => {
  chrome.tabs.query({ currentWindow: true }, tabs => { lastTabs = tabs || []; render(lastTabs); });
});
document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ currentWindow: true }, tabs => { lastTabs = tabs || []; render(lastTabs); });
});
