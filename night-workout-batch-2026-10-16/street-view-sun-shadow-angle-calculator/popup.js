/* Sun Shadow Angle Calculator — popup logic.
   All solar math is pure and testable (see // ENGINE-START … // ENGINE-END). */

// ENGINE-START
'use strict';

/** Degrees ↔ radians helpers. */
const deg2rad = d => d * Math.PI / 180;
const rad2deg = r => r * 180 / Math.PI;

/**
 * NOAA-style solar position. dateMs: UTC milliseconds; lat/lon in degrees.
 * Returns { elevation, azimuth } in degrees. Azimuth: compass, 0=N, 90=E.
 */
function solarPosition(dateMs, lat, lon) {
  const d = dateMs / 86400000 - 10957.5;          // days since J2000.0
  const L = (280.460 + 0.9856474 * d) % 360;      // mean longitude
  const g = deg2rad((357.528 + 0.9856003 * d) % 360); // mean anomaly
  const lambda = deg2rad(L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
  const eps = deg2rad(23.439 - 0.0000004 * d);    // obliquity
  const ra = rad2deg(Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda))) / 15; // hours
  const dec = rad2deg(Math.asin(Math.sin(eps) * Math.sin(lambda)));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const lmst = gmst + lon / 15;
  let H = (lmst - ra) * 15;                       // hour angle, degrees
  H = ((H % 360) + 360) % 360;
  if (H > 180) H -= 360;
  const latR = deg2rad(lat), decR = deg2rad(dec), hR = deg2rad(H);
  const elev = rad2deg(Math.asin(
    Math.sin(latR) * Math.sin(decR) + Math.cos(latR) * Math.cos(decR) * Math.cos(hR)));
  const az = (rad2deg(Math.atan2(Math.sin(hR),
    Math.cos(hR) * Math.sin(latR) - Math.tan(decR) * Math.cos(latR))) + 180 + 360) % 360;
  return { elevation: elev, azimuth: az };
}

/** Shadow length for an object of `height` metres at solar elevation degrees. null when sun is down. */
function shadowLength(height, elevationDeg) {
  if (!(height > 0) || elevationDeg <= 0) return null;
  return height / Math.tan(deg2rad(elevationDeg));
}

/** 16-wind compass label for a compass azimuth. */
function compass16(azimuth) {
  const names = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return names[Math.round(((azimuth % 360) + 360) % 360 / 22.5) % 16];
}

/** Sun points at `azimuth`; the shadow points the opposite way. */
function shadowCompass(azimuth) {
  return compass16((azimuth + 180) % 360);
}

/** Plain-language golden-hour/daylight hint from elevation degrees. */
function goldenHint(elevationDeg) {
  if (elevationDeg < -6)  return 'Night — sun well below horizon';
  if (elevationDeg < 0)   return 'Civil twilight — soft blue light';
  if (elevationDeg < 6)   return 'Golden hour — long shadows, warm light';
  if (elevationDeg < 15)  return 'Low sun — good photo light';
  if (elevationDeg < 45)  return 'Midday-ish — shorter shadows';
  return 'High sun — short shadows';
}

/**
 * Build a UTC timestamp (ms) from wall-clock parts at a UTC offset.
 * If tzOffsetH is null/NaN, the parts are read as the browser's local time.
 */
function wallToUtcMs(y, mo, d, h, mi, tzOffsetH) {
  if (tzOffsetH == null || Number.isNaN(tzOffsetH)) {
    return new Date(y, mo - 1, d, h, mi).getTime();
  }
  return Date.UTC(y, mo - 1, d, h, mi) - tzOffsetH * 3600000;
}

/** Clamp helper used by the UI. */
function clampNum(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}
// ENGINE-END

/* ---------------- UI ---------------- */
const $ = id => document.getElementById(id);
const els = { date: $('inDate'), time: $('inTime'), lat: $('inLat'), lon: $('inLon'),
              height: $('inHeight'), tz: $('inTz'), results: $('results'),
              elev: $('rElev'), az: $('rAz'), shadow: $('rShadow'), dir: $('rDir'),
              day: $('rDay'), golden: $('rGolden'), dial: $('sunDial'), notes: $('notes') };

function defaultInputs() {
  const now = new Date();
  els.date.value = now.toISOString().slice(0, 10);
  els.time.value = String(now.getHours()).padStart(2, '0') + ':' +
                   String(now.getMinutes()).padStart(2, '0');
}

function drawDial(elev, az) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = els.dial;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const mk = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    svg.appendChild(el); return el;
  };
  mk('circle', { cx: 60, cy: 60, r: 52, fill: 'rgba(255,255,255,.04)',
                 stroke: 'rgba(255,255,255,.18)', 'stroke-width': 1.2 });
  mk('circle', { cx: 60, cy: 60, r: 26, fill: 'none',
                 stroke: 'rgba(255,255,255,.10)', 'stroke-width': 1, 'stroke-dasharray': '3 3' });
  [['N', 60, 12], ['E', 108, 60], ['S', 60, 108], ['W', 12, 60]].forEach(([t, x, y]) => {
    const tx = mk('text', { x, y: y + 3, 'text-anchor': 'middle', fill: '#9d9dab', 'font-size': 8 });
    tx.textContent = t;
  });
  const a = deg2rad(az);
  const r = 52;
  const x = 60 + r * Math.sin(a), y = 60 - r * Math.cos(a);
  const up = elev > 0;
  const c = mk('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: up ? 7 : 5,
    fill: up ? '#fbbf24' : 'none', stroke: up ? '#fbbf24' : '#9d9dab',
    'stroke-width': up ? 0 : 1.5, 'stroke-dasharray': up ? '' : '2 2', opacity: up ? .95 : .7 });
  if (up) {
    c.setAttribute('style', 'filter:drop-shadow(0 0 5px rgba(251,191,36,.8))');
    // elevation spokes: dot drifts inward as sun climbs
    const rr = Math.max(8, 52 - elev * 0.9);
    c.setAttribute('cx', (60 + rr * Math.sin(a)).toFixed(1));
    c.setAttribute('cy', (60 - rr * Math.cos(a)).toFixed(1));
  }
}

function calculate() {
  const lat = clampNum(els.lat.value, -90, 90, NaN);
  const lon = clampNum(els.lon.value, -180, 180, NaN);
  const height = clampNum(els.height.value, 0.01, 100000, 1.7);
  if (!els.date.value || !els.time.value || Number.isNaN(lat) || Number.isNaN(lon)) {
    els.az.textContent = 'Fill date, time, lat, lon'; return;
  }
  const [Y, M, D] = els.date.value.split('-').map(Number);
  const [h, m] = els.time.value.split(':').map(Number);
  const tz = els.tz.value === '' ? null : Number(els.tz.value);
  const utcMs = wallToUtcMs(Y, M, D, h, m, tz);
  if (!Number.isFinite(utcMs)) { els.az.textContent = 'Bad date/time'; return; }

  const { elevation, azimuth } = solarPosition(utcMs, lat, lon);
  const len = shadowLength(height, elevation);
  els.elev.textContent = elevation.toFixed(1) + '°';
  els.az.textContent = azimuth.toFixed(1) + '° ' + compass16(azimuth);
  els.shadow.textContent = len == null ? '— (sun below horizon)' : len.toFixed(2) + ' m';
  els.dir.textContent = len == null ? '—' : shadowCompass(azimuth);
  els.day.textContent = elevation > 0 ? 'Day' : 'Night';
  els.golden.textContent = goldenHint(elevation);
  drawDial(elevation, azimuth);
  els.results.hidden = false;
  chrome.storage.local.set({ sunCalc: { date: els.date.value, time: els.time.value,
    lat: els.lat.value, lon: els.lon.value, height: els.height.value, tz: els.tz.value } });
}

function init() {
  defaultInputs();
  chrome.storage.local.get(['sunCalc', 'sunNotes'], r => {
    if (r.sunCalc) { Object.assign(els, {}); 
      els.date.value = r.sunCalc.date || els.date.value;
      els.time.value = r.sunCalc.time || els.time.value;
      els.lat.value = r.sunCalc.lat || ''; els.lon.value = r.sunCalc.lon || '';
      els.height.value = r.sunCalc.height || '1.7'; els.tz.value = r.sunCalc.tz || '';
    }
    if (typeof r.sunNotes === 'string') els.notes.value = r.sunNotes;
  });
  let t;
  els.notes.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => chrome.storage.local.set({ sunNotes: els.notes.value }), 400);
  });
  $('calc').addEventListener('click', calculate);
  [els.date, els.time, els.lat, els.lon, els.height, els.tz].forEach(el =>
    el.addEventListener('keydown', e => { if (e.key === 'Enter') calculate(); }));
  calculate(); // show an initial reading
}
document.addEventListener('DOMContentLoaded', init);
