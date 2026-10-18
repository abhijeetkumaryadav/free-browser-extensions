/* Gig Wage Converter — popup logic.
   All data lives in chrome.storage.local. No network calls. */

'use strict';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'gigWage.shifts.v1';
const PREFS_KEY = 'gigWage.prefs.v1';
const money = (n) => '$' + Number(n).toFixed(2);

/* ---------- storage helpers ---------- */
async function loadShifts() {
  const out = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(out[STORAGE_KEY]) ? out[STORAGE_KEY] : [];
}
async function saveShifts(shifts) {
  await chrome.storage.local.set({ [STORAGE_KEY]: shifts });
}
async function loadPrefs() {
  const out = await chrome.storage.local.get(PREFS_KEY);
  return Object.assign({ mileRate: 0.67, target: 20 }, out[PREFS_KEY] || {});
}
async function savePrefs(prefs) {
  await chrome.storage.local.set({ [PREFS_KEY]: prefs });
}

/* ---------- wage math (pure, unit-testable) ---------- */
// True hourly wage = (gross - expenses - miles*mileRate) / (hours + waitHours)
function trueWage(shift, mileRate) {
  const net = shift.earnings - shift.expenses - shift.miles * mileRate;
  const hrs = shift.hours + shift.waitHours;
  if (hrs <= 0) return 0;
  return net / hrs;
}
function aggregate(shifts, mileRate) {
  let net = 0, hrs = 0;
  for (const s of shifts) {
    net += s.earnings - s.expenses - s.miles * mileRate;
    hrs += s.hours + s.waitHours;
  }
  return { net, hrs, wage: hrs > 0 ? net / hrs : 0, count: shifts.length };
}
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfWeek(d) {
  const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x;
}
function filterRange(shifts, range) {
  if (range === 'all') return shifts;
  const now = new Date();
  const from = range === 'day' ? startOfDay(now) : startOfWeek(now);
  return shifts.filter((s) => new Date(s.date + 'T12:00:00') >= from);
}

let shifts = [];
let prefs = { mileRate: 0.67, target: 20 };
let range = 'day';

/* ---------- rendering ---------- */
function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
const GIG_LABELS = { delivery: 'Delivery', rideshare: 'Rideshare', task: 'Task', freelance: 'Freelance', other: 'Other' };

async function render() {
  shifts = await loadShifts();
  prefs = await loadPrefs();

  // Verdict card: most recent shift's true wage
  if (shifts.length) {
    const latest = shifts[shifts.length - 1];
    const w = trueWage(latest, prefs.mileRate);
    $('wageValue').textContent = money(w) + '/hr';
    $('wageSub').textContent =
      `${GIG_LABELS[latest.gigType] || 'Shift'} · ${fmtDate(latest.date)} · net ${money(latest.earnings - latest.expenses - latest.miles * prefs.mileRate)} over ${(latest.hours + latest.waitHours).toFixed(2)} hrs`;
  } else {
    $('wageValue').textContent = '—';
    $('wageSub').textContent = 'Add a shift to see your real rate.';
  }

  // Summary stats
  const inRange = filterRange(shifts, range);
  const agg = aggregate(inRange, prefs.mileRate);
  $('statWage').textContent = inRange.length ? money(agg.wage) : '—';
  $('statNet').textContent = money(agg.net);
  $('statHours').textContent = agg.hrs.toFixed(1);
  $('statShifts').textContent = String(agg.count);

  // Target comparison
  if (inRange.length && prefs.target > 0) {
    const diff = agg.wage - prefs.target;
    $('compareOut').innerHTML = diff >= 0
      ? `<span class="good">▲ ${money(diff)}/hr above</span> your target`
      : `<span class="bad">▼ ${money(-diff)}/hr below</span> your target`;
  } else {
    $('compareOut').textContent = '';
  }

  // Shift list (newest first)
  const list = $('shiftList');
  list.innerHTML = '';
  if (!shifts.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No shifts yet — log your first one above.';
    list.appendChild(li);
  } else {
    [...shifts].reverse().forEach((s) => {
      const li = document.createElement('li');
      li.className = 'shift-item';
      const meta = document.createElement('div');
      meta.className = 'meta';
      const title = document.createElement('div');
      title.textContent = `${GIG_LABELS[s.gigType] || 'Shift'} · ${money(s.earnings)}`;
      const sub = document.createElement('small');
      sub.textContent = `${fmtDate(s.date)} · ${(s.hours + s.waitHours).toFixed(1)} hrs · ${s.miles} mi`;
      meta.appendChild(title); meta.appendChild(sub);
      const wage = document.createElement('div');
      wage.className = 'wage';
      wage.textContent = money(trueWage(s, prefs.mileRate)) + '/hr';
      const del = document.createElement('button');
      del.className = 'del'; del.textContent = '×'; del.title = 'Delete shift';
      del.addEventListener('click', async () => {
        shifts = shifts.filter((x) => x.id !== s.id);
        await saveShifts(shifts);
        render();
      });
      li.appendChild(meta); li.appendChild(wage); li.appendChild(del);
      list.appendChild(li);
    });
  }
}

/* ---------- events ---------- */
function bindEvents() {
  $('date').value = new Date().toISOString().slice(0, 10);
  $('mileRate').value = prefs.mileRate;
  $('target').value = prefs.target;

  $('addBtn').addEventListener('click', async () => {
    const earnings = parseFloat($('earnings').value) || 0;
    const hours = parseFloat($('hours').value) || 0;
    if (earnings <= 0 || hours <= 0) {
      $('wageSub').textContent = 'Enter gross earnings and active hours to log a shift.';
      return;
    }
    const mileRate = parseFloat($('mileRate').value);
    prefs.mileRate = Number.isFinite(mileRate) && mileRate >= 0 ? mileRate : prefs.mileRate;
    await savePrefs(prefs);
    shifts.push({
      id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4),
      gigType: $('gigType').value,
      date: $('date').value || new Date().toISOString().slice(0, 10),
      earnings,
      hours,
      waitHours: parseFloat($('waitHours').value) || 0,
      miles: parseFloat($('miles').value) || 0,
      expenses: parseFloat($('expenses').value) || 0,
    });
    await saveShifts(shifts);
    $('earnings').value = ''; $('hours').value = '';
    $('waitHours').value = '0'; $('miles').value = '0'; $('expenses').value = '0';
    render();
  });

  $('target').addEventListener('change', async () => {
    const t = parseFloat($('target').value);
    prefs.target = Number.isFinite(t) && t >= 0 ? t : 20;
    await savePrefs(prefs);
    render();
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      range = tab.dataset.range;
      render();
    });
  });

  $('clearBtn').addEventListener('click', async () => {
    if (!confirm('Delete all logged shifts? This cannot be undone.')) return;
    shifts = [];
    await saveShifts(shifts);
    render();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await render();   // loads prefs first
  bindEvents();
});
