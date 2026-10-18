/* Radiant Point — popup logic.
 * Bundled meteor-shower table with approximate radiant RA/Dec (J2000).
 * All astronomy math is local spherical-astronomy geometry. */

// ENGINE-START //
const D2R = Math.PI / 180, R2D = 180 / Math.PI;

/* Bundled major showers: radiant RA hours, Dec deg, active window [month,day], peak label, ZHR. */
const SHOWERS = [
  { name: 'Quadrantids',   raH: 15.33, dec:  50, sM: 12, sD: 28, eM: 1, eD: 12, peak: 'Jan 3–4',  zhr: 120 },
  { name: 'Lyrids',        raH: 18.13, dec:  32, sM:  4, sD: 14, eM: 4, eD: 30, peak: 'Apr 21–22', zhr: 18 },
  { name: 'Eta Aquariids', raH: 22.33, dec:  -1, sM:  4, sD: 19, eM: 5, eD: 28, peak: 'May 5–6',  zhr: 50 },
  { name: 'Perseids',      raH:  3.07, dec:  58, sM:  7, sD: 17, eM: 8, eD: 24, peak: 'Aug 12–13', zhr: 100 },
  { name: 'Orionids',      raH:  6.33, dec:  16, sM: 10, sD:  2, eM: 11, eD: 7, peak: 'Oct 21–22', zhr: 20 },
  { name: 'Southern Taurids', raH: 3.67, dec: 14, sM: 9, sD: 10, eM: 11, eD: 20, peak: 'Nov 4–5', zhr: 10 },
  { name: 'Leonids',       raH: 10.13, dec:  22, sM: 11, sD:  6, eM: 11, eD: 30, peak: 'Nov 17–18', zhr: 15 },
  { name: 'Geminids',      raH:  7.47, dec:  33, sM: 12, sD:  4, eM: 12, eD: 20, peak: 'Dec 13–14', zhr: 150 },
  { name: 'Ursids',        raH: 14.47, dec:  75, sM: 12, sD: 17, eM: 12, eD: 26, peak: 'Dec 21–22', zhr: 10 },
];

/** Julian date from a JS Date (UTC). */
function julianDate(d) {
  return d.getTime() / 86400000 + 2440587.5;
}

/** Greenwich Mean Sidereal Time in degrees for a Date. */
function gmstDeg(d) {
  const D = julianDate(d) - 2451545.0;
  let g = (280.46061837 + 360.98564736629 * D) % 360;
  return g < 0 ? g + 360 : g;
}

/**
 * Radiant altitude/azimuth (degrees, az from North eastward)
 * for observer lat/lon (deg) at time d.
 */
function altAz(raH, decDeg, latDeg, lonDeg, d) {
  const lst = (gmstDeg(d) + lonDeg) % 360;
  let ha = (lst - raH * 15 + 540) % 360 - 180; // -180..180
  const dec = decDeg * D2R, lat = latDeg * D2R, h = ha * D2R;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(h);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * R2D;
  let az = Math.atan2(-Math.sin(h), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(h)) * R2D;
  if (az < 0) az += 360;
  return { alt, az };
}

/** 16-point compass direction from azimuth degrees. */
function compassDir(az) {
  const pts = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return pts[Math.round(((az % 360) + 360) % 360 / 22.5) % 16];
}

/** Day of year (1-based). */
function dayOfYear(d) {
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
    Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1;
}

/** True when the date falls inside the shower's active window (UTC). */
function isActive(sh, d) {
  const s = Math.floor((Date.UTC(2000, sh.sM - 1, sh.sD) - Date.UTC(2000, 0, 1)) / 86400000) + 1;
  const e = Math.floor((Date.UTC(2000, sh.eM - 1, sh.eD) - Date.UTC(2000, 0, 1)) / 86400000) + 1;
  const n = dayOfYear(d);
  return s <= e ? (n >= s && n <= e) : (n >= s || n <= e);
}
// ENGINE-END //

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'radiantPoint.v1';

function fmt(n, dp) { return n.toFixed(dp); }

function toLocalInputValue(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function parseInputs() {
  const lat = parseFloat($('lat').value), lon = parseFloat($('lon').value);
  const when = $('when').value ? new Date($('when').value) : new Date();
  return { lat, lon, when };
}

function validLoc(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function render() {
  const { lat, lon, when } = parseInputs();
  const list = $('list');
  if (!validLoc(lat, lon)) {
    list.innerHTML = '<div class="empty">Enter your latitude and longitude to orient the radiants.</div>';
    return;
  }
  const rows = SHOWERS.map((sh) => {
    const { alt, az } = altAz(sh.raH, sh.dec, lat, lon, when);
    return { sh, alt, az, active: isActive(sh, when) };
  });
  // Active showers first, then by altitude.
  rows.sort((a, b) => (b.active - a.active) || (b.alt - a.alt));
  list.innerHTML = rows.map(({ sh, alt, az, active }) => {
    const dir = compassDir(az);
    const up = alt > 0;
    return `<div class="shower${active ? ' active' : ''}">
      <div class="top"><span class="name">${sh.name}</span>
      <span class="badge${active ? ' hot' : ''}">${active ? 'ACTIVE' : 'off-season'}</span></div>
      <div class="dir">FACE ${dir}</div>
      <div class="meta">Radiant alt <b class="${up ? 'up' : 'down'}">${fmt(alt, 1)}°</b> · az <b>${fmt(az, 0)}°</b> · peak <b>${sh.peak}</b> · ZHR <b>${sh.zhr}</b></div>
    </div>`;
  }).join('');
  chrome.storage.local.set({ [STORE_KEY]: { lat, lon } });
}

document.addEventListener('DOMContentLoaded', async () => {
  $('when').value = toLocalInputValue(new Date());
  const saved = (await chrome.storage.local.get(STORE_KEY))[STORE_KEY];
  if (saved) { $('lat').value = saved.lat; $('lon').value = saved.lon; }
  render();
  ['lat', 'lon', 'when'].forEach((id) => $(id).addEventListener('input', render));
  $('useNow').addEventListener('click', () => { $('when').value = toLocalInputValue(new Date()); render(); });
});
