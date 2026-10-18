'use strict';
/* Droplet — gamified water logger. All data in chrome.storage.local, zero network.
   Honest scope: the user logs their own intake; goals/streaks are self-reported. */

// ENGINE-START
const DEFAULT_GOAL = 2000;
const DAY_KEY = d => 'day:' + d;

function todayStr(date) {
  const t = date || new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function prevDayStr(dayStr) {
  const [y, m, d] = dayStr.split('-').map(Number);
  const t = new Date(y, m - 1, d);
  t.setDate(t.getDate() - 1);
  return todayStr(t);
}

/* A day record: { ml, glasses, goalMetAt }. All pure on plain objects. */
function addGlass(day, ml) {
  const d = Object.assign({ ml: 0, glasses: 0 }, day);
  d.ml += ml;
  d.glasses += 1;
  return d;
}

function pctOf(day, goal) {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((day.ml / goal) * 100));
}

/* Streak: consecutive days ending today/yesterday where ml >= goalAtThatDay.
   dayRecords: {dayStr: {ml, goal}} — goal snapshot stored per day. */
function calcStreak(dayRecords, goal) {
  let streak = 0;
  let day = todayStr();
  let rec = dayRecords[DAY_KEY(day)];
  const g = rec && rec.goal ? rec.goal : goal;
  if (!rec || rec.ml < g) {
    day = prevDayStr(day); // allow streak to be alive if today is just not met yet
    streak = 0;
  }
  while (true) {
    const r = dayRecords[DAY_KEY(day)];
    const gg = r && r.goal ? r.goal : goal;
    if (r && r.ml >= gg) { streak++; day = prevDayStr(day); }
    else break;
  }
  return streak;
}

function last14(dayRecords, goal) {
  const out = [];
  let day = todayStr();
  for (let i = 0; i < 14; i++) {
    const r = dayRecords[DAY_KEY(day)];
    const g = r && r.goal ? r.goal : goal;
    out.push({ day, ml: r ? r.ml : 0, goal: g, hit: !!(r && r.ml >= g) });
    day = prevDayStr(day);
  }
  return out;
}
// ENGINE-END

/* ---------- UI ---------- */
const $ = id => document.getElementById(id);
const fillEl = $('fill'), todayMlEl = $('todayMl'), goalMlEl = $('goalMl'), pctEl = $('pct');
const streakEl = $('streak'), glassesEl = $('glasses'), avgEl = $('avg');
const glassSizeEl = $('glassSize'), addBtn = $('addBtn'), undoBtn = $('undoBtn');
const goalInput = $('goalInput'), saveGoal = $('saveGoal'), clearToday = $('clearToday');
const historyEl = $('history');

let state = { goal: DEFAULT_GOAL, glassSize: 250, days: {} };
let lastAdded = 0;

function today() { return state.days[DAY_KEY(todayStr())] || { ml: 0, glasses: 0 }; }

async function load() {
  try {
    const got = await chrome.storage.local.get({ goal: DEFAULT_GOAL, glassSize: 250, days: {} });
    state = got;
  } catch (e) { /* defaults */ }
  glassSizeEl.value = String(state.glassSize);
  goalInput.value = state.goal;
  render();
}

function save() {
  return chrome.storage.local.set(state).catch(() => {});
}

function render() {
  const t = today();
  const pct = pctOf(t, state.goal);
  todayMlEl.textContent = t.ml;
  goalMlEl.textContent = state.goal;
  pctEl.textContent = pct + '%';
  // droplet fill: svg rect y goes 140 (empty) -> 6 (full) at 100%
  const y = 140 - (140 - 6) * (pct / 100);
  fillEl.setAttribute('y', y.toFixed(1));

  glassesEl.textContent = t.glasses;
  undoBtn.classList.toggle('hidden', !(lastAdded > 0));

  const hist = last14(state.days, state.goal);
  streakEl.textContent = calcStreak(state.days, state.goal);
  const avg = Math.round(hist.reduce((a, h) => a + h.ml, 0) / 14);
  avgEl.textContent = avg;

  historyEl.innerHTML = '';
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
  for (const h of hist) {
    const [y2, m2, d2] = h.day.split('-').map(Number);
    const row = document.createElement('div');
    row.className = 'hrow';
    const barPct = Math.min(100, Math.round((h.ml / h.goal) * 100));
    row.innerHTML =
      '<span class="d">' + fmt.format(new Date(y2, m2 - 1, d2)) + '</span>' +
      '<span class="hbar"><i style="width:' + barPct + '%"></i></span>' +
      '<span class="ml' + (h.hit ? ' hit' : '') + '">' + h.ml + 'ml</span>';
    historyEl.appendChild(row);
  }
}

addBtn.addEventListener('click', async () => {
  const size = parseInt(glassSizeEl.value, 10) || 250;
  const key = DAY_KEY(todayStr());
  const updated = addGlass(state.days[key], size);
  updated.goal = state.goal; // snapshot goal for streak math
  state.days[key] = updated;
  state.glassSize = size;
  lastAdded = size;
  await save();
  render();
});

undoBtn.addEventListener('click', async () => {
  if (!lastAdded) return;
  const key = DAY_KEY(todayStr());
  const t = today();
  t.ml = Math.max(0, t.ml - lastAdded);
  t.glasses = Math.max(0, t.glasses - 1);
  state.days[key] = t;
  lastAdded = 0;
  await save();
  render();
});

saveGoal.addEventListener('click', async () => {
  const g = parseInt(goalInput.value, 10);
  if (g >= 250 && g <= 10000) {
    state.goal = g;
    await save();
    render();
  } else {
    goalInput.value = state.goal;
  }
});

clearToday.addEventListener('click', async () => {
  if (!confirm('Clear today\'s log?')) return;
  delete state.days[DAY_KEY(todayStr())];
  lastAdded = 0;
  await save();
  render();
});

load();
