/* Frost Alert — frost-risk ticker powered by free keyless Open-Meteo APIs.
   Forecasts are heuristic guidance, cached locally for offline use. */

/* ---- pure helpers (testable in Node) ---- */

/**
 * Classify frost risk from an overnight minimum temperature (°C).
 * Returns { level, label, cls } for display.
 */
function frostRisk(tMin) {
  if (typeof tMin !== "number" || isNaN(tMin)) return { level: 0, label: "No data", cls: "ok" };
  if (tMin < -2) return { level: 3, label: "Severe frost", cls: "sev" };
  if (tMin <= 0) return { level: 2, label: "Frost likely", cls: "warn" };
  if (tMin <= 2) return { level: 1, label: "Frost watch", cls: "watch" };
  return { level: 0, label: "No frost", cls: "ok" };
}

/** "2026-10-17" -> "Sat" (local weekday short name). */
function dayLabel(isoDate) {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

/** Worst risk level across the first `n` days of a daily-min array. */
function worstRisk(tMins, n) {
  let worst = 0;
  for (const t of tMins.slice(0, n)) {
    worst = Math.max(worst, frostRisk(t).level);
  }
  return worst;
}

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WX_URL = "https://api.open-meteo.com/v1/forecast";
const STORE = { loc: "frostLoc", data: "frostCache" };

/* ---- network ---- */

async function geocode(query) {
  const res = await fetch(`${GEO_URL}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
  if (!res.ok) throw new Error("geocoding failed");
  const json = await res.json();
  return json.results || [];
}

async function fetchForecast(lat, lon) {
  const url = `${WX_URL}?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_min&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("forecast failed");
  const json = await res.json();
  if (!json.daily || !Array.isArray(json.daily.temperature_2m_min)) {
    throw new Error("bad forecast payload");
  }
  return {
    fetchedAt: Date.now(),
    days: json.daily.time.map((date, i) => ({ date, tMin: json.daily.temperature_2m_min[i] })),
  };
}

/* ---- storage ---- */

async function getLoc() {
  const r = await chrome.storage.local.get(STORE.loc);
  return r[STORE.loc] || null;
}
async function setLoc(loc) { await chrome.storage.local.set({ [STORE.loc]: loc }); }
async function getCache() {
  const r = await chrome.storage.local.get(STORE.data);
  return r[STORE.data] || null;
}
async function setCache(data) { await chrome.storage.local.set({ [STORE.data]: data }); }

/* ---- badge ---- */

function updateBadge(days) {
  // Warn if severe/likely frost within the next 2 nights.
  const w = worstRisk(days.map(d => d.tMin), 2);
  if (w >= 2) {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: w >= 3 ? "#f472b6" : "#fb923c" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

/* ---- rendering ---- */

function renderTicker(days) {
  const wrap = document.getElementById("ticker");
  wrap.innerHTML = "";
  days.forEach(d => {
    const r = frostRisk(d.tMin);
    const row = document.createElement("div");
    row.className = "day " + r.cls;
    const tempTxt = (typeof d.tMin === "number" && !isNaN(d.tMin))
      ? `${d.tMin > 0 ? "+" : ""}${d.tMin.toFixed(1)}°C` : "—";
    row.innerHTML = `<span class="dow">${dayLabel(d.date)}</span>` +
      `<span class="temp">${tempTxt}</span><span class="risk">${r.label}</span>`;
    wrap.appendChild(row);
  });
}

function setStatus(msg, cls) {
  const el = document.getElementById("statusLine");
  el.textContent = msg;
  el.className = "status-line" + (cls ? " " + cls : "");
}

function renderLocLabel(loc) {
  document.getElementById("locLabel").textContent =
    loc ? `${loc.name}${loc.country ? ", " + loc.country : ""}` : "No location set";
}

/* ---- flows ---- */

async function refreshForecast(loc, btn) {
  if (!loc) return;
  if (btn) btn.classList.add("spinning");
  setStatus("Loading forecast…");
  try {
    const data = await fetchForecast(loc.latitude, loc.longitude);
    await setCache({ loc, ...data });
    renderTicker(data.days);
    updateBadge(data.days);
    const when = new Date(data.fetchedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    setStatus(`Live forecast · updated ${when}`);
  } catch (e) {
    // Graceful offline fallback: last cached forecast.
    const cache = await getCache();
    if (cache && cache.days) {
      renderTicker(cache.days);
      updateBadge(cache.days);
      setStatus("Offline — showing last cached forecast.", "cached");
    } else {
      setStatus("Could not load forecast. Check your connection and retry.", "error");
    }
  } finally {
    if (btn) btn.classList.remove("spinning");
  }
}

async function runSearch() {
  const q = document.getElementById("locInput").value.trim();
  const box = document.getElementById("geoResults");
  box.innerHTML = "";
  if (!q) return;
  setStatus("Searching places…");
  try {
    const results = await geocode(q);
    if (results.length === 0) { setStatus("No places found — try another search.", "error"); return; }
    setStatus("Pick your location:");
    results.forEach(r => {
      const b = document.createElement("button");
      b.className = "geo-item";
      const sub = [r.admin1, r.country].filter(Boolean).join(", ");
      b.innerHTML = `${r.name}<div class="meta">${sub}</div>`;
      b.addEventListener("click", async () => {
        const loc = { name: r.name, country: r.country || "", latitude: r.latitude, longitude: r.longitude };
        await setLoc(loc);
        renderLocLabel(loc);
        box.innerHTML = "";
        document.getElementById("locInput").value = "";
        await refreshForecast(loc);
      });
      box.appendChild(b);
    });
  } catch {
    setStatus("Place search failed. Check your connection.", "error");
  }
}

/* ---- init ---- */
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("searchBtn").addEventListener("click", runSearch);
  document.getElementById("locInput").addEventListener("keydown", e => {
    if (e.key === "Enter") runSearch();
  });
  const refreshBtn = document.getElementById("refreshBtn");
  refreshBtn.addEventListener("click", async () => {
    const loc = await getLoc();
    await refreshForecast(loc, refreshBtn);
  });

  const loc = await getLoc();
  renderLocLabel(loc);
  if (loc) {
    await refreshForecast(loc);
  } else {
    // Show cached data (if any) even without a saved location.
    const cache = await getCache();
    if (cache && cache.loc) {
      await setLoc(cache.loc);
      renderLocLabel(cache.loc);
      renderTicker(cache.days);
      updateBadge(cache.days);
      setStatus("Offline — showing last cached forecast.", "cached");
    }
  }
});
