/* Caffeine Decay Graph — pure engine + UI glue. Zero network. */
// ENGINE-START
const INTAKES_KEY = 'caffeine.intakes.v1';
const SETTINGS_KEY = 'caffeine.settings.v1';

// Remaining caffeine from one dose: exponential decay.
// mg: dose in mg, elapsedH: hours since intake, halfLifeH: half-life in hours.
function decayedMg(mg, elapsedH, halfLifeH) {
  if (mg <= 0 || elapsedH < 0 || halfLifeH <= 0) return 0;
  return mg * Math.pow(0.5, elapsedH / halfLifeH);
}
// Total remaining across all intakes at a given time.
function totalRemaining(intakes, atMs, halfLifeH) {
  return intakes.reduce((sum, e) => {
    const elapsedH = (atMs - e.ts) / 36e5;
    if (elapsedH < 0) return sum; // ignore future-dated entries
    return sum + decayedMg(e.mg, elapsedH, halfLifeH);
  }, 0);
}
// Sample the decay curve: returns [{t: ms, mg}] across [startMs, endMs].
function sampleCurve(intakes, halfLifeH, startMs, endMs, steps = 60) {
  const pts = [];
  const span = Math.max(1, endMs - startMs);
  for (let i = 0; i <= steps; i++) {
    const t = startMs + (span * i) / steps;
    pts.push({ t, mg: totalRemaining(intakes, t, halfLifeH) });
  }
  return pts;
}
// Next occurrence (today or tomorrow) of a "HH:MM" time as ms epoch.
function nextTimeMs(hhmm, nowMs = Date.now()) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const d = new Date(nowMs);
  d.setHours(h || 0, m || 0, 0, 0);
  if (d.getTime() <= nowMs) d.setDate(d.getDate() + 1);
  return d.getTime();
}
function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
// ENGINE-END

/* ---------- storage ---------- */
async function loadIntakes() {
  const { [INTAKES_KEY]: v } = await chrome.storage.local.get(INTAKES_KEY);
  return Array.isArray(v) ? v : [];
}
async function saveIntakes(v) { await chrome.storage.local.set({ [INTAKES_KEY]: v }); }
async function loadSettings() {
  const { [SETTINGS_KEY]: v } = await chrome.storage.local.get(SETTINGS_KEY);
  return Object.assign({ halfLife: 5.7, bedtime: '23:00' }, v || {});
}
async function saveSettings(v) { await chrome.storage.local.set({ [SETTINGS_KEY]: v }); }

/* ---------- UI ---------- */
const $ = id => document.getElementById(id);

function drawChart(intakes, settings) {
  const canvas = $('decayChart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const now = Date.now();
  const pad = 16;
  const bedMs = nextTimeMs(settings.bedtime, now);
  // window: from now to bedtime + 2h (covers "what's left at bedtime")
  const endMs = bedMs + 2 * 36e5;
  const pts = sampleCurve(intakes, settings.halfLife, now, endMs);
  const maxMg = Math.max(10, ...pts.map(p => p.mg));
  const x = t => pad + ((t - now) / (endMs - now)) * (W - pad * 2);
  const y = mg => H - pad - (mg / maxMg) * (H - pad * 2 - 10);

  // gridlines
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
  for (const g of [0, maxMg / 2, maxMg]) {
    ctx.beginPath(); ctx.moveTo(pad, y(g)); ctx.lineTo(W - pad, y(g)); ctx.stroke();
    ctx.fillStyle = '#6b7488'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(Math.round(g) + 'mg', pad + 2, y(g) - 2);
  }
  // bedtime marker
  ctx.strokeStyle = '#818cf8'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x(bedMs), pad); ctx.lineTo(x(bedMs), H - pad); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#818cf8'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText('bed ' + fmtTime(bedMs), x(bedMs) - 3, pad + 8);

  if (!intakes.length) {
    ctx.fillStyle = '#6b7488'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Log an intake below to see the decay curve.', W / 2, H / 2 + 4);
    return;
  }
  // now marker
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x(now), pad); ctx.lineTo(x(now), H - pad); ctx.stroke();
  // curve
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
  pts.forEach((p, i) => { i ? ctx.lineTo(x(p.t), y(p.mg)) : ctx.moveTo(x(p.t), y(p.mg)); });
  ctx.stroke();
  // bedtime remaining label
  const atBed = totalRemaining(intakes, bedMs, settings.halfLife);
  ctx.fillStyle = '#818cf8'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(Math.round(atBed) + 'mg at bedtime', Math.min(x(bedMs) + 4, W - 100), y(atBed) - 6);
}

function renderIntakes(intakes) {
  const ul = $('intakeList');
  ul.innerHTML = '';
  const todays = intakes.filter(e => new Date(e.ts).toDateString() === new Date().toDateString());
  if (!todays.length) { ul.innerHTML = '<li class="empty">Nothing logged today.</li>'; return; }
  [...todays].sort((a, b) => b.ts - a.ts).forEach(e => {
    const li = document.createElement('li');
    li.innerHTML = `<span><span class="pill">${e.mg}mg</span> <span class="meta">${fmtTime(e.ts)}</span></span>`;
    const btn = document.createElement('button');
    btn.className = 'del'; btn.textContent = '×'; btn.title = 'Delete';
    btn.addEventListener('click', async () => {
      const all = (await loadIntakes()).filter(x => x.ts !== e.ts || x.mg !== e.mg);
      await saveIntakes(all); refresh();
    });
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

async function refresh() {
  const [intakes, settings] = await Promise.all([loadIntakes(), loadSettings()]);
  const now = Date.now();
  const remaining = totalRemaining(intakes, now, settings.halfLife);
  $('nowMg').textContent = Math.round(remaining);
  $('nowDetail').textContent = intakes.length
    ? `${intakes.length} dose${intakes.length > 1 ? 's' : ''} logged · half-life ${settings.halfLife}h`
    : 'No doses logged yet.';
  $('halfLife').value = settings.halfLife;
  $('bedtime').value = settings.bedtime;
  drawChart(intakes, settings);
  renderIntakes(intakes);
}

document.addEventListener('DOMContentLoaded', () => {
  // default "when" to current time
  const d = new Date();
  $('when').value = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  refresh();
  $('logForm').addEventListener('submit', async e => {
    e.preventDefault();
    const mg = Math.min(1000, Math.max(1, Math.round(Number($('mg').value) || 0)));
    if (!mg) return;
    const [h, m] = $('when').value.split(':').map(Number);
    const ts = new Date(); ts.setHours(h, m, 0, 0);
    const intakes = await loadIntakes();
    intakes.push({ mg, ts: ts.getTime() });
    await saveIntakes(intakes);
    refresh();
  });
  $('saveSettings').addEventListener('click', async () => {
    const halfLife = Math.min(12, Math.max(2, Number($('halfLife').value) || 5.7));
    await saveSettings({ halfLife, bedtime: $('bedtime').value || '23:00' });
    refresh();
  });
  $('clearBtn').addEventListener('click', async () => {
    if (confirm('Clear all logged intakes?')) { await saveIntakes([]); refresh(); }
  });
  // live "now" readout ticks every minute
  setInterval(refresh, 60e3);
});
