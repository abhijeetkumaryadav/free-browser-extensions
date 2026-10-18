/* BBoxGrab — draw or type a bounding box, emit GeoJSON.
 * Canvas grid is a manual equirectangular frame, not a map. Zero network. */
'use strict';

const $ = (id) => document.getElementById(id);
const canvas = $('bboxCanvas'), ctx = canvas.getContext('2d');
const statusEl = $('status');
const W = canvas.width, H = canvas.height;

let bbox = null;       // {west, south, east, north}
let drawing = null;    // pixel rect while dragging
const PRECISION = 6;

/* ---------- helpers ---------- */
function setStatus(msg, kind) {
  statusEl.textContent = msg || '';
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Equirectangular frame mapping: lon -180..180 -> x, lat 90..-90 -> y
const lonToX = (lon) => ((lon + 180) / 360) * W;
const latToY = (lat) => ((90 - lat) / 180) * H;
const xToLon = (x) => (x / W) * 360 - 180;
const yToLat = (y) => 90 - (y / H) * 180;

function fmt(n) { return Number(n.toFixed(PRECISION)); }

function bboxToGeoJSON(b) {
  const ring = [
    [fmt(b.west), fmt(b.south)],
    [fmt(b.east), fmt(b.south)],
    [fmt(b.east), fmt(b.north)],
    [fmt(b.west), fmt(b.north)],
    [fmt(b.west), fmt(b.south)]
  ];
  return {
    type: 'Feature',
    properties: { bbox: [fmt(b.west), fmt(b.south), fmt(b.east), fmt(b.north)] },
    geometry: { type: 'Polygon', coordinates: [ring] }
  };
}

// Approximate area via equirectangular integration (R^2 * dLon * sum(cos(lat) dLat))
function approxAreaKm2(b) {
  const R = 6371, rad = Math.PI / 180;
  const dLon = (b.east - b.west) * rad;
  const area = R * R * dLon * Math.abs(Math.sin(b.north * rad) - Math.sin(b.south * rad));
  return area;
}

function fmtArea(km2) {
  if (km2 >= 1e6) return (km2 / 1e6).toFixed(2) + ' M km²';
  if (km2 >= 1) return km2.toFixed(1) + ' km²';
  return (km2 * 1e6).toFixed(0) + ' m²';
}

/* ---------- drawing ---------- */
function drawGrid() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0e1117'; ctx.fillRect(0, 0, W, H);
  // graticule every 30°
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(154,163,178,.75)'; ctx.font = '9px sans-serif';
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = lonToX(lon);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    ctx.fillText(lon + '°', x + 3, H - 5);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = latToY(lat);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.fillText(lat + '°', 4, y - 3);
  }
  // equator + prime meridian emphasis
  ctx.strokeStyle = 'rgba(255,255,255,.16)';
  ctx.beginPath(); ctx.moveTo(0, latToY(0)); ctx.lineTo(W, latToY(0)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(lonToX(0), 0); ctx.lineTo(lonToX(0), H); ctx.stroke();
}

function drawRectPx(x0, y0, x1, y1) {
  const rx = Math.min(x0, x1), ry = Math.min(y0, y1);
  const rw = Math.abs(x1 - x0), rh = Math.abs(y1 - y0);
  ctx.fillStyle = 'rgba(168,85,247,.22)';
  ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2;
  ctx.strokeRect(rx, ry, rw, rh);
  // corner handles
  ctx.fillStyle = '#a855f7';
  [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]].forEach(([cx, cy]) => {
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
  });
}

function render() {
  drawGrid();
  const r = drawing;
  if (r) drawRectPx(r.x0, r.y0, r.x1, r.y1);
  else if (bbox) drawRectPx(lonToX(bbox.west), latToY(bbox.north), lonToX(bbox.east), latToY(bbox.south));
}

function setBbox(west, south, east, north) {
  west = clamp(west, -180, 180); east = clamp(east, -180, 180);
  south = clamp(south, -90, 90); north = clamp(north, -90, 90);
  if (west > east) [west, east] = [east, west];
  if (south > north) [south, north] = [north, south];
  if (west === east || south === north) { setStatus('Box needs a non-zero width and height.', 'err'); return false; }
  bbox = { west, south, east, north };
  $('result').classList.remove('hidden');
  const gj = bboxToGeoJSON(bbox);
  $('geojsonOut').textContent = JSON.stringify(gj, null, 2);
  $('bboxLabel').textContent = `W ${fmt(west)} · S ${fmt(south)} · E ${fmt(east)} · N ${fmt(north)}`;
  $('areaLabel').textContent = '≈ ' + fmtArea(approxAreaKm2(bbox));
  setStatus('Bounding box ready.', 'ok');
  render();
  return true;
}

/* ---------- draw interaction ---------- */
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = canvasPos(e);
  drawing = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  render();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const p = canvasPos(e);
  drawing.x1 = clamp(p.x, 0, W); drawing.y1 = clamp(p.y, 0, H);
  render();
});
canvas.addEventListener('pointerup', (e) => {
  if (!drawing) return;
  const p = canvasPos(e);
  drawing.x1 = clamp(p.x, 0, W); drawing.y1 = clamp(p.y, 0, H);
  const w = xToLon(Math.min(drawing.x0, drawing.x1));
  const e2 = xToLon(Math.max(drawing.x0, drawing.x1));
  const n = yToLat(Math.min(drawing.y0, drawing.y1));
  const s = yToLat(Math.max(drawing.y0, drawing.y1));
  drawing = null;
  setBbox(w, s, e2, n);
});

/* ---------- tabs ---------- */
$('tabDraw').addEventListener('click', () => {
  $('tabDraw').classList.add('active'); $('tabType').classList.remove('active');
  $('tabDraw').setAttribute('aria-selected', 'true'); $('tabType').setAttribute('aria-selected', 'false');
  $('paneDraw').classList.remove('hidden'); $('paneType').classList.add('hidden');
  render();
});
$('tabType').addEventListener('click', () => {
  $('tabType').classList.add('active'); $('tabDraw').classList.remove('active');
  $('tabType').setAttribute('aria-selected', 'true'); $('tabDraw').setAttribute('aria-selected', 'false');
  $('paneType').classList.remove('hidden'); $('paneDraw').classList.add('hidden');
});

$('btnApply').addEventListener('click', () => {
  const w = parseFloat($('inWest').value), s = parseFloat($('inSouth').value);
  const e = parseFloat($('inEast').value), n = parseFloat($('inNorth').value);
  if (![w, s, e, n].every(Number.isFinite)) { setStatus('Enter all four numeric coordinates.', 'err'); return; }
  setBbox(w, s, e, n);
});

/* ---------- actions ---------- */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove(); return ok;
  }
}
$('btnCopy').addEventListener('click', async () => {
  const ok = await copyText($('geojsonOut').textContent);
  setStatus(ok ? 'GeoJSON copied to clipboard.' : 'Copy failed — select the text manually.', ok ? 'ok' : 'err');
});
$('btnDownload').addEventListener('click', () => {
  const blob = new Blob([$('geojsonOut').textContent], { type: 'application/geo+json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'bbox.geojson';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  setStatus('Downloaded bbox.geojson.', 'ok');
});

render();
