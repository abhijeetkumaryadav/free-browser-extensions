/* GlobalTime — compare up to 4 cities: local time + live weather via Open-Meteo (no key). */
'use strict';

const MAX_CITIES = 4;
const DEBOUNCE_MS = 350;

const $ = (id) => document.getElementById(id);
const cardsEl = $('cards');
const inputEl = $('city-input');
const resultsEl = $('search-results');
const statusEl = $('status-bar');
const emptyEl = $('empty-state');

/* ---------- weather-code → label + outline SVG icon (Lucide-style) ---------- */
const ICONS = {
  sun: '<svg class="cond-icon" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg class="cond-icon" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  cloudSun: '<svg class="cond-icon" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><path d="M8 2v1.5M2 8h1.5M4.1 4.1l1 1M11.9 4.1l-1 1M10 15.5A3.5 3.5 0 0 1 10 9h9a3.5 3.5 0 0 1 0 7h-9z"/></svg>',
  cloud: '<svg class="cond-icon" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 .4-8.98A6 6 0 0 0 6.2 8.6 4.8 4.8 0 0 0 6.5 19h11z"/></svg>',
  rain: '<svg class="cond-icon" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 15a4.5 4.5 0 0 0 .4-8.98A6 6 0 0 0 6.2 4.6 4.8 4.8 0 0 0 6.5 15h11z"/><path d="M8 18v2M12 17v3M16 18v2"/></svg>',
  storm: '<svg class="cond-icon" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 15a4.5 4.5 0 0 0 .4-8.98A6 6 0 0 0 6.2 4.6 4.8 4.8 0 0 0 6.5 15h9z"/><path d="M13 15l-3.5 6h4L10 24" transform="translate(0 -1)"/></svg>',
  snow: '<svg class="cond-icon" viewBox="0 0 24 24" fill="none" stroke="#bae6fd" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 15a4.5 4.5 0 0 0 .4-8.98A6 6 0 0 0 6.2 4.6 4.8 4.8 0 0 0 6.5 15h11z"/><path d="M12 17v4M10 18.5l4 1M14 18.5l-4 1"/></svg>',
  fog: '<svg class="cond-icon" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"><path d="M4 10h16M6 14h12M8 18h8"/></svg>'
};

/** WMO weather code → [label, iconKey] */
function describeCode(code, isDay) {
  if (code === 0) return ['Clear sky', isDay ? 'sun' : 'moon'];
  if (code === 1) return ['Mainly clear', isDay ? 'sun' : 'moon'];
  if (code === 2) return ['Partly cloudy', isDay ? 'cloudSun' : 'cloud'];
  if (code === 3) return ['Overcast', 'cloud'];
  if (code === 45 || code === 48) return ['Fog', 'fog'];
  if (code >= 51 && code <= 57) return ['Drizzle', 'rain'];
  if (code >= 61 && code <= 67) return ['Rain', 'rain'];
  if (code >= 71 && code <= 77) return ['Snow', 'snow'];
  if (code >= 80 && code <= 82) return ['Rain showers', 'rain'];
  if (code === 85 || code === 86) return ['Snow showers', 'snow'];
  if (code >= 95) return ['Thunderstorm', 'storm'];
  return ['Unknown', 'cloud'];
}

/* ---------- storage ---------- */
async function loadCities() {
  const { cities = [] } = await chrome.storage.local.get('cities');
  return cities;
}
async function saveCities(cities) {
  await chrome.storage.local.set({ cities });
}

/* ---------- rendering ---------- */
function fmtLocalTime(timezone) {
  try {
    const now = new Date();
    const time = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: timezone
    }).format(now);
    const date = new Intl.DateTimeFormat('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: timezone
    }).format(now);
    return { time, date };
  } catch {
    return { time: '--:--', date: '—' };
  }
}

function cardHtml(city, weather, error) {
  const tzLabel = (city.timezone || '').replace(/_/g, ' ');
  const { time, date } = fmtLocalTime(city.timezone);
  const removeBtn = '<button class="remove-btn" data-remove="' + city.id + '" title="Remove city" aria-label="Remove">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';

  let body;
  if (error) {
    body = '<div class="card-error">' + error + '</div>';
  } else if (weather) {
    const [label, iconKey] = describeCode(weather.code, weather.isDay);
    body = '<div class="card-body">' +
      '<div class="time-block"><div class="time">' + time + '</div><div class="date">' + date + '</div></div>' +
      '<div class="weather-block">' + ICONS[iconKey] +
      '<div><span class="temp">' + Math.round(weather.temp) + '°C</span>' +
      '<div class="cond-text">' + label + '</div>' +
      '<div class="humidity">Humidity ' + weather.humidity + '%</div></div></div></div>';
  } else {
    body = '<div class="card-error">Loading…</div>';
  }

  return '<article class="city-card"><div class="card-top"><div>' +
    '<div class="city-name">' + escapeHtml(city.name) + '</div>' +
    '<div class="city-tz">' + escapeHtml(tzLabel) + '</div></div>' +
    removeBtn + '</div>' + body + '</article>';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function render(cities, weatherById, errorsById) {
  emptyEl.hidden = cities.length > 0;
  cardsEl.innerHTML = cities.map((c) => cardHtml(c, weatherById[c.id], errorsById[c.id])).join('');
  cardsEl.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-remove');
      const next = (await loadCities()).filter((c) => String(c.id) !== id);
      await saveCities(next);
      refresh();
    });
  });
}

/* ---------- data ---------- */
async function fetchWeather(city) {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + city.latitude +
    '&longitude=' + city.longitude +
    '&current=temperature_2m,relative_humidity_2m,weather_code,is_day&timezone=auto';
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (!data.current) throw new Error('No current data');
  return {
    temp: data.current.temperature_2m,
    humidity: data.current.relative_humidity_2m,
    code: data.current.weather_code,
    isDay: data.current.is_day === 1
  };
}

async function refresh() {
  const cities = await loadCities();
  const weatherById = {};
  const errorsById = {};
  await render(cities, weatherById, errorsById); // skeleton first
  setStatus(cities.length ? 'Updating…' : '');
  await Promise.all(cities.map(async (city) => {
    try {
      weatherById[city.id] = await fetchWeather(city);
    } catch (err) {
      errorsById[city.id] = 'Could not load weather — check your connection and retry.';
    }
  }));
  setStatus('');
  await render(cities, weatherById, errorsById);
}

function setStatus(msg, isError) {
  statusEl.hidden = !msg;
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', !!isError);
}

/* ---------- search ---------- */
let debounceTimer = null;

inputEl.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const q = inputEl.value.trim();
  if (q.length < 2) { resultsEl.hidden = true; return; }
  debounceTimer = setTimeout(() => searchCities(q), DEBOUNCE_MS);
});

async function searchCities(q) {
  try {
    const res = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' +
      encodeURIComponent(q) + '&count=5&language=en&format=json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    showResults(data.results || []);
  } catch {
    showResults([]);
  }
}

function showResults(results) {
  if (!results.length) { resultsEl.hidden = true; return; }
  resultsEl.innerHTML = results.map((r, i) =>
    '<li data-i="' + i + '">' + escapeHtml(r.name) +
    (r.admin1 ? ' <span class="country">' + escapeHtml(r.admin1) + '</span>' : '') +
    (r.country ? ' <span class="country">' + escapeHtml(r.country) + '</span>' : '') + '</li>'
  ).join('');
  resultsEl.hidden = false;
  resultsEl.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', () => addCity(results[+li.dataset.i]));
  });
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-panel')) resultsEl.hidden = true;
});

async function addCity(place) {
  const cities = await loadCities();
  if (cities.length >= MAX_CITIES) {
    setStatus('Maximum ' + MAX_CITIES + ' cities — remove one first.', true);
    return;
  }
  if (cities.some((c) => c.latitude === place.latitude && c.longitude === place.longitude)) {
    setStatus('City already added.', true);
    return;
  }
  cities.push({
    id: Date.now(),
    name: place.name,
    country: place.country || '',
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone || 'UTC'
  });
  await saveCities(cities);
  inputEl.value = '';
  resultsEl.hidden = true;
  refresh();
}

/* ---------- refresh ticker (local clock updates every minute) ---------- */
setInterval(async () => {
  const cities = await loadCities();
  if (!cities.length) return;
  // Re-render clock only: cheap — no network.
  cardsEl.querySelectorAll('.city-card').forEach((card, i) => {
    const { time, date } = fmtLocalTime(cities[i].timezone);
    const t = card.querySelector('.time');
    const d = card.querySelector('.date');
    if (t) t.textContent = time;
    if (d) d.textContent = date;
  });
}, 30000);

$('refresh-btn').addEventListener('click', refresh);

refresh();
