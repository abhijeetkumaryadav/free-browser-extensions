/**
 * AirLens — Real-Time Air Quality
 * Popup logic: city search (Open-Meteo geocoding) -> current air quality
 * (Open-Meteo air quality API). Renders US + European AQI with health bands.
 * Last location persisted in chrome.storage.local. No geolocation requested.
 */
'use strict';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const AIR_URL = 'https://api.open-meteo.com/v1/air-quality';

/* US EPA AQI breakpoints: [maxAqi, label, badgeColor, advice] */
const US_BANDS = [
  [50, 'Good', '#22c55e', 'Air quality is satisfactory — enjoy the outdoors.'],
  [100, 'Moderate', '#a3e635', 'Acceptable. Unusually sensitive people: consider shorter outings.'],
  [150, 'USG', '#f59e0b', 'Sensitive groups should reduce prolonged outdoor exertion.'],
  [200, 'Unhealthy', '#ef4444', 'Everyone may feel effects — limit outdoor activity.'],
  [300, 'Very Unhealthy', '#a855f7', 'Health alert: avoid outdoor exertion.'],
  [500, 'Hazardous', '#7f1d1d', 'Emergency conditions — stay indoors.'],
];

/* European AQI bands (0-100+): [maxAqi, label, color, advice] */
const EU_BANDS = [
  [20, 'Good', '#22c55e', 'Very good air — no restrictions needed.'],
  [40, 'Fair', '#a3e635', 'Fair air — sensitive people can enjoy normal activities.'],
  [60, 'Moderate', '#f59e0b', 'Moderate — sensitive groups should watch symptoms.'],
  [80, 'Poor', '#ef4444', 'Poor air — reduce strenuous outdoor activity.'],
  [100, 'Very Poor', '#a855f7', 'Very poor — avoid outdoor exertion.'],
  [Infinity, 'Extremely Poor', '#7f1d1d', 'Extremely poor — stay indoors.'],
];

function bandFor(value, bands) {
  if (value == null || Number.isNaN(value)) return null;
  for (const b of bands) {
    if (value <= b[0]) return { label: b[1], color: b[2], advice: b[3] };
  }
  return null;
}

function fmt(v) {
  return v == null ? '–' : Math.round(v).toString();
}

function show(id) {
  for (const s of ['emptyState', 'errorState', 'loadingState', 'resultPanel']) {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  }
}

function setError(msg) {
  document.getElementById('errorMsg').textContent = msg;
  show('errorState');
}

/** Fetch with a timeout so hangs don't freeze the popup. */
async function fetchJson(url, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** Load AQI for a geocoded place and render. */
async function loadAqi(place) {
  show('loadingState');
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('spinning');
  try {
    const params = new URLSearchParams({
      latitude: place.latitude,
      longitude: place.longitude,
      current: 'us_aqi,european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide',
      timezone: 'auto',
    });
    const data = await fetchJson(`${AIR_URL}?${params}`);
    const cur = data.current || {};

    document.getElementById('placeName').textContent =
      [place.name, place.country].filter(Boolean).join(', ');
    const ts = cur.time ? new Date(cur.time) : null;
    document.getElementById('updatedAt').textContent =
      ts ? `Updated ${ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';

    renderIndex('us', cur.us_aqi, US_BANDS);
    renderIndex('eu', cur.european_aqi, EU_BANDS);

    document.getElementById('pm25').textContent = fmt(cur.pm2_5);
    document.getElementById('pm10').textContent = fmt(cur.pm10);
    document.getElementById('o3').textContent = fmt(cur.ozone);
    document.getElementById('no2').textContent = fmt(cur.nitrogen_dioxide);

    show('resultPanel');
    await chrome.storage.local.set({ lastPlace: place });
  } catch (err) {
    console.warn('AirLens fetch failed:', err);
    setError('Could not load air quality. Check your connection and try again.');
  } finally {
    btn.classList.remove('spinning');
  }
}

function renderIndex(prefix, value, bands) {
  const valEl = document.getElementById(`${prefix}Aqi`);
  const bandEl = document.getElementById(`${prefix}Band`);
  const advEl = document.getElementById(`${prefix}Advice`);
  const band = bandFor(value, bands);
  if (band) {
    valEl.textContent = Math.round(value);
    bandEl.textContent = band.label;
    bandEl.style.color = band.color;
    bandEl.style.borderColor = band.color + '55';
    advEl.textContent = band.advice;
  } else {
    valEl.textContent = '–';
    bandEl.textContent = 'No data';
    bandEl.style.color = '';
    bandEl.style.borderColor = '';
    advEl.textContent = 'No index data for this location right now.';
  }
}

/* ---- City search with live suggestions ---- */

const input = document.getElementById('cityInput');
const suggestList = document.getElementById('suggestList');
let suggestTimer = null;
let lastPlace = null;

input.addEventListener('input', () => {
  clearTimeout(suggestTimer);
  const q = input.value.trim();
  if (q.length < 2) {
    suggestList.classList.add('hidden');
    return;
  }
  suggestTimer = setTimeout(() => searchCities(q), 300);
});

async function searchCities(q) {
  try {
    const params = new URLSearchParams({ name: q, count: '6', language: 'en', format: 'json' });
    const data = await fetchJson(`${GEO_URL}?${params}`);
    const results = data.results || [];
    if (!results.length) {
      suggestList.classList.add('hidden');
      return;
    }
    suggestList.innerHTML = '';
    for (const r of results) {
      const item = document.createElement('div');
      item.className = 'suggest-item';
      const title = document.createElement('span');
      title.textContent = r.name;
      const sub = document.createElement('span');
      sub.className = 's-sub';
      sub.textContent = [r.admin1, r.country].filter(Boolean).join(', ');
      item.append(title, sub);
      item.addEventListener('click', () => {
        lastPlace = { name: r.name, country: r.country, latitude: r.latitude, longitude: r.longitude };
        suggestList.classList.add('hidden');
        input.value = r.name;
        loadAqi(lastPlace);
      });
      suggestList.appendChild(item);
    }
    suggestList.classList.remove('hidden');
  } catch (err) {
    console.warn('AirLens geocoding failed:', err);
  }
}

document.getElementById('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (lastPlace && input.value.trim()) {
    loadAqi(lastPlace);
  } else if (input.value.trim()) {
    searchCities(input.value.trim());
  }
});

document.getElementById('refreshBtn').addEventListener('click', () => {
  if (lastPlace) loadAqi(lastPlace);
});

/* Restore last location on open. */
(async function init() {
  try {
    const { lastPlace: saved } = await chrome.storage.local.get('lastPlace');
    if (saved && saved.latitude != null) {
      lastPlace = saved;
      input.value = saved.name || '';
      loadAqi(saved);
    } else {
      show('emptyState');
    }
  } catch {
    show('emptyState');
  }
})();
