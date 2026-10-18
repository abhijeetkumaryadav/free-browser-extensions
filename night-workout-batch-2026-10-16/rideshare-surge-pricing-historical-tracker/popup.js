/* SurgeLog — manual ride-surge journal.
   Honest scope: there is no live rideshare pricing API available to an
   extension, so everything shown here comes from rides the user logs
   by hand. All data stays in chrome.storage.local. */

// --- State ---------------------------------------------------------------
const state = { rides: [] }; // [{id, date, time, app, from, to, base, surge, paid, notes}]

// --- DOM -----------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// --- Helpers (pure, unit-tested below) -----------------------------------
function money(n) {
  return (n == null || isNaN(n)) ? '–' : n.toFixed(2);
}
function fmtSurge(x) { return x.toFixed(1) + '×'; }

// Group average surge by hour-of-day (0..23) and by weekday (0..6).
function aggregate(rides) {
  const byHour = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }));
  const byDay = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
  for (const r of rides) {
    const h = parseInt((r.time || '12:00').slice(0, 2), 10);
    if (!isNaN(h) && h >= 0 && h < 24) { byHour[h].sum += r.surge; byHour[h].n++; }
    const d = new Date(r.date + 'T12:00:00').getDay();
    if (!isNaN(d)) { byDay[d].sum += r.surge; byDay[d].n++; }
  }
  return { byHour, byDay };
}

function stats(rides) {
  if (!rides.length) return null;
  const surges = rides.map((r) => r.surge);
  const paid = rides.map((r) => r.paid || 0);
  return {
    count: rides.length,
    avg: surges.reduce((a, b) => a + b, 0) / surges.length,
    max: Math.max(...surges),
    spent: paid.reduce((a, b) => a + b, 0),
  };
}

// --- Persistence ---------------------------------------------------------
async function persist() { await chrome.storage.local.set({ surgelog: state.rides }); }
async function restore() {
  const r = await chrome.storage.local.get('surgelog');
  if (Array.isArray(r.surgelog)) state.rides = r.surgelog;
  render();
}

// --- Rendering -----------------------------------------------------------
function render() {
  const rides = [...state.rides].sort((a, b) =>
    (b.date + b.time).localeCompare(a.date + a.time));

  // Stat tiles
  const s = stats(rides);
  $('stRides').textContent = s ? s.count : 0;
  $('stAvg').textContent = s ? fmtSurge(s.avg) : '–';
  $('stMax').textContent = s ? fmtSurge(s.max) : '–';
  $('stSpent').textContent = s ? money(s.spent) : '–';

  // Charts
  const { byHour, byDay } = aggregate(rides);
  renderBars($('hourBars'),
    byHour.map((b, h) => ({
      label: h % 3 === 0 ? h + ':00' : '',
      value: b.n ? b.sum / b.n : null,
    })));
  renderBars($('dayBars'),
    byDay.map((b, d) => ({ label: DAYS[d], value: b.n ? b.sum / b.n : null })));

  // Log list
  const list = $('logList');
  list.innerHTML = '';
  $('logCount').textContent = rides.length ? rides.length + ' logged' : '';
  $('csvBtn').disabled = rides.length === 0;
  $('clearBtn').disabled = rides.length === 0;
  if (!rides.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No rides logged yet.';
    list.append(li);
    return;
  }
  for (const r of rides) {
    const li = document.createElement('li');
    li.className = 'ride';
    const top = document.createElement('div');
    top.className = 'top';
    const route = document.createElement('span');
    route.className = 'route';
    route.textContent = (r.from || '?') + ' → ' + (r.to || '?');
    const surge = document.createElement('span');
    surge.className = 'surge';
    surge.textContent = fmtSurge(r.surge);
    top.append(route, surge);
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${r.date} ${r.time || ''} · ${r.app} · paid ${money(r.paid)}`;
    li.append(top, meta);
    if (r.notes) {
      const n = document.createElement('div');
      n.className = 'notes';
      n.textContent = r.notes;
      li.append(n);
    }
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = 'delete';
    del.addEventListener('click', async () => {
      state.rides = state.rides.filter((x) => x.id !== r.id);
      await persist(); render();
    });
    li.append(del);
    list.append(li);
  }
}

function renderBars(el, buckets) {
  el.innerHTML = '';
  const vals = buckets.map((b) => b.value).filter((v) => v != null);
  if (!vals.length) {
    const p = document.createElement('p');
    p.className = 'none';
    p.textContent = 'Log rides to see patterns.';
    el.append(p);
    return;
  }
  const max = Math.max(...vals, 1.0);
  const min = 1.0; // surge baseline
  for (const b of buckets) {
    const wrap = document.createElement('div');
    wrap.className = 'bar';
    const val = document.createElement('div');
    val.className = 'val';
    val.textContent = b.value != null ? b.value.toFixed(1) : '';
    const col = document.createElement('div');
    col.className = 'col';
    const h = b.value != null ? Math.max(4, ((b.value - min) / Math.max(max - min, 0.01)) * 64) : 2;
    col.style.height = (b.value != null ? h : 2) + 'px';
    if (b.value == null) col.style.opacity = '.25';
    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = b.label;
    wrap.append(val, col, lbl);
    el.append(wrap);
  }
}

// --- Add ride ------------------------------------------------------------
function setFormNote(msg) { $('formNote').textContent = msg || ''; }

async function addRide() {
  const date = $('fDate').value;
  const time = $('fTime').value;
  const surge = parseFloat($('fSurge').value);
  const base = parseFloat($('fBase').value);
  if (!date) { setFormNote('Pick a date.'); return; }
  if (!(surge >= 1)) { setFormNote('Surge must be 1.0 or more.'); return; }
  let paid = parseFloat($('fPaid').value);
  if (isNaN(paid)) {
    if (isNaN(base)) { setFormNote('Enter a base fare or the paid fare.'); return; }
    paid = Math.round(base * surge * 100) / 100; // auto: base × surge
  }
  state.rides.push({
    id: 'r' + Date.now() + Math.floor(Math.random() * 1e4),
    date,
    time: time || '',
    app: $('fApp').value,
    from: $('fFrom').value.trim(),
    to: $('fTo').value.trim(),
    base: isNaN(base) ? null : base,
    surge,
    paid,
    notes: $('fNotes').value.trim(),
  });
  // Reset inputs
  $('fFrom').value = ''; $('fTo').value = '';
  $('fBase').value = ''; $('fPaid').value = ''; $('fNotes').value = '';
  $('fSurge').value = '1.0';
  setFormNote('');
  await persist(); render();
}

// --- CSV export ----------------------------------------------------------
function csvEscape(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportCsv() {
  const rows = [['date', 'time', 'app', 'from', 'to', 'base_fare', 'surge', 'paid_fare', 'notes']];
  for (const r of state.rides) {
    rows.push([r.date, r.time, r.app, r.from, r.to,
      r.base == null ? '' : r.base, r.surge, r.paid, r.notes].map(csvEscape));
  }
  const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'surgelog.csv';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// --- Init ----------------------------------------------------------------
$('addBtn').addEventListener('click', addRide);
$('csvBtn').addEventListener('click', exportCsv);
$('clearBtn').addEventListener('click', async () => {
  if (!confirm('Delete all logged rides?')) return;
  state.rides = []; await persist(); render();
});
// Default date to today
$('fDate').value = new Date().toISOString().slice(0, 10);
restore();
