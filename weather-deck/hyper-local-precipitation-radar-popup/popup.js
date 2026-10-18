/**
 * RainScope — Precipitation Radar Popup
 * City search (Open-Meteo geocoding) -> current + next-12h precipitation
 * probability from the Open-Meteo forecast API, rendered as a canvas bar chart.
 * Last location persisted in chrome.storage.local. No geolocation requested.
 */
'use strict';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FCST_URL = 'https://api.open-meteo.com/v1/forecast';

/* WMO weather codes -> plain-language description. */
const WMO_DESC = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Storm + hail', 99: 'Storm + hail',
};

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

/**
 * Find the index in the hourly arrays closest to "now" (local to the place).
 * Open-Meteo returns hourly times in the place's timezone; comparing ISO
 * date+hour strings with the current local time string is a robust heuristic.
 */
function findNowIndex(times) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}`;
  let best = 0, bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const d = Math.abs(new Date(times[i]) - new Date(key));
    if (d < bestDiff) { bestDiff = d; best = i; }
  }
  return best;
}

/** Load forecast for a geocoded place and render. */
async function loadForecast(place) {
  show('loadingState');
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('spinning');
  try {
    const params = new URLSearchParams({
      latitude: place.latitude,
      longitude: place.longitude,
      current: 'temperature_2m,precipitation,weathercode',
      hourly: 'precipitation_probability',
      forecast_days: '2',
      timezone: 'auto',
    });
    const data = await fetchJson(`${FCST_URL}?${params}`);
    const cur = data.current || {};
    const hourly = data.hourly || {};

    document.getElementById('placeName').textContent =
      [place.name, place.country].filter(Boolean).join(', ');
    const ts = cur.time ? new Date(cur.time) : null;
    document.getElementById('updatedAt').textContent =
      ts ? `Updated ${ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';

    document.getElementById('nowTemp').textContent =
      cur.temperature_2m != null ? `${Math.round(cur.temperature_2m)}°` : '–';
    document.getElementById('nowDesc').textContent = WMO_DESC[cur.weathercode] || '—';

    const times = hourly.time || [];
    const probs = hourly.precipitation_probability || [];
    const idx = times.length ? findNowIndex(times) : 0;
    document.getElementById('nowProb').textContent =
      probs[idx] != null ? `${probs[idx]}%` : '–';
    document.getElementById('nowMm').textContent =
      cur.precipitation != null ? `${cur.precipitation.toFixed(1)} mm` : '–';

    /* Next 12 hourly bars starting at the current hour. */
    const bars = [];
    for (let i = idx; i < Math.min(idx + 12, times.length); i++) {
      bars.push({ time: times[i], prob: probs[i] != null ? probs[i] : 0 });
    }
    drawChart(bars, idx === 0 ? -1 : 0);
    renderHourLabels(bars);

    show('resultPanel');
    await chrome.storage.local.set({ lastPlace: place });
  } catch (err) {
    console.warn('RainScope fetch failed:', err);
    setError('Could not load precipitation data. Check your connection and try again.');
  } finally {
    btn.classList.remove('spinning');
  }
}

/** Draw rounded bars with % labels on the canvas. */
function drawChart(bars, nowSlot) {
  const canvas = document.getElementById('chart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const n = bars.length;
  if (!n) return;
  const padL = 8, padR = 8, padT = 24, padB = 10;
  const slotW = (W - padL - padR) / n;
  const barW = Math.min(34, slotW * 0.62);
  const maxH = H - padT - padB;

  bars.forEach((b, i) => {
    const h = Math.max(3, (b.prob / 100) * maxH);
    const x = padL + slotW * i + (slotW - barW) / 2;
    const y = H - padB - h;
    const isNow = i === nowSlot;

    /* Bar: accent gradient, brighter for the current hour. */
    const g = ctx.createLinearGradient(0, y, 0, H - padB);
    if (isNow) {
      g.addColorStop(0, '#7fb3ff'); g.addColorStop(1, '#3b82f6');
    } else {
      g.addColorStop(0, '#3b82f6'); g.addColorStop(1, 'rgba(59,130,246,0.35)');
    }
    ctx.fillStyle = g;
    const r = Math.min(6, barW / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, barW, h, [r, r, 2, 2]);
    ctx.fill();

    /* % label above the bar. */
    ctx.fillStyle = isNow ? '#cfe1ff' : '#9aa0ad';
    ctx.font = '600 15px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${b.prob}%`, x + barW / 2, y - 7);
  });
}

function renderHourLabels(bars) {
  const wrap = document.getElementById('hourLabels');
  wrap.innerHTML = '';
  bars.forEach((b, i) => {
    const s = document.createElement('span');
    const d = new Date(b.time);
    s.textContent = d.toLocaleTimeString([], { hour: 'numeric' }).replace(' ', '');
    if (i === 0) s.classList.add('now-h');
    wrap.appendChild(s);
  });
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
        loadForecast(lastPlace);
      });
      suggestList.appendChild(item);
    }
    suggestList.classList.remove('hidden');
  } catch (err) {
    console.warn('RainScope geocoding failed:', err);
  }
}

document.getElementById('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (lastPlace && input.value.trim()) {
    loadForecast(lastPlace);
  } else if (input.value.trim()) {
    searchCities(input.value.trim());
  }
});

document.getElementById('refreshBtn').addEventListener('click', () => {
  if (lastPlace) loadForecast(lastPlace);
});

/* Restore last location on open. */
(async function init() {
  try {
    const { lastPlace: saved } = await chrome.storage.local.get('lastPlace');
    if (saved && saved.latitude != null) {
      lastPlace = saved;
      input.value = saved.name || '';
      loadForecast(saved);
    } else {
      show('emptyState');
    }
  } catch {
    show('emptyState');
  }
})();
