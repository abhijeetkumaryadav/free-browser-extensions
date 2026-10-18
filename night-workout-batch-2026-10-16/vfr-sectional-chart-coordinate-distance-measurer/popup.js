/* VFR Coordinate Distance Measurer — popup logic + headless-testable engine */
'use strict';

// ENGINE-START
const EARTH_R_KM = 6371.0088;
const KM_PER_NM = 1.852;
const KM_PER_MI = 1.609344;

function deg2rad(d) { return d * Math.PI / 180; }
function rad2deg(r) { return r * 180 / Math.PI; }

/**
 * Great-circle measurement between two lat/long pairs.
 * @returns {object|null} { km, nm, mi, bearingDeg } or null for invalid input
 */
function measureRoute(lat1, lon1, lat2, lon2) {
  const pts = [lat1, lon1, lat2, lon2];
  if (pts.some((v) => !isFinite(v))) return null;
  if (Math.abs(lat1) > 90 || Math.abs(lat2) > 90) return null;
  if (Math.abs(lon1) > 180 || Math.abs(lon2) > 180) return null;

  const p1 = deg2rad(lat1), p2 = deg2rad(lat2);
  const dp = deg2rad(lat2 - lat1), dl = deg2rad(lon2 - lon1);

  // Haversine distance
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  const km = EARTH_R_KM * c;

  // Initial bearing (clockwise from north)
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const bearing = ((rad2deg(Math.atan2(y, x)) % 360) + 360) % 360;

  return {
    km: km,
    nm: km / KM_PER_NM,
    mi: km / KM_PER_MI,
    bearingDeg: bearing
  };
}

/** Compass point (16-wind) for a bearing. */
function compassPoint(bearing) {
  const pts = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return pts[Math.round(bearing / 22.5) % 16];
}
// ENGINE-END

/* ---------- UI ---------- */
const $ = (id) => document.getElementById(id);

function drawSketch(lat1, lon1, lat2, lon2, bearing) {
  const cv = $('sketch');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  // Project lon/lat linearly for a rough sketch (equirectangular, aspect-corrected)
  const lats = [lat1, lat2], lons = [lon1, lon2];
  const minLat = Math.min(...lats) - 2, maxLat = Math.max(...lats) + 2;
  const minLon = Math.min(...lons) - 2, maxLon = Math.max(...lons) + 2;
  const spanLat = Math.max(0.5, maxLat - minLat), spanLon = Math.max(0.5, maxLon - minLon);
  const midLat = (minLat + maxLat) / 2;
  const kx = 1, ky = Math.cos(deg2rad(midLat)) || 1;
  const px = (lon) => 24 + ((lon - minLon) / spanLon) * (W - 48);
  const py = (lat) => (H - 24) - ((lat - minLat) / spanLat) * (H - 48);
  void kx; void ky;

  // Route arc (quadratic curve bowed perpendicular)
  const x1 = px(lon1), y1 = py(lat1), x2 = px(lon2), y2 = py(lat2);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(28, len * 0.18);
  const qx = mx - (dy / len) * bow, qy = my + (dx / len) * bow;

  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([7, 5]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(qx, qy, x2, y2); ctx.stroke();
  ctx.setLineDash([]);

  // Endpoints
  const dot = (x, y, label) => {
    ctx.fillStyle = '#a78bfa';
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eef2f7';
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 11);
  };
  dot(x1, y1, 'A');
  dot(x2, y2, 'B');

  // Bearing arrow at A
  const brad = deg2rad(bearing);
  const ax = 14 * Math.sin(brad), ay = -14 * Math.cos(brad);
  ctx.strokeStyle = '#9aa3b2'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + ax, y1 + ay); ctx.stroke();

  ctx.fillStyle = '#9aa3b2';
  ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('bearing ' + Math.round(bearing) + '° ' + compassPoint(bearing), (x1 + x2) / 2, H - 8);
}

function measure() {
  const lat1 = parseFloat($('lat1').value), lon1 = parseFloat($('lon1').value);
  const lat2 = parseFloat($('lat2').value), lon2 = parseFloat($('lon2').value);
  const r = measureRoute(lat1, lon1, lat2, lon2);

  if (!r) {
    $('nm').textContent = '—';
    $('kmm').textContent = '—';
    $('brg').textContent = '—';
    $('summary').textContent = 'Check inputs: latitude ±90, longitude ±180.';
    return;
  }

  $('nm').textContent = r.nm.toFixed(1) + ' nm';
  $('kmm').textContent = r.km.toFixed(1) + ' km · ' + r.mi.toFixed(1) + ' mi';
  $('brg').textContent = Math.round(r.bearingDeg) + '° ' + compassPoint(r.bearingDeg);
  $('summary').textContent =
    'From ' + lat1 + ', ' + lon1 + ' to ' + lat2 + ', ' + lon2 + ': ' +
    r.nm.toFixed(1) + ' nm (' + r.km.toFixed(1) + ' km) on an initial bearing of ' +
    Math.round(r.bearingDeg) + '°.';

  drawSketch(lat1, lon1, lat2, lon2, r.bearingDeg);
  try { chrome.storage.local.set({ cd_lat1: lat1, cd_lon1: lon1, cd_lat2: lat2, cd_lon2: lon2 }); } catch (e) { /* storage unavailable */ }
}

document.addEventListener('DOMContentLoaded', () => {
  $('calc').addEventListener('click', measure);
  try {
    chrome.storage.local.get(['cd_lat1', 'cd_lon1', 'cd_lat2', 'cd_lon2'], (v) => {
      if (v.cd_lat1 != null) $('lat1').value = v.cd_lat1;
      if (v.cd_lon1 != null) $('lon1').value = v.cd_lon1;
      if (v.cd_lat2 != null) $('lat2').value = v.cd_lat2;
      if (v.cd_lon2 != null) $('lon2').value = v.cd_lon2;
      if (v.cd_lat1 != null && v.cd_lat2 != null) measure();
    });
  } catch (e) { /* no storage */ }
});
