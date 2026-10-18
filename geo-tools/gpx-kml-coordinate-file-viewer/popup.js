/* TrackView — GPX/KML viewer. All parsing happens locally via DOMParser.
 * Canvas uses an equirectangular projection; no map tiles, no network. */
'use strict';

const $ = (id) => document.getElementById(id);
const dropzone = $('dropzone'), fileInput = $('fileInput');
const statusEl = $('status');

let current = null; // { name, tracks: [{name, pts:[{lat,lon,ele}]}] }

/* ---------- status ---------- */
function setStatus(msg, kind) {
  statusEl.textContent = msg || '';
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}

/* ---------- parsing ---------- */
function parseGPX(doc) {
  const tracks = [];
  doc.querySelectorAll('trk').forEach((trkEl) => {
    const name = (trkEl.querySelector('name') || {}).textContent || 'Track';
    const pts = [];
    trkEl.querySelectorAll('trkpt').forEach((p) => {
      const lat = parseFloat(p.getAttribute('lat'));
      const lon = parseFloat(p.getAttribute('lon'));
      const eleEl = p.querySelector('ele');
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        pts.push({ lat, lon, ele: eleEl ? parseFloat(eleEl.textContent) : null });
      }
    });
    if (pts.length) tracks.push({ name, pts });
  });
  // Fall back to waypoints if no tracks
  if (!tracks.length) {
    const pts = [];
    doc.querySelectorAll('wpt').forEach((p) => {
      const lat = parseFloat(p.getAttribute('lat'));
      const lon = parseFloat(p.getAttribute('lon'));
      if (Number.isFinite(lat) && Number.isFinite(lon)) pts.push({ lat, lon, ele: null });
    });
    if (pts.length) tracks.push({ name: 'Waypoints', pts });
  }
  return tracks;
}

function parseKML(doc) {
  // KML coordinates are "lon,lat[,ele]" tuples separated by whitespace
  const tracks = [];
  doc.querySelectorAll('Placemark').forEach((pm) => {
    const nameEl = pm.querySelector('name');
    const name = nameEl ? nameEl.textContent : 'Placemark';
    pm.querySelectorAll('coordinates').forEach((cEl) => {
      const pts = [];
      cEl.textContent.trim().split(/\s+/).forEach((tuple) => {
        const parts = tuple.split(',');
        const lon = parseFloat(parts[0]), lat = parseFloat(parts[1]);
        const ele = parts.length > 2 ? parseFloat(parts[2]) : null;
        if (Number.isFinite(lat) && Number.isFinite(lon)) pts.push({ lat, lon, ele });
      });
      if (pts.length) tracks.push({ name, pts });
    });
  });
  return tracks;
}

function parseFile(text, fileName) {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('Not a valid XML file.');
  const lower = fileName.toLowerCase();
  const tracks = lower.endsWith('.kml') ? parseKML(doc) : parseGPX(doc);
  if (!tracks.length) throw new Error('No coordinates found (expected GPX tracks/waypoints or KML Placemarks).');
  return tracks;
}

/* ---------- stats ---------- */
function haversine(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function computeStats(tracks) {
  let points = 0, dist = 0, gain = 0, minE = Infinity, maxE = -Infinity, hasEle = false;
  tracks.forEach(({ pts }) => {
    points += pts.length;
    for (let i = 1; i < pts.length; i++) {
      dist += haversine(pts[i - 1], pts[i]);
      const e0 = pts[i - 1].ele, e1 = pts[i].ele;
      if (Number.isFinite(e0) && Number.isFinite(e1)) {
        hasEle = true;
        if (e1 > e0) gain += e1 - e0;
        minE = Math.min(minE, e0, e1); maxE = Math.max(maxE, e0, e1);
      }
    }
  });
  return { points, dist, gain: hasEle ? gain : null, minE: hasEle ? minE : null, maxE: hasEle ? maxE : null };
}

function fmtDist(m) {
  if (m >= 1000) return (m / 1000).toFixed(2) + ' km';
  return Math.round(m) + ' m';
}
function fmtEle(m) { return m == null ? '—' : Math.round(m) + ' m'; }

/* ---------- canvas rendering (equirectangular, no tiles) ---------- */
function drawTrack(tracks) {
  const canvas = $('trackCanvas'), ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Dark "map" backdrop with subtle grid
  ctx.fillStyle = '#0e1117'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  tracks.forEach(({ pts }) => pts.forEach((p) => {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon);
  }));
  const pad = 24;
  const latSpan = Math.max(maxLat - minLat, 1e-6), lonSpan = Math.max(maxLon - minLon, 1e-6);
  // Compensate for latitude distortion on the X axis
  const midLat = (minLat + maxLat) / 2 * Math.PI / 180;
  const xScale = (W - pad * 2) / (lonSpan * Math.cos(midLat) || 1e-6);
  const yScale = (H - pad * 2) / latSpan;
  const scale = Math.min(xScale, yScale);
  const px = (lon) => W / 2 + (lon - (minLon + maxLon) / 2) * Math.cos(midLat) * scale;
  const py = (lat) => H / 2 - (lat - (minLat + maxLat) / 2) * scale;

  const colors = ['#3b82f6', '#22d3ee', '#a78bfa', '#34d399', '#f59e0b'];
  tracks.forEach(({ pts }, ti) => {
    ctx.strokeStyle = colors[ti % colors.length];
    ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 8;
    ctx.beginPath();
    pts.forEach((p, i) => { const x = px(p.lon), y = py(p.lat); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Start / end markers
    const s = pts[0], e = pts[pts.length - 1];
    ctx.fillStyle = '#34d399';
    ctx.beginPath(); ctx.arc(px(s.lon), py(s.lat), 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#f87171';
    ctx.beginPath(); ctx.arc(px(e.lon), py(e.lat), 5, 0, 7); ctx.fill();
  });

  // Corner scale label
  ctx.fillStyle = 'rgba(154,163,178,.9)'; ctx.font = '10px sans-serif';
  ctx.fillText(`${minLat.toFixed(3)}°, ${minLon.toFixed(3)}° → ${maxLat.toFixed(3)}°, ${maxLon.toFixed(3)}°`, 10, H - 8);
}

function drawElevation(tracks) {
  const pts = tracks.flatMap((t) => t.pts).filter((p) => Number.isFinite(p.ele));
  const wrap = $('elevWrap');
  if (!pts.length) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  const canvas = $('elevCanvas'), ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0e1117'; ctx.fillRect(0, 0, W, H);
  const eles = pts.map((p) => p.ele);
  const min = Math.min(...eles), max = Math.max(...eles), span = Math.max(max - min, 1);
  const px = (i) => (i / (pts.length - 1)) * (W - 8) + 4;
  const py = (e) => H - 14 - ((e - min) / span) * (H - 30);
  // Area fill
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(59,130,246,.55)'); grad.addColorStop(1, 'rgba(59,130,246,.05)');
  ctx.beginPath(); ctx.moveTo(px(0), py(eles[0]));
  eles.forEach((e, i) => ctx.lineTo(px(i), py(e)));
  ctx.lineTo(px(eles.length - 1), H); ctx.lineTo(px(0), H); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  // Line
  ctx.beginPath(); ctx.moveTo(px(0), py(eles[0]));
  eles.forEach((e, i) => ctx.lineTo(px(i), py(e)));
  ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.8; ctx.stroke();
  // Labels
  ctx.fillStyle = 'rgba(154,163,178,.95)'; ctx.font = '10px sans-serif';
  ctx.fillText(Math.round(max) + ' m', 6, 12);
  ctx.fillText(Math.round(min) + ' m', 6, H - 6);
}

/* ---------- UI update ---------- */
function render() {
  if (!current) return;
  const { name, tracks } = current;
  $('mapWrap').classList.remove('hidden');
  $('stats').classList.remove('hidden');
  $('actions').classList.remove('hidden');
  $('fileName').textContent = name;
  const totalPts = tracks.reduce((n, t) => n + t.pts.length, 0);
  $('segInfo').textContent = tracks.length + (tracks.length === 1 ? ' track' : ' tracks');
  drawTrack(tracks);
  drawElevation(tracks);
  const st = computeStats(tracks);
  $('stPoints').textContent = st.points.toLocaleString();
  $('stDist').textContent = fmtDist(st.dist);
  $('stGain').textContent = fmtEle(st.gain);
  $('stRange').textContent = st.minE == null ? '—' : `${Math.round(st.minE)}–${Math.round(st.maxE)} m`;
  void totalPts;
}

function toGeoJSON() {
  const features = current.tracks.map((t) => ({
    type: 'Feature',
    properties: { name: t.name },
    geometry: { type: 'LineString', coordinates: t.pts.map((p) => [p.lon, p.lat, ...(Number.isFinite(p.ele) ? [p.ele] : [])]) }
  }));
  return { type: 'FeatureCollection', features };
}

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- file handling ---------- */
function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const tracks = parseFile(String(reader.result), file.name);
      current = { name: file.name, tracks };
      setStatus(`Loaded ${tracks.length} track${tracks.length === 1 ? '' : 's'} from ${file.name}.`, 'ok');
      render();
    } catch (e) {
      setStatus('Could not parse: ' + e.message, 'err');
    }
  };
  reader.onerror = () => setStatus('Failed to read file.', 'err');
  reader.readAsText(file);
}

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
fileInput.addEventListener('change', () => { handleFile(fileInput.files[0]); fileInput.value = ''; });
['dragover', 'dragenter'].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); }));
dropzone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));

$('btnGeoJson').addEventListener('click', () => {
  if (!current) return;
  const base = current.name.replace(/\.(gpx|kml|xml)$/i, '') || 'track';
  download(base + '.geojson', JSON.stringify(toGeoJSON(), null, 2), 'application/geo+json');
  setStatus('GeoJSON exported.', 'ok');
});
$('btnClear').addEventListener('click', () => {
  current = null;
  ['mapWrap', 'stats', 'actions', 'elevWrap'].forEach((id) => $(id).classList.add('hidden'));
  setStatus('');
});
