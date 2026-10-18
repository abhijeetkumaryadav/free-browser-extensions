"use strict";
/* Route String Parser — pure route engine is headless-testable between the markers. */

// ENGINE-START
// Bundled airport coordinates (selected major airports, educational subset).
// lat/lon in decimal degrees.
const AIRPORTS = {
  EGLL: [51.4775, -0.4614], EGKK: [51.1537, -0.1821], EHAM: [52.3105, 4.7683],
  EDDF: [50.0379, 8.5622], EDDM: [48.3537, 11.7861], LFPG: [49.0097, 2.5479],
  LEMD: [40.4722, -3.5709], LIRF: [41.8003, 12.2389], LOWW: [48.1103, 16.5697],
  LSZH: [47.4581, 8.5555], EIDW: [53.4214, -6.2701], EDDK: [50.8659, 7.1427],
  KJFK: [40.6413, -73.7781], KLAX: [33.9416, -118.4085], KORD: [41.9742, -87.9073],
  KDFW: [32.8998, -97.0403], KATL: [33.6407, -84.4277], KSFO: [37.6213, -122.3790],
  KMIA: [25.7959, -80.2870], CYYZ: [43.6777, -79.6248], SBGR: [-23.4356, -46.4731],
  OMDB: [25.2532, 55.3657], VHHH: [22.3080, 113.9145], WSSS: [1.3644, 103.9915],
  YSSY: [-33.9399, 151.1753], RJTT: [35.5494, 139.7798], NZAA: [-37.0082, 174.7850],
};

const EARTH_NM = 3440.065; // earth radius in nautical miles

function haversineNm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_NM * Math.asin(Math.sqrt(a));
}

function isAirportToken(t) { return /^[A-Z]{4}$/.test(t) && t in AIRPORTS; }
function isAirportLike(t) { return /^[A-Z]{4}$/.test(t); } // 4-letter ICAO shape, maybe not in DB
function isAirwayToken(t) { return /^[A-Z]{1,3}\d{1,4}[A-Z]?$/.test(t) && /\d/.test(t); }
function isFixToken(t) { return /^[A-Z0-9]{2,5}$/.test(t); }

// Split a raw route string into clean tokens.
function tokenize(route) {
  if (typeof route !== "string") return [];
  return route.toUpperCase().replace(/[,\/;()\[\]]/g, " ").split(/\s+/).filter(Boolean);
}

function classify(token) {
  if (isAirportToken(token)) return { raw: token, kind: "airport", known: true, coords: AIRPORTS[token] };
  if (isAirportLike(token)) return { raw: token, kind: "airport", known: false, coords: null };
  if (token === "DCT") return { raw: token, kind: "other", known: false, coords: null, label: "direct" };
  if (isAirwayToken(token)) return { raw: token, kind: "airway", known: false, coords: null };
  if (isFixToken(token)) return { raw: token, kind: "fix", known: false, coords: null };
  return { raw: token, kind: "other", known: false, coords: null };
}

// Parse a route string. Returns points, legCount, knownDistanceNm,
// and how many legs could not be measured.
function parseRoute(route) {
  const points = tokenize(route).map(classify);
  let knownDistanceNm = 0, unmeasurable = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (a.kind === "airport" && b.kind === "airport" && a.known && b.known) {
      knownDistanceNm += haversineNm(a.coords[0], a.coords[1], b.coords[0], b.coords[1]);
    } else {
      unmeasurable++;
    }
  }
  return {
    points,
    pointCount: points.length,
    legCount: Math.max(0, points.length - 1),
    knownDistanceNm: Math.round(knownDistanceNm * 10) / 10,
    unmeasurable,
  };
}
// ENGINE-END

/* ---------- Popup wiring (not part of the headless engine) ---------- */
const routeInput = document.getElementById("routeInput");
const parseBtn = document.getElementById("parseBtn");
const clearBtn = document.getElementById("clearBtn");
const resultCard = document.getElementById("resultCard");
const pointList = document.getElementById("pointList");

const KIND_LABEL = { airport: "APT", fix: "FIX", airway: "AWY", other: "—" };

function render(result) {
  document.getElementById("statPoints").textContent = result.pointCount;
  document.getElementById("statLegs").textContent = result.legCount;
  document.getElementById("statDist").textContent = result.knownDistanceNm;
  pointList.innerHTML = "";
  result.points.forEach((p, i) => {
    const li = document.createElement("li");
    const idx = document.createElement("span"); idx.className = "idx"; idx.textContent = (i + 1);
    const name = document.createElement("span"); name.className = "name"; name.textContent = p.raw;
    const tag = document.createElement("span"); tag.className = "tag " + p.kind; tag.textContent = KIND_LABEL[p.kind];
    li.append(idx, name, tag);
    pointList.appendChild(li);
  });
  resultCard.classList.remove("hidden");
}

async function doParse() {
  const result = parseRoute(routeInput.value);
  render(result);
  await chrome.storage.local.set({ lastRoute: routeInput.value });
}

parseBtn.addEventListener("click", doParse);
routeInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doParse(); } });
clearBtn.addEventListener("click", async () => {
  routeInput.value = "";
  resultCard.classList.add("hidden");
  await chrome.storage.local.remove("lastRoute");
});

(async () => {
  const { lastRoute } = await chrome.storage.local.get("lastRoute");
  if (lastRoute) { routeInput.value = lastRoute; render(parseRoute(lastRoute)); }
})();
