/* StormWatch — background service worker.
   Runs the threshold check on a chrome.alarms schedule (every 30 min)
   and on demand from the popup. Fetches Open-Meteo (free, no key),
   compares current conditions to the user's thresholds, and fires a
   desktop notification for each crossed threshold. */

const ALARM_NAME = 'stormwatch-check';
const CHECK_PERIOD_MIN = 30;

// ---- Fetch current conditions from Open-Meteo (no key needed) ----
async function fetchCurrent(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,wind_speed_10m,precipitation_probability&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  const c = data.current;
  return {
    temp: c.temperature_2m,
    wind: c.wind_speed_10m,
    precipProb: c.precipitation_probability ?? 0,
  };
}

// ---- Compare readings against user thresholds ----
function evaluateThresholds(readings, cfg) {
  const hits = [];
  const t = cfg.thresholds;
  if (t.tempLow.on && readings.temp <= t.tempLow.value)
    hits.push({ label: 'Temperature low', text: `${readings.temp.toFixed(1)}°C ≤ ${t.tempLow.value}°C` });
  if (t.tempHigh.on && readings.temp >= t.tempHigh.value)
    hits.push({ label: 'Temperature high', text: `${readings.temp.toFixed(1)}°C ≥ ${t.tempHigh.value}°C` });
  if (t.wind.on && readings.wind >= t.wind.value)
    hits.push({ label: 'Wind high', text: `${readings.wind.toFixed(0)} km/h ≥ ${t.wind.value} km/h` });
  if (t.precip.on && readings.precipProb >= t.precip.value)
    hits.push({ label: 'Rain chance high', text: `${Math.round(readings.precipProb)}% ≥ ${t.precip.value}%` });
  return hits;
}

// ---- Run one check: fetch, evaluate, store, notify ----
async function runCheck() {
  const { swConfig } = await chrome.storage.local.get('swConfig');
  if (!swConfig || !swConfig.enabled || !swConfig.city) {
    return { ok: false, reason: 'disabled or no city' };
  }
  try {
    const readings = await fetchCurrent(swConfig.city.latitude, swConfig.city.longitude);
    const hits = evaluateThresholds(readings, swConfig);
    const lastCheck = { readings, hits, time: Date.now(), cityName: swConfig.city.name };
    await chrome.storage.local.set({ swLastCheck: lastCheck });

    // Notify once per crossed threshold (user-defined thresholds only)
    for (const hit of hits) {
      await chrome.notifications.create(`stormwatch-${hit.label}-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: `StormWatch: ${hit.label}`,
        message: `${swConfig.city.name}: ${hit.text}. Your threshold — not an official warning.`,
        priority: 2,
      });
    }
    return { ok: true, hits };
  } catch (err) {
    await chrome.storage.local.set({ swLastCheck: { error: String(err), time: Date.now() } });
    return { ok: false, reason: String(err) };
  }
}

// ---- Keep the schedule alive: (re)create the 30-min alarm ----
async function ensureAlarm() {
  const { swConfig } = await chrome.storage.local.get('swConfig');
  const alarm = await chrome.alarms.get(ALARM_NAME);
  if (swConfig && swConfig.enabled && swConfig.city && !alarm) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_PERIOD_MIN });
  }
  if ((!swConfig || !swConfig.enabled) && alarm) {
    await chrome.alarms.clear(ALARM_NAME);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) runCheck();
});

// Popup asks for an immediate check or a schedule refresh
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'checkNow') {
    runCheck().then(sendResponse);
    return true; // async response
  }
  if (msg.type === 'refreshSchedule') {
    ensureAlarm().then(() => sendResponse({ ok: true }));
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => ensureAlarm());
chrome.runtime.onStartup.addListener(() => ensureAlarm());
