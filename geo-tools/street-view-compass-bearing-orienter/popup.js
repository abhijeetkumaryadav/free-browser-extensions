/* BearingPoint — initial bearing + distance between two lat/lng points.
   Honest scope: pure geodesic math rendered on a local canvas. Not Street View. */
'use strict';

const $ = (id) => document.getElementById(id);
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/** Initial great-circle bearing, degrees clockwise from north (0–360). */
function initialBearing(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Haversine distance in km. */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dφ = toRad(lat2 - lat1), dλ = toRad(lon2 - lon1);
  const a = Math.sin(dφ / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 16-wind compass direction. */
function compass16(b) {
  const names = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return names[Math.round(b / 22.5) % 16];
}

function parseCoord(v, isLat) {
  const n = parseFloat(String(v).trim().replace(',', '.'));
  if (!Number.isFinite(n)) throw new Error('Enter numeric coordinates.');
  if (isLat && (n < -90 || n > 90)) throw new Error('Latitude must be between -90 and 90.');
  if (!isLat && (n < -180 || n > 180)) throw new Error('Longitude must be between -180 and 180.');
  return n;
}

/* ---------- Animated compass dial ---------- */
const dial = $('dial');
const ctx = dial.getContext('2d');
let anim = { from: 0, to: 0, start: 0, dur: 900, raf: 0 };

const ACCENT = '#f97316';

function drawDial(bearingDeg) {
  const W = dial.width, H = dial.height, cx = W / 2, cy = H / 2, R = W / 2 - 14;
  ctx.clearRect(0, 0, W, H);

  // face
  const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
  g.addColorStop(0, 'rgba(40,44,54,.9)');
  g.addColorStop(1, 'rgba(16,18,24,.95)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

  // tick ring + cardinal labels
  const cardinals = ['N', 'E', 'S', 'W'];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 72; i++) {
    const a = (i * 5 * Math.PI) / 180;
    const major = i % 18 === 0;
    const r1 = R - (major ? 14 : 7), r2 = R - 3;
    ctx.strokeStyle = major ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.18)';
    ctx.lineWidth = major ? 2.5 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + r1 * Math.sin(a), cy - r1 * Math.cos(a));
    ctx.lineTo(cx + r2 * Math.sin(a), cy - r2 * Math.cos(a));
    ctx.stroke();
  }
  ctx.font = '700 20px -apple-system, Segoe UI, sans-serif';
  cardinals.forEach((c, i) => {
    const a = (i * 90 * Math.PI) / 180;
    const rr = R - 30;
    ctx.fillStyle = c === 'N' ? ACCENT : 'rgba(232,234,240,.85)';
    ctx.fillText(c, cx + rr * Math.sin(a), cy - rr * Math.cos(a));
  });
  ctx.font = '600 11px -apple-system, Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(154,160,174,.9)';
  for (let i = 0; i < 12; i++) {
    if (i % 3 === 0) continue; // cardinals already drawn
    const a = (i * 30 * Math.PI) / 180;
    ctx.fillText(String(i * 30), cx + (R - 30) * Math.sin(a), cy - (R - 30) * Math.cos(a));
  }

  // bearing needle (rotates with animation value)
  const b = (bearingDeg * Math.PI) / 180;
  const nx = Math.sin(b), ny = -Math.cos(b);
  // needle shadow/glow
  ctx.save();
  ctx.shadowColor = ACCENT; ctx.shadowBlur = 14;
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.moveTo(cx + nx * (R - 46), cy + ny * (R - 46));      // tip
  ctx.lineTo(cx - ny * 9, cy + nx * 9);
  ctx.lineTo(cx - nx * 22, cy - ny * 22);                   // tail
  ctx.lineTo(cx + ny * 9, cy - nx * 9);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // hub
  ctx.fillStyle = '#0b0d12';
  ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ACCENT; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = ACCENT;
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();

  // bearing readout under hub
  ctx.font = '700 16px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#e8eaf0';
  ctx.fillText(bearingDeg.toFixed(1) + '°', cx, cy + 44);
}

function animateTo(target) {
  // shortest-path easing from current displayed angle
  cancelAnimationFrame(anim.raf);
  let from = ((anim.to % 360) + 360) % 360;
  let to = ((target % 360) + 360) % 360;
  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  anim = { from, to: from + delta, start: performance.now(), dur: 900, raf: 0 };
  const step = (now) => {
    const t = Math.min(1, (now - anim.start) / anim.dur);
    const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
    const cur = anim.from + (anim.to - anim.from) * e;
    drawDial(((cur % 360) + 360) % 360);
    if (t < 1) anim.raf = requestAnimationFrame(step);
  };
  anim.raf = requestAnimationFrame(step);
}

drawDial(0);

/* ---------- Actions ---------- */
function showErr(msg) {
  const el = $('err');
  el.textContent = msg;
  el.hidden = false;
}
function hideErr() { $('err').hidden = true; }

$('btn-calc').addEventListener('click', async () => {
  hideErr();
  try {
    const fLat = parseCoord($('from-lat').value, true);
    const fLng = parseCoord($('from-lng').value, false);
    const tLat = parseCoord($('to-lat').value, true);
    const tLng = parseCoord($('to-lng').value, false);
    if (fLat === tLat && fLng === tLng) throw new Error('From and To are the same point.');

    const b = initialBearing(fLat, fLng, tLat, tLng);
    const d = haversine(fLat, fLng, tLat, tLng);

    $('out-bearing').textContent = b.toFixed(1) + '°';
    $('out-dir').textContent = compass16(b);
    $('out-dist').textContent = d < 10 ? (d * 1000).toFixed(0) + ' m' : d.toFixed(1) + ' km';
    $('dial-panel').hidden = false;
    animateTo(b);

    await chrome.storage.local.set({ lastBearing: { fLat, fLng, tLat, tLng } });
  } catch (e) { showErr(e.message); }
});

$('btn-swap').addEventListener('click', () => {
  const a = [$('from-lat').value, $('from-lng').value];
  $('from-lat').value = $('to-lat').value;
  $('from-lng').value = $('to-lng').value;
  $('to-lat').value = a[0];
  $('to-lng').value = a[1];
});

/* ---------- Restore ---------- */
(async () => {
  try {
    const s = await chrome.storage.local.get('lastBearing');
    if (s.lastBearing) {
      const v = s.lastBearing;
      $('from-lat').value = v.fLat; $('from-lng').value = v.fLng;
      $('to-lat').value = v.tLat; $('to-lng').value = v.tLng;
    }
  } catch { /* ignore */ }
})();
