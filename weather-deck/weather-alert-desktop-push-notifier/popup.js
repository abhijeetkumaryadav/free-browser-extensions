/* StormWatch popup — city search (Open-Meteo geocoding, free/no key),
   threshold editor, enable toggle, last-check readout. Settings live in
   chrome.storage.local; the background worker owns the 30-min checks. */

// ---- Element refs ----
const $ = (id) => document.getElementById(id);
const enabledEl = $('enabled'), cityInput = $('cityInput'), searchBtn = $('searchBtn');
const cityResults = $('cityResults'), currentCityEl = $('currentCity');
const saveBtn = $('saveBtn'), checkNowBtn = $('checkNowBtn'), statusEl = $('status');

const FIELD = [
  ['tempLow', 'tTempLow', 'vTempLow'],
  ['tempHigh', 'tTempHigh', 'vTempHigh'],
  ['wind', 'tWind', 'vWind'],
  ['precip', 'tPrecip', 'vPrecip'],
];

const DEFAULTS = {
  enabled: false,
  city: null,
  thresholds: {
    tempLow: { on: false, value: 5 },
    tempHigh: { on: false, value: 38 },
    wind: { on: false, value: 60 },
    precip: { on: false, value: 70 },
  },
};

// ---- Load saved config into the form ----
async function loadConfig() {
  const { swConfig } = await chrome.storage.local.get('swConfig');
  const cfg = Object.assign({}, DEFAULTS, swConfig || {});
  cfg.thresholds = Object.assign({}, DEFAULTS.thresholds, (swConfig && swConfig.thresholds) || {});

  enabledEl.checked = cfg.enabled;
  for (const [key, onId, valId] of FIELD) {
    $(onId).checked = !!cfg.thresholds[key].on;
    $(valId).value = cfg.thresholds[key].value;
  }
  renderCity(cfg.city);
  return cfg;
}

function renderCity(city) {
  currentCityEl.textContent = city
    ? `📍 ${city.name}${city.country ? ', ' + city.country : ''}`
    : 'No city selected';
}

// ---- City search via Open-Meteo geocoding (free, no key, no geolocation) ----
searchBtn.addEventListener('click', async () => {
  const q = cityInput.value.trim();
  if (!q) return;
  setStatus('Searching…', '');
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`
    );
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    cityResults.innerHTML = '';
    if (!data.results || !data.results.length) {
      setStatus('No cities found. Try another spelling.', 'err');
      return;
    }
    setStatus('', '');
    for (const r of data.results) {
      const div = document.createElement('div');
      div.className = 'city-opt';
      const label = document.createElement('span');
      label.textContent = r.name + (r.admin1 ? `, ${r.admin1}` : '');
      const cc = document.createElement('span');
      cc.className = 'cc';
      cc.textContent = r.country || '';
      div.append(label, cc);
      div.addEventListener('click', async () => {
        const cfg = await loadConfig();
        cfg.city = { name: r.name, country: r.country, latitude: r.latitude, longitude: r.longitude };
        await chrome.storage.local.set({ swConfig: cfg });
        renderCity(cfg.city);
        cityResults.innerHTML = '';
        setStatus(`City set: ${r.name}`, 'ok');
      });
      cityResults.appendChild(div);
    }
  } catch (err) {
    setStatus(`Search failed: ${err.message}`, 'err');
  }
});
cityInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchBtn.click(); });

// ---- Save settings + refresh the alarm schedule ----
saveBtn.addEventListener('click', async () => {
  const { swConfig } = await chrome.storage.local.get('swConfig');
  const cfg = Object.assign({}, DEFAULTS, swConfig || {});
  cfg.enabled = enabledEl.checked;
  cfg.thresholds = {};
  for (const [key, onId, valId] of FIELD) {
    cfg.thresholds[key] = { on: $(onId).checked, value: Number($(valId).value) };
  }
  if (cfg.enabled && !cfg.city) {
    setStatus('Pick a city before enabling alerts.', 'err');
    return;
  }
  await chrome.storage.local.set({ swConfig: cfg });
  await chrome.runtime.sendMessage({ type: 'refreshSchedule' });
  setStatus(cfg.enabled ? 'Saved — checks run every 30 min.' : 'Saved (alerts off).', 'ok');
});

enabledEl.addEventListener('change', () => saveBtn.click());

// ---- Manual check now ----
checkNowBtn.addEventListener('click', async () => {
  setStatus('Checking…', '');
  const res = await chrome.runtime.sendMessage({ type: 'checkNow' });
  if (res && res.ok) {
    renderLastCheck();
    setStatus(res.hits.length ? `⚠ ${res.hits.length} threshold(s) crossed — notification sent.` : 'Checked — no thresholds crossed.', res.hits.length ? 'err' : 'ok');
  } else {
    setStatus(`Check failed: ${(res && res.reason) || 'unknown error'}`, 'err');
  }
});

// ---- Last-check readout ----
async function renderLastCheck() {
  const { swLastCheck } = await chrome.storage.local.get('swLastCheck');
  if (!swLastCheck) return;
  if (swLastCheck.error) {
    $('lastTime').textContent = `Last attempt failed: ${swLastCheck.error}`;
    return;
  }
  const r = swLastCheck.readings;
  $('lastTemp').textContent = `${r.temp.toFixed(1)}°C`;
  $('lastWind').textContent = `${r.wind.toFixed(0)} km/h`;
  $('lastPrecip').textContent = `${Math.round(r.precipProb)}%`;
  const when = new Date(swLastCheck.time).toLocaleString();
  $('lastTime').textContent = `${swLastCheck.cityName} · checked ${when}` +
    (swLastCheck.hits.length ? ` · ⚠ ${swLastCheck.hits.length} alert(s)` : '');
}

function setStatus(msg, cls) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (cls ? ' ' + cls : '');
}

loadConfig().then(renderLastCheck);
