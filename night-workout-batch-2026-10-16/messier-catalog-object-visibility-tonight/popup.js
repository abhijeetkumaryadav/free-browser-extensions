/* Messier Visibility Tonight — popup logic + spherical-astronomy engine (fully local). */
"use strict";

// // ENGINE-START // — pure functions, headless-testable.
const D2R = Math.PI / 180, R2D = 180 / Math.PI;

// Bundled Messier catalog (subset of showpieces): RA in decimal hours, Dec in decimal degrees.
const CATALOG = [
  { id: "M31",  name: "Andromeda Galaxy",       ra: 0.712,  dec: 41.27,  mag: 3.4, type: "Galaxy" },
  { id: "M45",  name: "Pleiades",               ra: 3.783,  dec: 24.12,  mag: 1.6, type: "Cluster" },
  { id: "M42",  name: "Orion Nebula",           ra: 5.588,  dec: -5.39,  mag: 4.0, type: "Nebula" },
  { id: "M36",  name: "Pinwheel Cluster",       ra: 5.602,  dec: 34.24,  mag: 6.3, type: "Cluster" },
  { id: "M37",  name: "Salt & Pepper Cluster",  ra: 5.873,  dec: 32.55,  mag: 5.6, type: "Cluster" },
  { id: "M35",  name: "Shoe-Buckle Cluster",    ra: 6.148,  dec: 24.33,  mag: 5.3, type: "Cluster" },
  { id: "M41",  name: "Little Beehive",         ra: 6.767,  dec: -20.75, mag: 4.5, type: "Cluster" },
  { id: "M47",  name: "—",                      ra: 7.610,  dec: -14.50, mag: 4.4, type: "Cluster" },
  { id: "M46",  name: "—",                      ra: 7.697,  dec: -14.82, mag: 6.1, type: "Cluster" },
  { id: "M93",  name: "Butterfly Cluster",      ra: 7.742,  dec: -23.87, mag: 6.2, type: "Cluster" },
  { id: "M44",  name: "Beehive Cluster",        ra: 8.668,  dec: 19.98,  mag: 3.7, type: "Cluster" },
  { id: "M67",  name: "King Cobra Cluster",     ra: 8.852,  dec: 11.82,  mag: 6.1, type: "Cluster" },
  { id: "M81",  name: "Bode's Galaxy",          ra: 9.926,  dec: 69.07,  mag: 6.9, type: "Galaxy" },
  { id: "M82",  name: "Cigar Galaxy",           ra: 9.931,  dec: 69.68,  mag: 8.4, type: "Galaxy" },
  { id: "M65",  name: "—",                      ra: 11.315, dec: 13.09,  mag: 9.3, type: "Galaxy" },
  { id: "M66",  name: "—",                      ra: 11.337, dec: 12.99,  mag: 8.9, type: "Galaxy" },
  { id: "M104", name: "Sombrero Galaxy",        ra: 12.666, dec: -11.62, mag: 8.0, type: "Galaxy" },
  { id: "M51",  name: "Whirlpool Galaxy",       ra: 13.498, dec: 47.20,  mag: 8.4, type: "Galaxy" },
  { id: "M3",   name: "—",                      ra: 13.703, dec: 28.38,  mag: 6.2, type: "Cluster" },
  { id: "M101", name: "Pinwheel Galaxy",        ra: 14.054, dec: 54.35,  mag: 7.9, type: "Galaxy" },
  { id: "M5",   name: "Rose Cluster",           ra: 15.310, dec: 2.08,   mag: 5.7, type: "Cluster" },
  { id: "M4",   name: "—",                      ra: 16.393, dec: -26.53, mag: 5.9, type: "Cluster" },
  { id: "M13",  name: "Great Hercules Cluster", ra: 16.695, dec: 36.46,  mag: 5.8, type: "Cluster" },
  { id: "M20",  name: "Trifid Nebula",          ra: 18.045, dec: -23.03, mag: 6.3, type: "Nebula" },
  { id: "M8",   name: "Lagoon Nebula",          ra: 18.062, dec: -24.38, mag: 6.0, type: "Nebula" },
  { id: "M16",  name: "Eagle Nebula",           ra: 18.313, dec: -13.81, mag: 6.4, type: "Nebula" },
  { id: "M17",  name: "Omega Nebula",           ra: 18.347, dec: -16.17, mag: 6.0, type: "Nebula" },
  { id: "M22",  name: "Sagittarius Cluster",    ra: 18.607, dec: -23.91, mag: 5.1, type: "Cluster" },
  { id: "M11",  name: "Wild Duck Cluster",      ra: 18.852, dec: -6.27,  mag: 6.3, type: "Cluster" },
  { id: "M57",  name: "Ring Nebula",            ra: 18.893, dec: 33.03,  mag: 8.8, type: "Planetary" },
  { id: "M27",  name: "Dumbbell Nebula",        ra: 19.993, dec: 22.72,  mag: 7.5, type: "Planetary" },
];

function isValidLatLon(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

// Julian date from a JS Date (UTC).
function julianDate(d) {
  return d.getTime() / 86400000 + 2440587.5;
}

// Greenwich Mean Sidereal Time, degrees [0,360).
function gmstDeg(jd) {
  const T = (jd - 2451545.0) / 36525;
  let g = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000;
  g = g % 360;
  return g < 0 ? g + 360 : g;
}

// Local sidereal time in hours [0,24), lon east-positive degrees.
function lstHours(jd, lon) {
  let h = (gmstDeg(jd) + lon) / 15;
  h = h % 24;
  return h < 0 ? h + 24 : h;
}

// Altitude in degrees for ra (hours), dec (deg) seen from lat (deg) at jd.
function altitudeDeg(raH, decD, latD, jd, lon) {
  let ha = (lstHours(jd, lon) - raH) * 15 * D2R; // hour angle, radians
  const dec = decD * D2R, lat = latD * D2R;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) * R2D;
}

// Peak altitude of a target over a local night (18:00–06:00 local) sampled every 30 min.
// Returns { peak, hoursAbove20 }.
function nightStats(raH, decD, latD, lonD, dateUTCms) {
  // local midnight of chosen date: UTC = 00:00 − lon/15 h
  const midnightUTC = dateUTCms - lonD * 3600000;
  let peak = -90, above = 0;
  for (let m = -360; m <= 360; m += 30) { // ±6h around local midnight
    const alt = altitudeDeg(raH, decD, latD, midnightUTC + m * 60000, lonD);
    if (alt > peak) peak = alt;
    if (alt > 20) above += 0.5;
  }
  return { peak: Math.round(peak * 10) / 10, hoursAbove20: above };
}
// // ENGINE-END //

const $ = (id) => document.getElementById(id);

// ---- UI wiring ----
function loadPrefs() {
  chrome.storage.local.get(["mvt_lat", "mvt_lon"], (r) => {
    if (r.mvt_lat !== undefined) $("lat").value = r.mvt_lat;
    if (r.mvt_lon !== undefined) $("lon").value = r.mvt_lon;
  });
}

function compute() {
  const lat = parseFloat($("lat").value), lon = parseFloat($("lon").value);
  if (!isValidLatLon(lat, lon)) {
    $("summary").innerHTML = "Enter a valid latitude (−90…90) and longitude (−180…180).";
    return;
  }
  const dateStr = $("date").value;
  if (!dateStr) { $("summary").innerHTML = "Pick a night first."; return; }
  chrome.storage.local.set({ mvt_lat: lat, mvt_lon: lon });

  const [y, mo, d] = dateStr.split("-").map(Number);
  const dateUTCms = Date.UTC(y, mo - 1, d);
  const rows = CATALOG.map((o) => ({ ...o, ...nightStats(o.ra, o.dec, lat, lon, dateUTCms) }))
    .filter((r) => r.peak > 20)
    .sort((a, b) => b.peak - a.peak);

  const up = rows.length;
  $("summary").innerHTML = `<strong>${up} of ${CATALOG.length}</strong> Messier objects peak above 20° that night.`;
  $("objList").innerHTML = rows.map((r) => `
    <li>
      <span class="name">${r.id}</span>
      <span class="meta">${r.name === "—" ? "" : r.name + "<br>"}${r.type} · mag ${r.mag}<br>${r.hoursAbove20}h above 20°</span>
      <span class="alt">${r.peak}°<br><small>peak</small></span>
    </li>`).join("") || `<li><span class="meta">Nothing climbs above 20° from that latitude on this date.</span></li>`;
}

document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  $("date").value = today.toISOString().slice(0, 10);
  loadPrefs();
  $("calcBtn").addEventListener("click", compute);
  $("nowBtn").addEventListener("click", () => {
    $("date").value = new Date().toISOString().slice(0, 10);
    compute();
  });
});
