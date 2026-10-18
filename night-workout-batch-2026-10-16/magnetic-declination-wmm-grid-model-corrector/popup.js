'use strict';

// ================= ENGINE-START =================
// Pure declination math. Declination d is in degrees, EAST POSITIVE.
//   magnetic = norm(true - d)
//   true     = norm(magnetic + d)
// Bearings are kept in [0, 360). "360" is normalized to 0.

function normDeg(v) {
  if (!Number.isFinite(v)) return null;
  const r = v % 360;
  return r < 0 ? r + 360 : r;
}

function validDecl(d) {
  // Real-world declination is within about ±30°.
  return Number.isFinite(d) && d >= -30 && d <= 30;
}

function validBearing(b) {
  return Number.isFinite(b) && b >= 0 && b <= 360;
}

// True bearing + declination -> magnetic bearing.
function trueToMagnetic(trueDeg, declEast) {
  if (!validBearing(trueDeg) || !validDecl(declEast)) return null;
  return normDeg(trueDeg - declEast);
}

// Magnetic bearing + declination -> true bearing.
function magneticToTrue(magDeg, declEast) {
  if (!validBearing(magDeg) || !validDecl(declEast)) return null;
  return normDeg(magDeg + declEast);
}

// 16-wind compass point for a bearing.
function compassPoint(b) {
  const pts = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const norm = normDeg(b);
  if (norm === null) return null;
  return pts[Math.round(norm / 22.5) % 16];
}

function fmtDeg(b) {
  if (b === null) return '—';
  // snap 359.9999... to 0
  const snapped = Math.abs(b - 360) < 1e-9 || b < 1e-9 ? 0 : b;
  return snapped.toFixed(1) + '°';
}
// ================= ENGINE-END =================

const declEl = document.getElementById('decl');
const bearingEl = document.getElementById('bearing');
const t2mEl = document.getElementById('t2m');
const m2tEl = document.getElementById('m2t');
const cpEl = document.getElementById('cp');

const STORE_KEY = 'declination-settings';

function update() {
  const d = parseFloat(declEl.value);
  const b = parseFloat(bearingEl.value);
  const t2m = trueToMagnetic(b, d);
  const m2t = magneticToTrue(b, d);
  t2mEl.textContent = fmtDeg(t2m);
  m2tEl.textContent = fmtDeg(m2t);
  cpEl.textContent = compassPoint(b) || '—';
  chrome.storage.local.set({ [STORE_KEY]: { decl: declEl.value, bearing: bearingEl.value } }).catch(() => {});
}

[declEl, bearingEl].forEach(el => el.addEventListener('input', update));

chrome.storage.local.get(STORE_KEY).then(res => {
  const s = res[STORE_KEY];
  if (s) {
    if (s.decl !== undefined) declEl.value = s.decl;
    if (s.bearing !== undefined) bearingEl.value = s.bearing;
  }
  update();
}).catch(update);

update();
