/* Review Velocity Analyzer — manual logging only. Never scrapes Google Maps.
   All data stays in on-device chrome.storage.local. */
'use strict';

const $ = (id) => document.getElementById(id);
const bizSelect = $('bizSelect'), bizForm = $('bizForm'), bizName = $('bizName');
const logCard = $('logCard'), statsCard = $('statsCard');

let state = { businesses: [], remind: false }; // businesses: [{id, name, logs:[{d, count, stars}]}]
let currentId = null;

init();

async function init() {
  const d = await chrome.storage.local.get(['rvaState']);
  if (d.rvaState) state = d.rvaState;
  $('logDate').valueAsDate = new Date();
  renderBizSelect();
  $('remindToggle').checked = !!state.remind;
}

function save() { return chrome.storage.local.set({ rvaState: state }); }
const biz = () => state.businesses.find((b) => b.id === currentId);

/* ---------- businesses ---------- */
function renderBizSelect() {
  bizSelect.innerHTML = '';
  if (!state.businesses.length) {
    bizSelect.innerHTML = '<option value="">No businesses yet — click + Add</option>';
    currentId = null;
  } else {
    if (!state.businesses.some((b) => b.id === currentId)) currentId = state.businesses[0].id;
    for (const b of state.businesses) {
      const o = document.createElement('option');
      o.value = b.id; o.textContent = b.name;
      if (b.id === currentId) o.selected = true;
      bizSelect.appendChild(o);
    }
  }
  renderAll();
}
bizSelect.addEventListener('change', () => { currentId = bizSelect.value; renderAll(); });

$('addBizBtn').addEventListener('click', () => { bizForm.classList.remove('hidden'); bizName.focus(); });
$('bizCancel').addEventListener('click', () => { bizForm.classList.add('hidden'); bizName.value = ''; });
$('bizSave').addEventListener('click', async () => {
  const name = bizName.value.trim();
  if (!name) { bizName.focus(); return; }
  const b = { id: 'b' + Date.now().toString(36), name, logs: [] };
  state.businesses.push(b);
  currentId = b.id;
  bizForm.classList.add('hidden'); bizName.value = '';
  await save(); renderBizSelect();
});
$('delBizBtn').addEventListener('click', async () => {
  const b = biz(); if (!b) return;
  if (!confirm(`Delete "${b.name}" and all its logged data?`)) return;
  state.businesses = state.businesses.filter((x) => x.id !== currentId);
  currentId = null;
  await save(); renderBizSelect();
});

/* ---------- logging datapoints ---------- */
$('logBtn').addEventListener('click', async () => {
  const b = biz(); if (!b) return;
  const d = $('logDate').value;
  const count = parseInt($('logCount').value, 10);
  const stars = parseFloat($('logStars').value);
  if (!d || isNaN(count) || count < 0) { $('logCount').focus(); return; }
  if (isNaN(stars) || stars < 1 || stars > 5) { $('logStars').focus(); return; }
  b.logs = b.logs.filter((l) => l.d !== d); // replace same-day entry
  b.logs.push({ d, count, stars });
  b.logs.sort((a, c) => a.d.localeCompare(c.d));
  $('logCount').value = ''; $('logStars').value = '';
  await save(); renderAll();
});

/* ---------- insights ---------- */
function renderAll() {
  const b = biz();
  logCard.classList.toggle('hidden', !b);
  statsCard.classList.toggle('hidden', !b || b.logs.length < 1);
  if (!b) return;
  renderStats(b);
  renderHistory(b);
  drawChart(b);
}

function velocityPerWeek(logs) {
  // Reviews gained per week between first and last datapoint.
  if (logs.length < 2) return null;
  const first = logs[0], last = logs[logs.length - 1];
  const days = Math.max(1, (new Date(last.d) - new Date(first.d)) / 86400000);
  return ((last.count - first.count) / days) * 7;
}

function renderStats(b) {
  const logs = b.logs;
  const el = $('stats');
  const latest = logs[logs.length - 1];
  const vel = velocityPerWeek(logs);
  const starDelta = logs.length >= 2 ? (latest.stars - logs[0].stars) : 0;
  const starCls = starDelta > 0.05 ? 'up' : starDelta < -0.05 ? 'down' : 'flat';
  const starArrow = starDelta > 0.05 ? '▲' : starDelta < -0.05 ? '▼' : '●';

  let velHtml = '<b>—</b>';
  if (vel !== null) {
    const cls = vel > 0 ? 'up' : vel < 0 ? 'down' : 'flat';
    velHtml = `<b class="${cls}">${vel >= 0 ? '+' : ''}${vel.toFixed(1)}/wk</b>`;
  }
  el.innerHTML =
    `<span class="stat">Total reviews<b>${latest.count}</b></span>` +
    `<span class="stat">Avg stars<b>${latest.stars.toFixed(1)} ★</b></span>` +
    `<span class="stat">Velocity${velHtml}</span>` +
    `<span class="stat">Star trend<b class="${starCls}">${starArrow} ${Math.abs(starDelta).toFixed(2)}</b></span>` +
    `<span class="stat">Datapoints<b>${logs.length}</b></span>`;
}

function renderHistory(b) {
  const el = $('history');
  if (!b.logs.length) { el.innerHTML = '<p class="empty">No datapoints yet.</p>'; return; }
  el.innerHTML = '';
  [...b.logs].reverse().forEach((l) => {
    const row = document.createElement('div');
    row.className = 'hist-row';
    row.innerHTML = `<span class="d">${l.d}</span><span class="c">${l.count} reviews</span><span class="s">${l.stars.toFixed(1)} ★</span>`;
    const del = document.createElement('button');
    del.title = 'Delete datapoint';
    del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    del.addEventListener('click', async () => {
      b.logs = b.logs.filter((x) => x.d !== l.d);
      await save(); renderAll();
    });
    row.appendChild(del);
    el.appendChild(row);
  });
}

/* Simple canvas line chart: review count over time + star dots. */
function drawChart(b) {
  const c = $('chart');
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  const logs = b.logs;
  if (logs.length < 2) {
    ctx.fillStyle = '#9a9aa6'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Log at least 2 datapoints to see the trend.', W / 2, H / 2);
    return;
  }
  const pad = 26;
  const counts = logs.map((l) => l.count);
  const min = Math.min(...counts), max = Math.max(...counts);
  const span = Math.max(1, max - min);
  const x = (i) => pad + (i * (W - pad * 2)) / (logs.length - 1);
  const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2);

  // gridlines
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
  for (let g = 0; g <= 3; g++) {
    const gy = pad + (g * (H - pad * 2)) / 3;
    ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(W - pad, gy); ctx.stroke();
  }
  // area + line
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(16,185,129,.35)'); grad.addColorStop(1, 'rgba(16,185,129,0)');
  ctx.beginPath();
  logs.forEach((l, i) => i ? ctx.lineTo(x(i), y(l.count)) : ctx.moveTo(x(i), y(l.count)));
  ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2; ctx.stroke();
  ctx.lineTo(x(logs.length - 1), H - pad); ctx.lineTo(x(0), H - pad); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  // points + labels
  ctx.fillStyle = '#f2f2f5'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
  logs.forEach((l, i) => {
    ctx.beginPath(); ctx.arc(x(i), y(l.count), 3, 0, 7); ctx.fillStyle = '#10b981'; ctx.fill();
    if (logs.length <= 12 || i % Math.ceil(logs.length / 12) === 0)
      ctx.fillStyle = '#9a9aa6', ctx.fillText(l.d.slice(5), x(i), H - 8);
  });
  ctx.textAlign = 'left'; ctx.fillStyle = '#9a9aa6';
  ctx.fillText(String(max), 4, pad + 3);
  ctx.fillText(String(min), 4, H - pad + 3);
}

/* ---------- CSV export ---------- */
$('exportBtn').addEventListener('click', () => {
  const b = biz(); if (!b) return;
  const rows = [['business', 'date', 'total_reviews', 'avg_stars']];
  for (const l of b.logs) rows.push([b.name, l.d, l.count, l.stars]);
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'review-velocity.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

/* ---------- weekly reminder ---------- */
$('remindToggle').addEventListener('change', async (e) => {
  state.remind = e.target.checked;
  await save();
  if (state.remind) {
    // Next Monday 09:00 local.
    const now = new Date();
    const next = new Date(now);
    next.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
    next.setHours(9, 0, 0, 0);
    chrome.alarms.create('rvaWeekly', { when: next.getTime(), periodInMinutes: 7 * 24 * 60 });
  } else {
    chrome.alarms.clear('rvaWeekly');
  }
});
