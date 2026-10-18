// Stair Climb Visualizer — popup.
'use strict';

const DEF = { scTarget: 10, scLogs: {} }; // scLogs: { 'YYYY-MM-DD': flights }

// ENGINE-START
const STEPS_PER_FLIGHT = 12;
// Local date key YYYY-MM-DD.
function dayKey(d) {
  d = d || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
// Add flights to today's (or a given day's) log. Pure — returns a new logs object.
function addFlights(logs, flights, key) {
  const k = key || dayKey();
  const out = { ...logs };
  out[k] = Math.round(((out[k] || 0) + flights) * 10) / 10;
  return out;
}
// Steps -> flights (1 flight ≈ 12 steps).
function stepsToFlights(steps) {
  return steps / STEPS_PER_FLIGHT;
}
// Last N day keys ending at `today` (inclusive).
function lastNDays(n, todayKey) {
  const out = [];
  const [y, m, d] = todayKey.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(base);
    dt.setDate(base.getDate() - i);
    out.push(dayKey(dt));
  }
  return out;
}
// Milestone badges for a flight count.
function badgesFor(flights) {
  const b = [];
  if (flights >= 5) b.push('🔥 5 flights');
  if (flights >= 10) b.push('⚡ 10 flights');
  if (flights >= 25) b.push('🏔️ 25 flights');
  if (flights >= 50) b.push('🚀 50 flights');
  return b;
}
// ENGINE-END

const $ = (id) => document.getElementById(id);

async function load() {
  const cfg = await chrome.storage.local.get(DEF);
  render(cfg);
}

function render(cfg) {
  const today = dayKey();
  const count = cfg.scLogs[today] || 0;
  $('todayCount').textContent = count;
  $('targetEcho').textContent = cfg.scTarget;
  $('target').value = cfg.scTarget;
  const pct = Math.min(100, (count / Math.max(1, cfg.scTarget)) * 100);
  $('fill').style.width = pct + '%';

  const badges = badgesFor(count);
  $('badges').innerHTML = badges.map((b) => `<span class="badge">${b}</span>`).join('');

  // 7-day history bars
  const keys = lastNDays(7, today);
  const max = Math.max(1, ...keys.map((k) => cfg.scLogs[k] || 0));
  $('history').innerHTML = keys.map((k) => {
    const v = cfg.scLogs[k] || 0;
    const d = new Date(k + 'T12:00:00');
    const label = d.toLocaleDateString(undefined, { weekday: 'narrow' });
    return `<div class="day${k === today ? ' today' : ''}">
      <div class="col" style="height:64px"><i style="height:${(v / max) * 100}%"></i></div>
      <b>${v || ''}</b><span>${label}</span></div>`;
  }).join('');
}

$('logBtn').addEventListener('click', async () => {
  const f = Math.min(500, Math.max(1, parseFloat($('flights').value) || 1));
  const cfg = await chrome.storage.local.get(DEF);
  cfg.scLogs = addFlights(cfg.scLogs, f);
  await chrome.storage.local.set(cfg);
  render(cfg);
});
$('logSteps').addEventListener('click', async () => {
  const s = Math.min(10000, Math.max(1, parseFloat($('steps').value) || 20));
  const cfg = await chrome.storage.local.get(DEF);
  cfg.scLogs = addFlights(cfg.scLogs, Math.round(stepsToFlights(s) * 10) / 10);
  await chrome.storage.local.set(cfg);
  render(cfg);
});
$('target').addEventListener('change', async (e) => {
  const v = Math.min(200, Math.max(1, parseInt(e.target.value, 10) || 10));
  const cfg = await chrome.storage.local.get(DEF);
  cfg.scTarget = v;
  await chrome.storage.local.set(cfg);
  render(cfg);
});

load();
