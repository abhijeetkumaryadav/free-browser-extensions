'use strict';

// ===== ENGINE-START =====
// Pure AQI logic — US EPA bands. No network, no DOM.
const AQI_BANDS = [
  { min: 0,   max: 50,  label: 'Good',                        color: '#34d399' },
  { min: 51,  max: 100, label: 'Moderate',                    color: '#facc15' },
  { min: 101, max: 150, label: 'Unhealthy for Sensitive Groups', color: '#fb923c' },
  { min: 151, max: 200, label: 'Unhealthy',                   color: '#f87171' },
  { min: 201, max: 300, label: 'Very Unhealthy',              color: '#c084fc' },
  { min: 301, max: 500, label: 'Hazardous',                   color: '#7f1d1d' },
];

function aqiBand(aqi) {
  if (typeof aqi !== 'number' || isNaN(aqi) || aqi < 0 || aqi > 500) return null;
  return AQI_BANDS.find(b => aqi >= b.min && aqi <= b.max) || null;
}

// Rough PM2.5 (ug/m3) -> estimated AQI-band label, for context only.
function pm25Band(pm) {
  if (typeof pm !== 'number' || isNaN(pm) || pm < 0) return null;
  if (pm <= 12)    return 'Good';
  if (pm <= 35.4)  return 'Moderate';
  if (pm <= 55.4)  return 'Unhealthy for Sensitive Groups';
  if (pm <= 150.4) return 'Unhealthy';
  if (pm <= 250.4) return 'Very Unhealthy';
  return 'Hazardous';
}

function makeReading(aqi, pm25, note) {
  if (aqiBand(aqi) === null) return null;
  const r = { aqi, ts: Date.now(), note: (note || '').trim().slice(0, 120) };
  if (pm25Band(pm25) !== null) r.pm25 = pm25;
  return r;
}

function sortReadings(readings) {
  return (readings || []).slice().sort((a, b) => b.ts - a.ts);
}

function worstInWindow(readings, days) {
  const cutoff = Date.now() - days * 864e5;
  let worst = null;
  for (const r of readings || []) {
    if (r.ts >= cutoff && (worst === null || r.aqi > worst)) worst = r.aqi;
  }
  return worst;
}

function fmtWhen(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
// ===== ENGINE-END =====

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'aqi_readings';

// --- Tabs ---
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('pane-' + btn.dataset.tab).classList.add('active');
  });
});

// --- Guide band list ---
(function renderBands() {
  const ul = $('bands');
  ul.innerHTML = '';
  for (const b of AQI_BANDS) {
    const li = document.createElement('li');
    const badge = document.createElement('span');
    badge.className = 'band-badge';
    badge.style.background = b.color;
    badge.textContent = b.label;
    li.appendChild(badge);
    const rng = document.createElement('span');
    rng.className = 'rng';
    rng.textContent = b.min + '–' + b.max;
    li.appendChild(rng);
    const tip = document.createElement('span');
    tip.textContent = bandTip(b.label);
    li.appendChild(tip);
    ul.appendChild(li);
  }
})();

function bandTip(label) {
  switch (label) {
    case 'Good': return 'Air quality is satisfactory.';
    case 'Moderate': return 'Acceptable; some pollutants may concern the very sensitive.';
    case 'Unhealthy for Sensitive Groups': return 'Sensitive groups should shorten outdoor exertion.';
    case 'Unhealthy': return 'Everyone may feel effects; limit prolonged outdoor exertion.';
    case 'Very Unhealthy': return 'Health alert — avoid outdoor exertion.';
    case 'Hazardous': return 'Emergency conditions — stay indoors.';
    default: return '';
  }
}

// --- Storage ---
async function loadReadings() {
  const out = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(out[STORAGE_KEY]) ? out[STORAGE_KEY] : [];
}
async function saveReadings(list) {
  await chrome.storage.local.set({ [STORAGE_KEY]: list });
}

// --- Preview ---
function parseAqi() {
  const v = parseFloat($('aqiInput').value);
  return isNaN(v) ? NaN : v;
}
function updatePreview() {
  const box = $('preview');
  const b = aqiBand(parseAqi());
  if (!b) { box.textContent = ''; return; }
  box.innerHTML = '';
  const s = document.createElement('span');
  s.className = 'band-badge';
  s.style.background = b.color;
  s.textContent = b.label;
  box.appendChild(s);
}
$('aqiInput').addEventListener('input', updatePreview);

// --- Render history + stats ---
async function refresh() {
  const list = sortReadings(await loadReadings());
  const ul = $('history');
  ul.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No readings yet — log what you observe.';
    ul.appendChild(li);
  }
  for (const r of list) {
    const b = aqiBand(r.aqi);
    const li = document.createElement('li');
    const val = document.createElement('span');
    val.className = 'val';
    val.style.color = b ? b.color : 'inherit';
    val.textContent = r.aqi;
    li.appendChild(val);
    const badge = document.createElement('span');
    badge.className = 'band-badge';
    badge.style.background = b.color;
    badge.textContent = b.label;
    li.appendChild(badge);
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = (r.pm25 != null ? r.pm25 + ' µg/m³ · ' : '') +
      (r.note ? r.note + ' · ' : '') + fmtWhen(r.ts);
    li.appendChild(meta);
    const del = document.createElement('button');
    del.className = 'del';
    del.title = 'Delete';
    del.textContent = '×';
    del.addEventListener('click', async () => {
      await saveReadings(list.filter(x => x.ts !== r.ts));
      refresh();
    });
    li.appendChild(del);
    ul.appendChild(li);
  }
  $('statCount').textContent = list.length;
  $('statLatest').textContent = list.length ? list[0].aqi : '—';
  const worst = worstInWindow(list, 7);
  $('statWorst').textContent = worst === null ? '—' : worst;
}

// --- Add reading ---
$('addBtn').addEventListener('click', async () => {
  const aqi = parseAqi();
  const pmRaw = parseFloat($('pmInput').value);
  const pm = isNaN(pmRaw) ? undefined : pmRaw;
  const r = makeReading(aqi, pm, $('noteInput').value);
  if (!r) {
    $('preview').textContent = 'Enter a valid AQI between 0 and 500.';
    return;
  }
  const list = await loadReadings();
  list.push(r);
  await saveReadings(list);
  $('aqiInput').value = '';
  $('pmInput').value = '';
  $('noteInput').value = '';
  updatePreview();
  refresh();
});

// --- Clear ---
$('clearBtn').addEventListener('click', async () => {
  if (confirm('Delete all logged readings?')) {
    await saveReadings([]);
    refresh();
  }
});

updatePreview();
refresh();
