'use strict';

/* PressWatch popup logic:
 * - city search via Open-Meteo geocoding API (user-typed, no auto geolocation)
 * - current + 24h pressure_msl from Open-Meteo forecast API
 * - simple 3-hour delta heuristic for falling/rising read
 *   (heuristic only — NOT an official weather warning)
 */

const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search';
const WX_API = 'https://api.open-meteo.com/v1/forecast';
const CITY_KEY = 'presswatchCity';

const $ = (id) => document.getElementById(id);
const els = {
  cityInput: $('cityInput'),
  cityResults: $('cityResults'),
  cityCurrent: $('cityCurrent'),
  cityName: $('cityName'),
  changeCity: $('changeCity'),
  wxCard: $('wxCard'),
  pValue: $('pValue'),
  pTrend: $('pTrend'),
  alertBox: $('alertBox'),
  pChart: $('pChart'),
  pMin: $('pMin'),
  pMax: $('pMax'),
  refreshBtn: $('refreshBtn'),
  errorBox: $('errorBox'),
};

let city = null;

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
  city = {
    name: r.name,
    country: r.country || '',
    lat: r.latitude,
    lon: r.longitude,
  };
  await chrome.storage.local.set({ [CITY_KEY]: city });
  els.cityResults.classList.add('hidden');
  els.cityInput.value = '';
  renderCityHeader();
  await refreshPressure();
}

function renderCityHeader() {
  if (city) {
    els.cityName.textContent = city.country ? `${city.name}, ${city.country}` : city.name;
    els.cityCurrent.classList.remove('hidden');
    els.cityInput.parentElement.classList.add('hidden');
  } else {
    els.cityCurrent.classList.add('hidden');
    els.cityInput.parentElement.classList.remove('hidden');
  }
}

els.changeCity.addEventListener('click', async () => {
  city = null;
  await chrome.storage.local.remove(CITY_KEY);
  els.wxCard.classList.add('hidden');
  renderCityHeader();
});

/* ---------- pressure data ---------- */
els.refreshBtn.addEventListener('click', refreshPressure);

async function refreshPressure() {
  if (!city) return;
  clearError();
  try {
    const url = `${WX_API}?latitude=${city.lat}&longitude=${city.lon}` +
      `&current=pressure_msl&hourly=pressure_msl&past_days=1&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather service returned ' + res.status);
    const data = await res.json();
    renderPressure(data);
  } catch (e) {
    showError('Could not load pressure data: ' + e.message + '. Check your connection and try again.');
  }
}

/* Heuristic 3-hour delta classification. Thresholds are a rough rule of
 * thumb used by hobbyist weather watchers — NOT an official warning. */
function classifyDelta(delta) {
  if (delta <= -4) return {
    cls: 'bad', label: 'Falling fast',
    title: 'Pressure dropping fast',
    body: 'A drop of this size over 3 hours often precedes stormy weather. Keep an eye on local forecasts.',
  };
  if (delta <= -1.5) return {
    cls: 'warn', label: 'Falling',
    title: 'Pressure falling',
    body: 'Conditions may be changing — unsettled weather is possible in the coming hours.',
  };
  if (delta >= 2.5) return {
    cls: 'good', label: 'Rising',
    title: 'Pressure rising',
    body: 'Rising pressure usually signals improving, more settled conditions.',
  };
  return {
    cls: 'calm', label: 'Steady',
    title: 'Pressure steady',
    body: 'No significant 3-hour change — conditions are likely holding.',
  };
}

function renderPressure(data) {
  const current = data.current && typeof data.current.pressure_msl === 'number'
    ? data.current.pressure_msl : null;
  if (current === null) throw new Error('No pressure data in response.');

  const times = data.hourly.time || [];
  const vals = data.hourly.pressure_msl || [];

  // Take the last 24 hourly readings.
  const pts = [];
  for (let i = Math.max(0, vals.length - 24); i < vals.length; i++) {
    if (typeof vals[i] === 'number') pts.push({ t: new Date(times[i]), v: vals[i] });
  }

  // 3-hour delta from the freshest readings.
  const n = pts.length;
  const delta = n >= 4 ? pts[n - 1].v - pts[n - 4].v : 0;
  const verdict = classifyDelta(delta);

  els.pValue.textContent = current.toFixed(1);
  els.pTrend.textContent = `${verdict.label} · ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} hPa / 3h`;
  els.pTrend.style.background = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent');
  els.pTrend.style.background = verdictColor(verdict.cls);

  els.alertBox.className = `alert ${verdict.cls}`;
  els.alertBox.innerHTML = `<strong></strong><span></span><small></small>`;
  els.alertBox.querySelector('strong').textContent = verdict.title;
  els.alertBox.querySelector('span').textContent = verdict.body;
  els.alertBox.querySelector('small').textContent = 'Heuristic interpretation — not an official weather warning.';
  els.alertBox.classList.remove('hidden');

  drawChart(pts);
  els.wxCard.classList.remove('hidden');
}

function verdictColor(cls) {
  return { bad: '#ef4444', warn: '#f59e0b', good: '#22c55e', calm: '#9a9aa8' }[cls] || '#9a9aa8';
}

function drawChart(pts) {
  const ctx = els.pChart.getContext('2d');
  const W = els.pChart.width, H = els.pChart.height;
  ctx.clearRect(0, 0, W, H);
  if (pts.length < 2) return;

  const vs = pts.map((p) => p.v);
  let min = Math.min(...vs), max = Math.max(...vs);
  if (max - min < 1) { max += 0.5; min -= 0.5; }

  const padX = 6, padTop = 10, padBot = 16;
  const x = (i) => padX + (i / (pts.length - 1)) * (W - padX * 2);
  const y = (v) => padTop + (1 - (v - min) / (max - min)) * (H - padTop - padBot);

  // area fill
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(99,102,241,0.35)');
  grad.addColorStop(1, 'rgba(99,102,241,0.02)');
  ctx.beginPath();
  ctx.moveTo(x(0), y(pts[0].v));
  pts.forEach((p, i) => ctx.lineTo(x(i), y(p.v)));
  ctx.lineTo(x(pts.length - 1), H - padBot);
  ctx.lineTo(x(0), H - padBot);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // line
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(x(i), y(p.v)) : ctx.lineTo(x(i), y(p.v))));
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // end dot
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(x(pts.length - 1), y(last.v), 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#6366f1';
  ctx.fill();

  // hour ticks every 6h
  ctx.fillStyle = '#9a9aa8';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'center';
  pts.forEach((p, i) => {
    if (p.t.getHours() % 6 === 0) {
      ctx.fillText(String(p.t.getHours()).padStart(2, '0') + ':00', x(i), H - 4);
    }
  });

  els.pMin.textContent = `min ${min.toFixed(1)} hPa`;
  els.pMax.textContent = `max ${max.toFixed(1)} hPa`;
}

/* ---------- init ---------- */
(async function init() {
  const res = await chrome.storage.local.get(CITY_KEY);
  city = res[CITY_KEY] || null;
  renderCityHeader();
  if (city) await refreshPressure();
})();
