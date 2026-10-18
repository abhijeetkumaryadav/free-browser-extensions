'use strict';
/* PeakPlot — elevation profile chart via the Open-Meteo elevation API (free, no key).
   All network goes to api.open-meteo.com only. Everything else is local. */

const $ = (id) => document.getElementById(id);
const ELEV_URL = 'https://api.open-meteo.com/v1/elevation';
const ACCENT = '#22c55e';

/** Parse "lat, lng" into [lat, lng] or throw. */
function parseLatLng(text, label) {
  const m = String(text).trim().replace(/[;]/g, ',').split(/[\s,]+/).filter(Boolean);
  if (m.length !== 2) throw new Error(label + ': use "lat, lng" (e.g. 28.6139, 77.2090)');
  const lat = Number(m[0]), lng = Number(m[1]);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error(label + ': latitude must be −90…90');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error(label + ': longitude must be −180…180');
  return [lat, lng];
}

/** Interpolate n evenly spaced points along the great-circle-ish path (linear is fine for a profile). */
function interpolate(a, b, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return pts;
}

/** Haversine distance in km between two [lat,lng] points. */
function haversine(a, b) {
  const R = 6371, dLa = (b[0] - a[0]) * Math.PI / 180, dLo = (b[1] - a[1]) * Math.PI / 180;
  const la1 = a[0] * Math.PI / 180, la2 = b[0] * Math.PI / 180;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function setStatus(msg, isErr) {
  const el = $('status');
  el.textContent = msg;
  el.classList.toggle('err', !!isErr);
}

/** Draw elevation profile with a vertical gradient fill. */
function drawChart(elevs) {
  const c = $('chart'), ctx = c.getContext('2d');
  const W = c.width, H = c.height, padL = 8, padR = 8, padT = 10, padB = 22;
  ctx.clearRect(0, 0, W, H);

  const min = Math.min(...elevs), max = Math.max(...elevs);
  const span = Math.max(max - min, 1);
  const x = (i) => padL + (i / (elevs.length - 1)) * (W - padL - padR);
  const y = (e) => padT + (1 - (e - min) / span) * (H - padT - padB);

  // Gradient fill under the curve
  const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
  grad.addColorStop(0, 'rgba(34,197,94,.55)');
  grad.addColorStop(1, 'rgba(34,197,94,.03)');
  ctx.beginPath();
  ctx.moveTo(x(0), H - padB);
  elevs.forEach((e, i) => ctx.lineTo(x(i), y(e)));
  ctx.lineTo(x(elevs.length - 1), H - padB);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  elevs.forEach((e, i) => (i ? ctx.lineTo(x(i), y(e)) : ctx.moveTo(x(i), y(e))));
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Min/max labels
  ctx.fillStyle = '#9aa3b2';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(Math.round(min) + ' m', padL, H - 8);
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(max) + ' m', W - padR, padT + 2);
  ctx.textAlign = 'left';
}

function updateStats(elevs, distKm) {
  const min = Math.min(...elevs), max = Math.max(...elevs);
  let asc = 0, desc = 0;
  for (let i = 1; i < elevs.length; i++) {
    const d = elevs[i] - elevs[i - 1];
    if (d > 0) asc += d; else desc -= d;
  }
  $('statDist').textContent = distKm.toFixed(1) + ' km';
  $('statMinMax').textContent = Math.round(min) + ' / ' + Math.round(max) + ' m';
  $('statAsc').textContent = '▲ ' + Math.round(asc) + ' m';
  $('statDesc').textContent = '▼ ' + Math.round(desc) + ' m';
}

async function plot() {
  const btn = $('plot');
  try {
    const start = parseLatLng($('start').value, 'Start');
    const end = parseLatLng($('end').value, 'End');
    const n = Number($('samples').value);
    btn.disabled = true;
    setStatus('Fetching elevations…');

    const pts = interpolate(start, end, n);
    const url = ELEV_URL + '?latitude=' + pts.map(p => p[0].toFixed(5)).join(',')
      + '&longitude=' + pts.map(p => p[1].toFixed(5)).join(',');
    const res = await fetch(url);
    if (!res.ok) throw new Error('API returned HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data.elevation) || data.elevation.length !== n) {
      throw new Error('Unexpected API response.');
    }

    drawChart(data.elevation);
    updateStats(data.elevation, haversine(start, end));
    setStatus('Plotted ' + n + ' samples. Data: Open-Meteo.');
    chrome.storage.local.set({ peakplot: { start: $('start').value, end: $('end').value, n } });
  } catch (e) {
    setStatus(e.message || 'Something went wrong.', true);
  } finally {
    btn.disabled = false;
  }
}

$('samples').addEventListener('input', (e) => { $('sampleVal').textContent = e.target.value; });
$('plot').addEventListener('click', plot);
$('plot').addEventListener('keydown', (e) => { if (e.key === 'Enter') plot(); });

// Restore last inputs
chrome.storage.local.get('peakplot', ({ peakplot }) => {
  if (!peakplot) return;
  if (peakplot.start) $('start').value = peakplot.start;
  if (peakplot.end) $('end').value = peakplot.end;
  if (peakplot.n) { $('samples').value = peakplot.n; $('sampleVal').textContent = peakplot.n; }
});
