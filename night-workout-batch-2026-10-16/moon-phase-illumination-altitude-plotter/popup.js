/* Moon Phase & Altitude — popup logic + low-precision lunar engine (fully local). */
"use strict";

// // ENGINE-START // — pure functions, headless-testable.
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const SYNODIC = 29.530588853;                 // synodic month, days
const NEW_MOON_REF = 2451550.1;               // JD of 2000-01-06 18:14 UTC (a new moon)

function julianDate(d) { return d.getTime() / 86400000 + 2440587.5; }

// Moon age in days [0, SYNODIC).
function moonAge(jd) {
  const days = jd - NEW_MOON_REF;
  return ((days % SYNODIC) + SYNODIC) % SYNODIC;
}

// Fraction of disc illuminated [0,1].
function illumination(age) {
  return (1 - Math.cos((age / SYNODIC) * 2 * Math.PI)) / 2;
}

// Phase name from age in days.
function phaseName(age) {
  const p = age / SYNODIC;
  if (p < 0.0339 || p >= 0.9661) return "New Moon";
  if (p < 0.2161) return "Waxing Crescent";
  if (p < 0.2839) return "First Quarter";
  if (p < 0.4661) return "Waxing Gibbous";
  if (p < 0.5339) return "Full Moon";
  if (p < 0.7161) return "Waning Gibbous";
  if (p < 0.7839) return "Last Quarter";
  return "Waning Crescent";
}

// Low-precision geocentric lunar RA/Dec (Paul Schlyter), degrees. Good to ~arcminutes.
function moonRaDec(jd) {
  const d = jd - 2451543.5;
  const rev = (x) => ((x % 360) + 360) % 360;
  const N = rev(125.1228 - 0.0529538083 * d);
  const i = 5.1454;
  const w = rev(318.0634 + 0.1643573223 * d);
  const a = 60.2666, e = 0.054900;
  const M = rev(115.3654 + 13.0649929509 * d);

  // Solve Kepler (one iteration, degrees)
  const E = M + e * R2D * Math.sin(M * D2R) * (1 + e * Math.cos(M * D2R));
  const xv = a * (Math.cos(E * D2R) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E * D2R);
  const v = Math.atan2(yv, xv) * R2D;
  const r = Math.sqrt(xv * xv + yv * yv);

  const xh = r * (Math.cos(N * D2R) * Math.cos((v + w) * D2R) - Math.sin(N * D2R) * Math.sin((v + w) * D2R) * Math.cos(i * D2R));
  const yh = r * (Math.sin(N * D2R) * Math.cos((v + w) * D2R) + Math.cos(N * D2R) * Math.sin((v + w) * D2R) * Math.cos(i * D2R));
  const zh = r * Math.sin((v + w) * D2R) * Math.sin(i * D2R);
  let lon = rev(Math.atan2(yh, xh) * R2D);
  let lat = Math.atan2(zh, Math.sqrt(xh * xh + yh * yh)) * R2D;

  // Major perturbation terms
  const Ms = rev(356.0470 + 0.9856002585 * d);
  const Lm = rev(N + w + M);
  const ws = rev(282.9404 + 4.70935e-5 * d);
  const Ls = rev(ws + Ms);
  const Dm = rev(Lm - Ls);
  const F = rev(Lm - N);
  lon += -1.274 * Math.sin((M - 2 * Dm) * D2R) + 0.658 * Math.sin(2 * Dm * D2R)
       - 0.186 * Math.sin(Ms * D2R) - 0.059 * Math.sin((2 * M - 2 * Dm) * D2R)
       - 0.057 * Math.sin((M - 2 * Dm + Ms) * D2R);
  lat += -0.173 * Math.sin((F - 2 * Dm) * D2R) - 0.055 * Math.sin((M - F - 2 * Dm) * D2R)
       - 0.046 * Math.sin((M + F - 2 * Dm) * D2R) + 0.033 * Math.sin((F + 2 * Dm) * D2R)
       + 0.017 * Math.sin((2 * M + F) * D2R);
  const distER = r - 0.58 * Math.cos((M - 2 * Dm) * D2R) - 0.46 * Math.cos(2 * Dm * D2R);

  // Ecliptic -> equatorial
  const ecl = 23.4393 - 3.563e-7 * d;
  const xe = Math.cos(lon * D2R) * Math.cos(lat * D2R);
  const ye = Math.sin(lon * D2R) * Math.cos(lat * D2R);
  const ze = Math.sin(lat * D2R);
  const xr = xe;
  const yr = ye * Math.cos(ecl * D2R) - ze * Math.sin(ecl * D2R);
  const zr = ye * Math.sin(ecl * D2R) + ze * Math.cos(ecl * D2R);
  const ra = rev(Math.atan2(yr, xr) * R2D);
  const dec = Math.atan2(zr, Math.sqrt(xr * xr + yr * yr)) * R2D;
  return { raDeg: ra, decDeg: dec, distER };
}

function gmstDeg(jd) {
  const T = (jd - 2451545.0) / 36525;
  let g = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000;
  g = g % 360;
  return g < 0 ? g + 360 : g;
}

function lstHours(jd, lon) {
  let h = (gmstDeg(jd) + lon) / 15;
  h = h % 24;
  return h < 0 ? h + 24 : h;
}

// Altitude + azimuth (degrees, az from north, eastward) for ra/dec.
function altAz(raDeg, decDeg, latD, jd, lon) {
  const ha = (lstHours(jd, lon) - raDeg / 15) * 15 * D2R;
  const dec = decDeg * D2R, lat = latD * D2R;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) * R2D;
  if (Math.sin(ha) > 0) az = 360 - az;
  return { alt: alt * R2D, az };
}

function compass(az) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(az / 45) % 8];
}
// // ENGINE-END //

const $ = (id) => document.getElementById(id);

function drawMoon(phase) {
  const cv = $("moonCanvas"), ctx = cv.getContext("2d");
  const cx = 60, cy = 60, r = 52;
  ctx.clearRect(0, 0, 120, 120);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#1a1d29"; ctx.fill();
  const c = Math.cos(2 * Math.PI * phase);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = "#e8eaf2";
  if (phase < 0.5) {          // waxing: right limb lit
    ctx.fillRect(cx, cy - r, r, 2 * r);
    ctx.fillStyle = c > 0 ? "#1a1d29" : "#e8eaf2";
  } else {                    // waning: left limb lit
    ctx.fillRect(cx - r, cy - r, r, 2 * r);
    ctx.fillStyle = c > 0 ? "#e8eaf2" : "#1a1d29";
  }
  ctx.beginPath(); ctx.ellipse(cx, cy, r * Math.abs(c), r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function compute() {
  const lat = parseFloat($("lat").value), lon = parseFloat($("lon").value);
  if (!(Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) {
    $("phaseName").textContent = "Enter a valid lat/lon.";
    return;
  }
  const whenStr = $("when").value;
  if (!whenStr) { $("phaseName").textContent = "Pick a time."; return; }
  chrome.storage.local.set({ moon_lat: lat, moon_lon: lon });

  const when = new Date(whenStr);
  const jd = julianDate(when);
  const age = moonAge(jd);
  const illum = illumination(age);
  const name = phaseName(age);
  const { raDeg, decDeg, distER } = moonRaDec(jd);
  const { alt, az } = altAz(raDeg, decDeg, lat, jd, lon);

  $("phaseName").textContent = name;
  $("illum").textContent = Math.round(illum * 100) + "% illuminated";
  $("age").textContent = "Age " + age.toFixed(1) + " days";
  $("alt").textContent = alt.toFixed(1) + "°";
  $("az").textContent = az.toFixed(0) + "° " + compass(az);
  $("dist").textContent = Math.round(distER * 6378.1).toLocaleString() + " km";
  drawMoon(age / SYNODIC);
}

document.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  $("when").value = now.toISOString().slice(0, 16);
  chrome.storage.local.get(["moon_lat", "moon_lon"], (r) => {
    if (r.moon_lat !== undefined) $("lat").value = r.moon_lat;
    if (r.moon_lon !== undefined) $("lon").value = r.moon_lon;
  });
  $("calcBtn").addEventListener("click", compute);
  $("nowBtn").addEventListener("click", () => {
    const n = new Date();
    n.setMinutes(n.getMinutes() - n.getTimezoneOffset());
    $("when").value = n.toISOString().slice(0, 16);
    compute();
  });
});
