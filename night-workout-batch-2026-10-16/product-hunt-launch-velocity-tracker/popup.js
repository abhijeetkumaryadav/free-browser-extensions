/* Launch Velocity Tracker — manual launch-day logbook.
 * No network, no Product Hunt API. Every datapoint is entered by the user;
 * velocity is computed purely from logged snapshots. */
'use strict';

const STORE_KEY = 'ph_snapshots';

const $ = id => document.getElementById(id);

/* ---------- persistence ---------- */
async function load() {
  const { [STORE_KEY]: snaps } = await chrome.storage.local.get(STORE_KEY);
  return Array.isArray(snaps) ? snaps : [];
}
async function save(snaps) {
  await chrome.storage.local.set({ [STORE_KEY]: snaps });
}

/* ---------- helpers ---------- */
function fmtTime(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// Per-hour velocity between consecutive snapshots: (du / dt) upvotes per hour.
function withVelocity(sorted) {
  return sorted.map((s, i) => {
    let vel = null;
    if (i > 0) {
      const dtH = (s.when - sorted[i - 1].when) / 36e5;
      if (dtH > 0) vel = (s.up - sorted[i - 1].up) / dtH;
    }
    return { ...s, vel };
  });
}

/* ---------- chart ---------- */
function drawChart(items) {
  const cv = $('chart'), ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  if (items.length < 1) {
    ctx.fillStyle = '#9aa0ae'; ctx.font = '11px sans-serif';
    ctx.fillText('Log snapshots to see your trajectory', 80, H / 2);
    return;
  }
  const padL = 34, padR = 8, padT = 10, padB = 20;
  const iw = W - padL - padR, ih = H - padT - padB;
  const t0 = items[0].when, t1 = Math.max(items[items.length - 1].when, t0 + 36e5);
  const maxUp = Math.max(...items.map(s => s.up), 10);
  const maxCm = Math.max(...items.map(s => s.cm), 10);
  const x = t => padL + ((t - t0) / (t1 - t0)) * iw;

  // gridlines + y labels
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.fillStyle = '#9aa0ae';
  ctx.font = '9px sans-serif'; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const yy = padT + ih - (g / 4) * ih;
    ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke();
    ctx.fillText(Math.round(maxUp * g / 4), 4, yy + 3);
  }

  const line = (vals, max, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    vals.forEach((s, i) => {
      const px = x(s.when), py = padT + ih - (vals[i] / max) * ih;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    ctx.stroke();
  };
  line(items.map(s => s.up), maxUp, '#ff7849');
  line(items.map(s => s.cm), maxCm, '#38bdf8');

  // endpoints dots
  items.forEach(s => {
    ctx.fillStyle = '#ff7849';
    ctx.beginPath(); ctx.arc(x(s.when), padT + ih - (s.up / maxUp) * ih, 3, 0, 7); ctx.fill();
  });

  // x labels (first / last)
  ctx.fillStyle = '#9aa0ae';
  ctx.fillText(fmtTime(t0), padL, H - 6);
  const last = fmtTime(t1); ctx.fillText(last, W - padR - ctx.measureText(last).width, H - 6);
}

/* ---------- render ---------- */
function render(snaps) {
  const sorted = [...snaps].sort((a, b) => a.when - b.when);
  const items = withVelocity(sorted);

  // stats
  const latest = sorted[sorted.length - 1];
  $('statTotal').textContent = latest ? latest.up : 0;
  const vels = items.map(s => s.vel).filter(v => v !== null && isFinite(v));
  const latestVel = latest ? items[items.length - 1].vel : null;
  $('statVel').textContent = (latestVel !== null && latestVel !== undefined && isFinite(latestVel))
    ? latestVel.toFixed(1) : '—';
  $('statPeak').textContent = vels.length ? Math.max(...vels).toFixed(1) : '—';
  $('statRank').textContent = latest && latest.rank != null ? '#' + latest.rank : '—';

  drawChart(sorted);

  // history
  const ul = $('history'); ul.innerHTML = '';
  $('emptyMsg').style.display = sorted.length ? 'none' : 'block';
  [...sorted].reverse().forEach(s => {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.innerHTML = `<span class="hist-val">${s.up}</span> up · ${s.cm} cm` +
      (s.rank != null ? ` · #${s.rank}` : '') +
      `<div class="hist-meta">${fmtTime(s.when)}</div>`;
    li.appendChild(left);
    const right = document.createElement('div');
    const wv = items.find(i => i.when === s.when && i.up === s.up);
    if (wv && wv.vel !== null && isFinite(wv.vel))
      right.innerHTML = `<span class="vel-badge">${wv.vel >= 0 ? '+' : ''}${wv.vel.toFixed(1)}/h</span> `;
    const del = document.createElement('button');
    del.className = 'hist-del'; del.title = 'Delete snapshot';
    del.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>';
    del.addEventListener('click', async () => {
      const all = await load();
      await save(all.filter(e => !(e.when === s.when && e.up === s.up && e.cm === s.cm)));
      render(await load());
    });
    right.appendChild(del); li.appendChild(right);
    ul.appendChild(li);
  });
}

/* ---------- events ---------- */
$('addBtn').addEventListener('click', async () => {
  const up = Math.max(0, parseInt($('upvotes').value || '0', 10));
  const cm = Math.max(0, parseInt($('comments').value || '0', 10));
  const rankRaw = $('rank').value;
  const rank = rankRaw === '' ? null : Math.max(0, parseInt(rankRaw, 10));
  const whenRaw = $('when').value;
  const when = whenRaw ? new Date(whenRaw).getTime() : Date.now();
  const snaps = await load();
  snaps.push({ when, up, cm, rank });
  await save(snaps);
  $('upvotes').value = ''; $('comments').value = ''; $('rank').value = '';
  render(await load());
});

$('clearBtn').addEventListener('click', async () => {
  if (confirm('Delete all logged snapshots?')) { await save([]); render([]); }
});

/* ---------- init ---------- */
(function init() {
  // default "when" to right now (local)
  const n = new Date(); n.setMinutes(n.getMinutes() - n.getTimezoneOffset());
  $('when').value = n.toISOString().slice(0, 16);
  load().then(render);
})();
