/* RA/Dec <-> Alt/Az converter — real spherical-astronomy math. */
"use strict";
/* ---------- engine (headless-testable) ---------- */
// ENGINE-START
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
/** Julian date from ms epoch */
function julianDate(ms) { return ms / 86400000 + 2440587.5; }
/** GMST in degrees (IAU low-precision) */
function gmstDeg(ms) {
  const d = julianDate(ms) - 2451545.0;
  return (280.46061837 + 360.98564736629 * d) % 360;
}
/** LST in degrees for longitude east */
function lstDeg(ms, lonEast) { return (gmstDeg(ms) + lonEast + 360) % 360; }
/** RA h/m/s -> degrees (wraps) */
function raToDeg(h, m, s) { return ((h * 15 + m * 0.25 + s / 240) % 360 + 360) % 360; }
/** Dec d/m/s -> degrees */
function decToDeg(d, m, s) { const sign = d < 0 || Object.is(-0, d) ? -1 : 1; return sign * (Math.abs(d) + m / 60 + s / 3600); }
/** Equatorial -> horizontal. Returns {altDeg, azDeg(N->E), haDeg} */
function equatorialToHorizontal(raDeg, decDeg, latDeg, lonEastDeg, ms) {
  const lst = lstDeg(ms, lonEastDeg);
  let ha = (lst - raDeg + 540) % 360 - 180; // hour angle, -180..180
  const haR = ha * D2R, decR = decDeg * D2R, latR = latDeg * D2R;
  const sinAlt = Math.sin(decR) * Math.sin(latR) + Math.cos(decR) * Math.cos(latR) * Math.cos(haR);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * R2D;
  let az = Math.atan2(Math.sin(haR), Math.cos(haR) * Math.sin(latR) - Math.tan(decR) * Math.cos(latR)) * R2D;
  az = (az + 180 + 360) % 360;
  return { altDeg: alt, azDeg: az, haDeg: ha, lstDeg: lst };
}
/** Horizontal -> equatorial. Returns {raDeg, decDeg} */
function horizontalToEquatorial(altDeg, azDeg, latDeg, lonEastDeg, ms) {
  const altR = altDeg * D2R, latR = latDeg * D2R, azR = azDeg * D2R;
  // A measured from north going east; verified against vector-rotation derivation:
  // sin dec = cos(alt) cos(A) cos(lat) + sin(alt) sin(lat)
  const sinDec = Math.cos(altR) * Math.cos(azR) * Math.cos(latR) + Math.sin(altR) * Math.sin(latR);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec))) * R2D;
  const decR = dec * D2R;
  const sinH = -Math.sin(azR) * Math.cos(altR) / Math.cos(decR);
  const cosH = (Math.sin(altR) - Math.sin(latR) * Math.sin(decR)) / (Math.cos(latR) * Math.cos(decR));
  // At the celestial pole RA is undefined — return 0 there.
  if (Math.abs(dec) > 89.999) return { raDeg: 0, decDeg: dec };
  let ha = Math.atan2(Math.max(-1, Math.min(1, sinH)), Math.max(-1, Math.min(1, cosH))) * R2D;
  const lst = lstDeg(ms, lonEastDeg);
  const ra = ((lst - ha + 360) % 360 + 360) % 360;
  return { raDeg: ra, decDeg: dec };
}
/** Parse "hh mm ss" or "hh:mm:ss" or decimal hours */
function parseRA(txt) {
  const t = txt.trim().replace(/:/g, " ").split(/\s+/).map(Number);
  if (t.some(isNaN)) return null;
  if (t.length === 1) return (t[0] * 15 % 360 + 360) % 360;
  if (t.length !== 3) return null;
  return raToDeg(t[0], t[1], t[2]);
}
/** Parse "±dd mm ss" or decimal degrees */
function parseDec(txt) {
  const t = txt.trim().replace(/:/g, " ").split(/\s+/).map(Number);
  if (t.some(isNaN)) return null;
  if (t.length === 1) { const v = t[0]; return v >= -90 && v <= 90 ? v : null; }
  if (t.length !== 3) return null;
  const v = decToDeg(t[0], t[1], t[2]);
  return v >= -90 && v <= 90 ? v : null;
}
function fmtHMS(deg) { const h = deg / 15, H = Math.floor(h), M = Math.floor((h - H) * 60), S = ((h - H) * 3600 - M * 60).toFixed(1); return `${H}h ${M}m ${S}s`; }
function fmtDMS(deg) { const s = deg < 0 ? "−" : "+", a = Math.abs(deg), D = Math.floor(a), M = Math.floor((a - D) * 60), S = ((a - D) * 3600 - M * 60).toFixed(1); return `${s}${D}° ${M}′ ${S}″`; }
// ENGINE-END
/* ---------- UI ---------- */
const $ = id => document.getElementById(id);
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
  b.classList.add("active");
  $("tab-radec").classList.toggle("hidden", b.dataset.tab !== "radec");
  $("tab-altaz").classList.toggle("hidden", b.dataset.tab !== "altaz");
}));
function nowLocal() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
$("dt").value = nowLocal(); $("dt2").value = nowLocal();
chrome.storage.local.get(["lat", "lon"], r => { if (r.lat != null) { $("lat").value = r.lat; $("lat2").value = r.lat; } if (r.lon != null) { $("lon").value = r.lon; $("lon2").value = r.lon; } });
$("go1").addEventListener("click", () => {
  const ra = parseRA($("ra").value), dec = parseDec($("dec").value);
  const lat = +$("lat").value, lon = +$("lon").value, ms = new Date($("dt").value).getTime();
  const out = $("out1");
  if (ra == null || dec == null || isNaN(lat) || isNaN(ms)) { out.classList.add("show"); out.innerHTML = "Check your inputs — RA/Dec format and location."; return; }
  chrome.storage.local.set({ lat, lon });
  const r = equatorialToHorizontal(ra, dec, lat, lon, ms);
  out.classList.add("show");
  out.innerHTML = `<b>Altitude:</b> ${r.altDeg.toFixed(2)}° &nbsp; <b>Azimuth:</b> ${r.azDeg.toFixed(2)}°<br>` +
    `<b>Hour angle:</b> ${r.haDeg.toFixed(2)}° &nbsp; <b>LST:</b> ${fmtHMS(r.lstDeg)}<br>` +
    (r.altDeg > 0 ? '<span class="vis">● Above the horizon</span>' : '<span class="nvis">● Below the horizon</span>');
});
$("go2").addEventListener("click", () => {
  const alt = +$("alt").value, az = +$("az").value;
  const lat = +$("lat2").value, lon = +$("lon2").value, ms = new Date($("dt2").value).getTime();
  const out = $("out2");
  if (isNaN(alt) || isNaN(az) || isNaN(lat) || isNaN(ms)) { out.classList.add("show"); out.innerHTML = "Check your inputs."; return; }
  chrome.storage.local.set({ lat, lon });
  const r = horizontalToEquatorial(alt, az, lat, lon, ms);
  out.classList.add("show");
  out.innerHTML = `<b>RA:</b> ${fmtHMS(r.raDeg)} &nbsp; <b>Dec:</b> ${fmtDMS(r.decDeg)}`;
});
