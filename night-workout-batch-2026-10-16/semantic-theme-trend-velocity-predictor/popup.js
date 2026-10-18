/* Theme Velocity — manual theme tracker. All data from the user's own logs. */
'use strict';

const $ = (id) => document.getElementById(id);
const store = chrome.storage.local;
const WEEK = 7 * 864e5;

/* ---------- helpers ---------- */

/** Group observations by theme name (case-insensitive), sum counts. */
function groupByTheme(obs) {
  const map = new Map();
  for (const o of obs) {
    const key = o.theme.trim().toLowerCase();
    if (!map.has(key)) map.set(key, { name: o.theme.trim(), count: 0, items: [] });
    const g = map.get(key);
    g.count += o.count || 1;
    g.items.push(o);
  }
  return [...map.values()];
}

/**
 * Compute velocity (mentions/week) per theme over the last 4 weeks.
 * Returns array of {name, velocity} sorted descending.
 */
function computeVelocity(obs, now = Date.now()) {
  const window = 4 * WEEK;
  const cutoff = now - window;
  const counts = new Map();
  for (const o of obs) {
    const t = new Date(o.date).getTime();
    if (isNaN(t) || t < cutoff) continue;
    const key = o.theme.trim().toLowerCase();
    if (!counts.has(key)) counts.set(key, { name: o.theme.trim(), total: 0 });
    counts.get(key).total += o.count || 1;
  }
  return [...counts.values()]
    .map((g) => ({ name: g.name, velocity: +(g.total / 4).toFixed(1) }))
    .sort((a, b) => b.velocity - a.velocity);
}

/** Bucket all observations into weekly totals for the chart (last 8 weeks). */
function weeklyTotals(obs, now = Date.now()) {
  const weeks = new Array(8).fill(0);
  for (const o of obs) {
    const t = new Date(o.date).getTime();
    if (isNaN(t)) continue;
    const idx = Math.floor((now - t) / WEEK);
    if (idx >= 0 && idx < 8) weeks[7 - idx] += o.count || 1;
  }
  return weeks;
}

/* ---------- rendering ---------- */

function fmtWeek(offset) {
  const d = new Date(Date.now() - offset * WEEK);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function render(data) {
  const obs = data.observations || [];
  const themes = groupByTheme(obs);
  const vel = computeVelocity(obs);

  $('stThemes').textContent = themes.length;
  $('stObs').textContent = obs.reduce((s, o) => s + (o.count || 1), 0);
  $('stTop').textContent = vel.length ? vel[0].name.slice(0, 12) : '—';

  // chart
  const weeks = weeklyTotals(obs);
  const max = Math.max(...weeks, 1);
  const chart = $('chart');
  chart.innerHTML = '';
  if (obs.length === 0) {
    chart.innerHTML = '<div class="empty" style="width:100%">No observations yet — log your first one above.</div>';
  } else {
    weeks.forEach((v, i) => {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.title = `${v} mention${v === 1 ? '' : 's'} — week of ${fmtWeek(7 - i)}`;
      const fill = document.createElement('div');
      fill.className = 'fill';
      fill.style.height = `${Math.max(3, (v / max) * 80)}px`;
      const lbl = document.createElement('div');
      lbl.className = 'week';
      lbl.textContent = fmtWeek(7 - i);
      bar.append(fill, lbl);
      chart.append(bar);
    });
  }

  // theme list
  const list = $('themes');
  list.innerHTML = '';
  if (vel.length === 0) {
    list.innerHTML = '<div class="empty">No recent velocity — observations older than 4 weeks are out of the window.</div>';
  } else {
    vel.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'theme';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = t.name;
      const v = document.createElement('span');
      v.className = 'vel';
      v.textContent = `${t.velocity}/wk`;
      const del = document.createElement('button');
      del.textContent = 'remove';
      del.onclick = () => removeTheme(t.name);
      row.append(name, v, del);
      list.append(row);
    });
  }
}

async function removeTheme(name) {
  const { observations = [] } = await store.get('observations');
  const key = name.trim().toLowerCase();
  await store.set({ observations: observations.filter((o) => o.theme.trim().toLowerCase() !== key) });
  refresh();
}

/* ---------- events ---------- */

async function refresh() {
  const data = await store.get('observations');
  render(data);
}

$('addBtn').addEventListener('click', async () => {
  const theme = $('themeName').value.trim();
  if (!theme) { $('themeName').focus(); return; }
  const obs = {
    theme,
    date: $('obsDate').value || new Date().toISOString().slice(0, 10),
    count: Math.max(1, parseInt($('obsCount').value, 10) || 1),
    note: $('obsNote').value.trim()
  };
  const { observations = [] } = await store.get('observations');
  observations.push(obs);
  await store.set({ observations });
  $('themeName').value = '';
  $('obsNote').value = '';
  $('obsCount').value = '1';
  refresh();
});

$('clearBtn').addEventListener('click', async () => {
  if (confirm('Delete all logged themes and observations?')) {
    await store.remove('observations');
    refresh();
  }
});

$('obsDate').value = new Date().toISOString().slice(0, 10);
refresh();
