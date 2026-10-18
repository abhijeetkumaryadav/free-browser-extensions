'use strict';
/* Great-Circle Flight Path Plotter — popup logic + testable engine.
 * ENGINE: pure spherical math between ENGINE-START / ENGINE-END. */

// ENGINE-START
const R_KM = 6371;           // mean Earth radius, km
const KM_PER_NM = 1.852;

function deg2rad(d) { return d * Math.PI / 180; }
function rad2deg(r) { return r * 180 / Math.PI; }

/* Validate a lat/lon pair. Returns null if invalid. */
function validPoint(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/* Haversine distance in km between two lat/lon points. */
function haversineKm(a, b) {
  const dLat = deg2rad(b.lat - a.lat);
  const dLon = deg2rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(deg2rad(a.lat)) * Math.cos(deg2rad(b.lat)) *
            Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/* Initial bearing in degrees (0–360) from a to b. */
function initialBearing(a, b) {
  const y = Math.sin(deg2rad(b.lon - a.lon)) * Math.cos(deg2rad(b.lat));
  const x = Math.cos(deg2rad(a.lat)) * Math.sin(deg2rad(b.lat)) -
            Math.sin(deg2rad(a.lat)) * Math.cos(deg2rad(b.lat)) *
            Math.cos(deg2rad(b.lon - a.lon));
  return (rad2deg(Math.atan2(y, x)) + 360) % 360;
}

/* N+1 interpolated great-circle waypoints (spherical linear interpolation). */
function greatCirclePath(a, b, segments = 40) {
  const p0 = [deg2rad(90 - a.lat), deg2rad(a.lon)];
  const p1 = [deg2rad(90 - b.lat), deg2rad(b.lon)];
  const [th0, ph0] = p0, [th1, ph1] = p1;
  const cosD = Math.min(1, Math.max(-1,
    Math.cos(th0) * Math.cos(th1) + Math.sin(th0) * Math.sin(th1) * Math.cos(ph1 - ph0)));
  const d = Math.acos(cosD);
  if (d < 1e-9) return Array.from({ length: segments + 1 }, () => ({ lat: a.lat, lon: a.lon }));
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.sin(th0) * Math.cos(ph0) + B * Math.sin(th1) * Math.cos(ph1);
    const y = A * Math.sin(th0) * Math.sin(ph0) + B * Math.sin(th1) * Math.sin(ph1);
    const z = A * Math.cos(th0) + B * Math.cos(th1);
    pts.push({ lat: 90 - rad2deg(Math.acos(Math.min(1, Math.max(-1, z)))),
               lon: ((rad2deg(Math.atan2(y, x)) + 540) % 360) - 180 });
  }
  return pts;
}

function kmToNm(km) { return km / KM_PER_NM; }
function fmtKm(km) { return km.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' km'; }
function fmtNm(km) { return kmToNm(km).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' nm'; }
function fmtBearing(b) { return b.toFixed(1) + '°'; }
// ENGINE-END

const INPUTS_KEY = 'gcp_inputs';

// Plot the route: validate, compute, draw on canvas, persist inputs.
async function plot() {
  const err = document.getElementById('err');
  const a = validPoint(parseFloat(v('lat1')), parseFloat(v('lon1')));
  const b = validPoint(parseFloat(v('lat2')), parseFloat(v('lon2')));
  err.hidden = true;
  if (!a || !b) {
    err.textContent = 'Enter valid coordinates (lat −90…90, lon −180…180).';
    err.hidden = false;
    return;
  }
  const km = haversineKm(a, b);
  const brg = initialBearing(a, b);
  document.getElementById('dist').textContent = fmtKm(km) + ' / ' + fmtNm(km);
  document.getElementById('brg').textContent = fmtBearing(brg);
  document.getElementById('results').hidden = false;
  drawMap(a, b, greatCirclePath(a, b));
  chrome.storage.local.set({ [INPUTS_KEY]: { a, b } });
}

function v(id) { return document.getElementById(id).value; }

// Simple equirectangular map sketch with the great-circle path.
function drawMap(a, b, path) {
  const cv = document.getElementById('map');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0d0d14';
  ctx.fillRect(0, 0, W, H);
  const X = lon => (lon + 180) / 360 * W;
  const Y = lat => (90 - lat) / 180 * H;
  // graticule
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.lineWidth = 1;
  for (let lon = -150; lon <= 150; lon += 30) { ctx.beginPath(); ctx.moveTo(X(lon), 0); ctx.lineTo(X(lon), H); ctx.stroke(); }
  for (let lat = -60; lat <= 60; lat += 30) { ctx.beginPath(); ctx.moveTo(0, Y(lat)); ctx.lineTo(W, Y(lat)); ctx.stroke(); }
  // path
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  let pen = false;
  for (const p of path) {
    // break the stroke across the antimeridian
    if (pen && Math.abs(p.lon - prevLon) > 180) pen = false;
    pen ? ctx.lineTo(X(p.lon), Y(p.lat)) : ctx.moveTo(X(p.lon), Y(p.lat));
    pen = true; var prevLon = p.lon;
  }
  ctx.stroke();
  // endpoints
  for (const p of [a, b]) {
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.arc(X(p.lon), Y(p.lat), 5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#0b0b10'; ctx.lineWidth = 2; ctx.stroke();
  }
}

// Wire up UI and restore last inputs.
async function init() {
  document.getElementById('plot').addEventListener('click', plot);
  const { [INPUTS_KEY]: saved } = await chrome.storage.local.get(INPUTS_KEY);
  if (saved) {
    document.getElementById('lat1').value = saved.a.lat;
    document.getElementById('lon1').value = saved.a.lon;
    document.getElementById('lat2').value = saved.b.lat;
    document.getElementById('lon2').value = saved.b.lon;
    plot();
  }
}

init();
