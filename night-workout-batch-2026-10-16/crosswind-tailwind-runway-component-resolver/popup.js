/* Crosswind Component Resolver — popup logic + headless-testable engine */
'use strict';

// ENGINE-START
function deg2rad(d) { return d * Math.PI / 180; }

/** Normalise degrees into [-180, 180). */
function normAngle(d) {
  d = ((d % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/**
 * Resolve wind into headwind/tailwind and crosswind components.
 * @param {number} rwyHdg  runway heading (deg)
 * @param {number} windDir wind direction, i.e. where the wind comes FROM (deg)
 * @param {number} windSpeed wind speed (kt)
 * @returns {object|null} components, or null for invalid input
 */
function windComponents(rwyHdg, windDir, windSpeed) {
  if (!isFinite(rwyHdg) || !isFinite(windDir) || !isFinite(windSpeed)) return null;
  if (windSpeed < 0 || rwyHdg < 1 || rwyHdg > 360 || windDir < 0 || windDir > 360) return null;
  const diff = normAngle(windDir - rwyHdg); // + = wind from the right of the runway
  const rad = deg2rad(diff);
  const hw = windSpeed * Math.cos(rad);  // + headwind, - tailwind
  const xw = windSpeed * Math.sin(rad);  // + from right, - from left
  return {
    diffDeg: diff,
    headwindKt: hw,
    tailwindKt: -hw,
    crosswindKt: Math.abs(xw),
    crosswindFrom: xw >= 0 ? 'right' : 'left',
    isHeadwind: hw >= 0,
    windSpeedKt: windSpeed
  };
}
// ENGINE-END

/* ---------- UI ---------- */
const $ = (id) => document.getElementById(id);

function drawDiagram(rwyHdg, windDir, windSpeed) {
  const cv = $('diagram');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2 + 10;
  const rwyLen = 120, rwyW = 16;

  // Runway strip (vertical = runway heading pointing up)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(255,255,255,.10)';
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, -rwyW / 2, -rwyLen / 2, rwyW, rwyLen, 4);
  ctx.fill(); ctx.stroke();
  // Centerline dashes
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.moveTo(0, -rwyLen / 2 + 8); ctx.lineTo(0, rwyLen / 2 - 8); ctx.stroke();
  ctx.setLineDash([]);
  // Heading label at top
  ctx.fillStyle = '#9aa3b2';
  ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('RWY ' + String(rwyHdg).padStart(3, '0') + '°', 0, -rwyLen / 2 - 12);
  ctx.restore();

  if (!isFinite(windSpeed) || windSpeed <= 0) return;

  // Wind arrow: wind comes FROM direction (windDir - rwyHdg) relative to runway-up.
  const rel = deg2rad(normAngle(windDir - rwyHdg));
  const startR = 78;
  const sx = cx + Math.sin(rel) * startR;
  const sy = cy - Math.cos(rel) * startR;
  const ex = cx + Math.sin(rel) * 26;
  const ey = cy - Math.cos(rel) * 26;

  ctx.strokeStyle = '#38bdf8';
  ctx.fillStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  // Arrowhead at the end (pointing toward runway)
  const ang = Math.atan2(ey - sy, ex - sx);
  const head = 10;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - head * Math.cos(ang - Math.PI / 7), ey - head * Math.sin(ang - Math.PI / 7));
  ctx.lineTo(ex - head * Math.cos(ang + Math.PI / 7), ey - head * Math.sin(ang + Math.PI / 7));
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#9aa3b2';
  ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(Math.round(windSpeed) + ' kt from ' + String(Math.round(windDir)).padStart(3, '0') + '°', cx, H - 8);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function calculate() {
  const rwy = parseFloat($('rwy').value);
  const wdir = parseFloat($('wdir').value);
  const wspd = parseFloat($('wspd').value);
  const r = windComponents(rwy, wdir, wspd);

  if (!r) {
    $('hw').textContent = '—';
    $('xw').textContent = '—';
    $('summary').textContent = 'Check inputs: runway 1–360°, wind 0–360°, speed ≥ 0.';
    return;
  }

  const hwTxt = r.isHeadwind
    ? r.headwindKt.toFixed(1) + ' kt headwind'
    : r.tailwindKt.toFixed(1) + ' kt tailwind';
  $('hw').textContent = hwTxt;
  $('xw').textContent = r.crosswindKt.toFixed(1) + ' kt from ' + r.crosswindFrom;
  $('summary').textContent =
    'Wind ' + Math.round(wspd) + ' kt from ' + Math.round(wdir) + '°, ' +
    Math.abs(Math.round(r.diffDeg)) + '° off runway ' + Math.round(rwy) + '°. ' +
    (r.crosswindKt < 0.05 ? 'Aligned — negligible crosswind.' : 'Crosswind from the ' + r.crosswindFrom + '.');

  drawDiagram(rwy, wdir, wspd);
  try { chrome.storage.local.set({ xw_rwy: rwy, xw_wdir: wdir, xw_wspd: wspd }); } catch (e) { /* storage unavailable */ }
}

document.addEventListener('DOMContentLoaded', () => {
  $('calc').addEventListener('click', calculate);
  // Restore last inputs
  try {
    chrome.storage.local.get(['xw_rwy', 'xw_wdir', 'xw_wspd'], (v) => {
      if (v.xw_rwy != null) $('rwy').value = v.xw_rwy;
      if (v.xw_wdir != null) $('wdir').value = v.xw_wdir;
      if (v.xw_wspd != null) $('wspd').value = v.xw_wspd;
      calculate();
    });
  } catch (e) { calculate(); }
});
