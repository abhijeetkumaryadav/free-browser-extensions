/* Frost Alert — background worker: refreshes the cached forecast on a
   6-hour alarm and keeps the toolbar badge accurate even when the
   popup is closed. No user data leaves the device; only Open-Meteo
   (free, keyless) is contacted. */

const ALARM_NAME = "frost-refresh";
const STORE = { loc: "frostLoc", data: "frostCache" };

/* Minimal copies of the popup's pure helpers (kept independent so each
   context stays self-contained). */
function frostRisk(tMin) {
  if (typeof tMin !== "number" || isNaN(tMin)) return { level: 0 };
  if (tMin < -2) return { level: 3 };
  if (tMin <= 0) return { level: 2 };
  if (tMin <= 2) return { level: 1 };
  return { level: 0 };
}

function worstRisk(tMins, n) {
  let worst = 0;
  for (const t of tMins.slice(0, n)) worst = Math.max(worst, frostRisk(t).level);
  return worst;
}

async function refresh() {
  try {
    const { [STORE.loc]: loc } = await chrome.storage.local.get(STORE.loc);
    if (!loc) return;
    const url = "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${loc.latitude}&longitude=${loc.longitude}` +
      "&daily=temperature_2m_min&timezone=auto&forecast_days=7";
    const res = await fetch(url);
    if (!res.ok) return;
    const json = await res.json();
    if (!json.daily || !Array.isArray(json.daily.temperature_2m_min)) return;
    const days = json.daily.time.map((date, i) => ({
      date, tMin: json.daily.temperature_2m_min[i],
    }));
    await chrome.storage.local.set({ [STORE.data]: { loc, fetchedAt: Date.now(), days } });

    const w = worstRisk(days.map(d => d.tMin), 2);
    if (w >= 2) {
      await chrome.action.setBadgeText({ text: "!" });
      await chrome.action.setBadgeBackgroundColor({ color: w >= 3 ? "#f472b6" : "#fb923c" });
    } else {
      await chrome.action.setBadgeText({ text: "" });
    }
  } catch {
    // Offline or API hiccup — keep the last cached forecast untouched.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 360 });
  refresh();
});

chrome.runtime.onStartup.addListener(refresh);
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) refresh();
});
