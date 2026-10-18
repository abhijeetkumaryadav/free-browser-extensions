'use strict';

/* UVGuard popup logic:
 * - city search via Open-Meteo geocoding API (user-typed, no auto geolocation)
 * - current + next-12h UV from Open-Meteo forecast API
 * - reapply timer via chrome.alarms so it survives popup close
 */

const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search';
const WX_API = 'https://api.open-meteo.com/v1/forecast';
const HOURS_SHOWN = 12;
const TIMER_ALARM = 'uvguard-reapply';
const CITY_KEY = 'uvguardCity';
const TIMER_KEY = 'uvguardTimer';

const $ = (id) => document.getElementById(id);
const els = {
  cityInput: $('cityInput'),
  cityResults: $('cityResults'),
  cityCurrent: $('cityCurrent'),
  cityName: $('cityName'),
  changeCity: $('changeCity'),
  uvCard: $('uvCard'),
  uvValue: $('uvValue'),
  uvBand: $('uvBand'),
  uvRing: $('uvRing'),
  uvRingVal: $('uvRingVal'),
  uvAdvice: $('uvAdvice'),
  uvChart: $('uvChart'),
  timerMinutes: $('timerMinutes'),
  timerStart: $('timerStart'),
  timerCancel: $('timerCancel'),
  timerStatus: $('timerStatus'),
  errorBox: $('errorBox'),
};

let state = { city: null, timer: null };
let tickId = null;

/* ---------- UV bands (WHO guidance) ---------- */
function uvBand(uvi) {
  if (uvi < 3) return { label: 'Low', color: '#22c55e', advice: 'Minimal risk. Sunglasses on bright days; no protection needed.' };
  if (uvi < 6) return { label: 'Moderate', color: '#eab308', advice: 'Seek shade around midday. Wear sunscreen if you stay out long.' };
  if (uvi < 8) return { label: 'High', color: '#f97316', advice: 'Protection required. Sunscreen, hat and sunglasses; seek shade midday.' };
  if (uvi < 11) return { label: 'Very high', color: '#ef4444', advice: 'Extra protection essential. Avoid midday sun; reapply sunscreen often.' };
  return { label: 'Extreme', color: '#8b5cf6', advice: 'Take all precautions — unprotected skin can burn in minutes.' };
}

/* ---------- storage helpers ---------- */
async function saveCity(city) {
  await chrome.storage.local.set({ [CITY_KEY]: city });
}
async function loadStored() {
  const res = await chrome.storage.local.get([CITY_KEY, TIMER_KEY]);
  state.city = res[CITY_KEY] || null;
  state.timer = res[TIMER_KEY] || null;
}
async function saveTimer() {
  if (state.timer) await chrome.storage.local.set({ [TIMER_KEY]: state.timer });
  else await chrome.storage.local.remove(TIMER_KEY);
}

/* ---------- error box ---------- */
function showError(msg) {
  els.errorBox.textContent = msg;
  els.errorBox.classList.remove('hidden');
}
function clearError() {
  els.errorBox.classList.add('hidden');
  els.errorBox.textContent = '';
}

/* ---------- city search ---------- */
let searchTimer = null;
els.cityInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = els.cityInput.value.trim();
  if (q.length < 2) { els.cityResults.classList.add('hidden'); return; }
  searchTimer = setTimeout(() => searchCity(q), 350);
});

async function searchCity(q) {
  try {
    const res = await fetch(`${GEO_API}?name=${encodeURIComponent(q)}&count=5&language=en&format=json`);
    if (!res.ok) throw new Error('Geocoding request failed');
    const data = await res.json();
    renderCityResults(data.results || []);
  } catch (e) {
    showError('City search failed: ' + e.message);
  }
}

function renderCityResults(results) {
  els.cityResults.innerHTML = '';
  if (!results.length) { els.cityResults.classList.add('hidden'); return; }
  for (const r of results) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span></span><small></small>`;
    b.querySelector('span').textContent = r.name;
    b.querySelector('small').textContent = [r.admin1, r.country].filter(Boolean).join(', ');
    b.addEventListener('click', () => selectCity(r));
    els.cityResults.appendChild(b);
  }
  els.cityResults.classList.remove('hidden');
}

async function selectCity(r) {
  state.city = {
    name: r.name,
    country: r.country || '',
    lat: r.latitude,
    lon: r.longitude,
  };
  await saveCity(state.city);
  els.cityResults.classList.add('hidden');
  els.cityInput.value = '';
  renderCityHeader();
  await refreshUV();
}

function renderCityHeader() {
  if (state.city) {
    els.cityName.textContent = state.city.country
      ? `${state.city.name}, ${state.city.country}`
      : state.city.name;
    els.cityCurrent.classList.remove('hidden');
    els.cityInput.parentElement.classList.add('hidden');
  } else {
    els.cityCurrent.classList.add('hidden');
    els.cityInput.parentElement.classList.remove('hidden');
  }
}

els.changeCity.addEventListener('click', () => {
  state.city = null;
  chrome.storage.local.remove(CITY_KEY);
  els.uvCard.classList.add('hidden');
  renderCityHeader();
});

/* ---------- forecast ---------- */
async function refreshUV() {
  if (!state.city) return;
  clearError();
  try {
    const { lat, lon } = state.city;
    const url = `${WX_API}?latitude=${lat}&longitude=${lon}` +
      `&current=uv_index&hourly=uv_index&timezone=auto&forecast_days=2`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather service returned ' + res.status);
    const data = await res.json();
    renderUV(data);
  } catch (e) {
    showError('Could not load UV data: ' + e.message + '. Check your connection and try again.');
  }
}

function renderUV(data) {
  const current = data.current && typeof data.current.uv_index === 'number'
    ? data.current.uv_index : 0;
  const band = uvBand(current);

  els.uvValue.textContent = current.toFixed(1);
  els.uvBand.textContent = band.label;
  els.uvBand.style.background = band.color;
  els.uvRing.style.borderColor = band.color;
  els.uvRingVal.textContent = current.toFixed(1);
  els.uvAdvice.textContent = band.advice;
  els.uvCard.classList.remove('hidden');

  drawHourlyChart(data.hourly);
}

function drawHourlyChart(hourly) {
  const ctx = els.uvChart.getContext('2d');
  const W = els.uvChart.width, H = els.uvChart.height;
  ctx.clearRect(0, 0, W, H);
  if (!hourly || !hourly.time || !hourly.uv_index) return;

  const now = Date.now();
  let start = hourly.time.findIndex((t) => new Date(t).getTime() >= now - 3600000);
  if (start < 0) start = 0;
  const slice = [];
  for (let i = start; i < Math.min(start + HOURS_SHOWN, hourly.time.length); i++) {
    slice.push({ t: new Date(hourly.time[i]), v: hourly.uv_index[i] || 0 });
  }
  if (!slice.length) return;

  const maxV = Math.max(3, ...slice.map((s) => s.v));
  const barW = W / slice.length;
  const pad = 14; // bottom label space

  slice.forEach((s, i) => {
    const band = uvBand(s.v);
    const h = (H - pad - 6) * (s.v / maxV);
    const x = i * barW + barW * 0.22;
    const w = barW * 0.56;
    const y = H - pad - h;
    ctx.fillStyle = band.color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    // value label
    ctx.fillStyle = '#e9e9f0';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(s.v.toFixed(0), i * barW + barW / 2, y - 3);
    // hour label every 3rd bar
    if (i % 3 === 0) {
      ctx.fillStyle = '#9a9aa8';
      const hh = String(s.t.getHours()).padStart(2, '0');
      ctx.fillText(hh + ':00', i * barW + barW / 2, H - 3);
    }
  });
}

/* ---------- reapply timer ---------- */
function fmtRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function renderTimer() {
  if (state.timer && state.timer.endsAt > Date.now()) {
    els.timerStart.classList.add('hidden');
    els.timerCancel.classList.remove('hidden');
    els.timerMinutes.disabled = true;
    els.timerStatus.classList.add('live');
    if (!tickId) tickId = setInterval(onTick, 1000);
    onTick();
  } else {
    state.timer = null;
    saveTimer();
    chrome.action.setBadgeText({ text: '' });
    if (tickId) { clearInterval(tickId); tickId = null; }
    els.timerStart.classList.remove('hidden');
    els.timerCancel.classList.add('hidden');
    els.timerMinutes.disabled = false;
    els.timerStatus.classList.remove('live');
    els.timerStatus.textContent = 'Keeps running even when the popup is closed.';
  }
}

function onTick() {
  if (!state.timer) { renderTimer(); return; }
  const left = state.timer.endsAt - Date.now();
  if (left <= 0) {
    renderTimer();
    els.timerStatus.textContent = 'Timer finished — time to reapply!';
    return;
  }
  els.timerStatus.textContent = `Reapply in ${fmtRemaining(left)}`;
  const mins = Math.ceil(left / 60000);
  chrome.action.setBadgeText({ text: String(mins) });
}

els.timerStart.addEventListener('click', async () => {
  const min = Math.min(480, Math.max(5, parseInt(els.timerMinutes.value, 10) || 0));
  els.timerMinutes.value = min;
  const endsAt = Date.now() + min * 60000;
  try {
    await chrome.alarms.create(TIMER_ALARM, { when: endsAt });
  } catch (e) {
    showError('Could not start timer: ' + e.message);
    return;
  }
  state.timer = { endsAt, durationMin: min };
  await saveTimer();
  renderTimer();
});

els.timerCancel.addEventListener('click', async () => {
  await chrome.alarms.clear(TIMER_ALARM);
  state.timer = null;
  await saveTimer();
  renderTimer();
});

/* ---------- init ---------- */
(async function init() {
  await loadStored();
  renderCityHeader();
  if (state.city) await refreshUV();
  renderTimer();
})();
