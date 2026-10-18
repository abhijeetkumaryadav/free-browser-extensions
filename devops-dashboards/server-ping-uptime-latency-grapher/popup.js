/* PingPlot popup logic: config form, stats, canvas latency graph, event log. */
'use strict';

const $ = (id) => document.getElementById(id);
const GRAPH_POINTS = 60;

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + fmtTime(ts);
}

/** Draw the latency line graph (device-pixel aware). */
function drawGraph(samples) {
  const canvas = $('graph');
  const dpr = window.devicePixelRatio || 1;
  const W = 680, H = 220;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const pts = samples.slice(-GRAPH_POINTS);
  $('graphCount').textContent = pts.length;
  const pad = { l: 38, r: 10, t: 12, b: 20 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

  const lats = pts.map(s => s.latencyMs).filter(v => v !== null);
  const maxV = Math.max(500, ...lats) * 1.15;

  // Grid + y labels
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.fillStyle = '#9aa0b4';
  ctx.font = '10px sans-serif';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (ih * i) / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    const v = Math.round(maxV * (1 - i / 4));
    ctx.fillText(v + 'ms', 4, y + 3);
  }

  if (!pts.length) {
    ctx.fillStyle = '#9aa0b4'; ctx.font = '12px sans-serif';
    ctx.fillText('No data yet — start monitoring', pad.l + 40, H / 2);
    return;
  }

  const x = (i) => pad.l + (iw * i) / Math.max(1, pts.length - 1);
  const y = (v) => pad.t + ih * (1 - Math.min(v, maxV) / maxV);

  // Area fill
  const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
  grad.addColorStop(0, 'rgba(34,197,94,.35)');
  grad.addColorStop(1, 'rgba(34,197,94,0)');
  ctx.beginPath();
  let started = false;
  pts.forEach((s, i) => {
    if (s.latencyMs === null) { started = false; return; } // gap on failure
    if (!started) { ctx.moveTo(x(i), y(s.latencyMs)); started = true; }
    else ctx.lineTo(x(i), y(s.latencyMs));
  });
  // close down to baseline for the filled region (per contiguous run)
  ctx.save();
  ctx.beginPath();
  started = false;
  let runStart = 0;
  pts.forEach((s, i) => {
    if (s.latencyMs === null) {
      if (started) { ctx.lineTo(x(i - 1), H - pad.b); ctx.lineTo(x(runStart), H - pad.b); ctx.closePath(); started = false; }
      return;
    }
    if (!started) { runStart = i; ctx.moveTo(x(i), H - pad.b); ctx.lineTo(x(i), y(s.latencyMs)); started = true; }
    else ctx.lineTo(x(i), y(s.latencyMs));
  });
  if (started) { ctx.lineTo(x(pts.length - 1), H - pad.b); ctx.lineTo(x(runStart), H - pad.b); ctx.closePath(); }
  ctx.fillStyle = grad; ctx.fill();
  ctx.restore();

  // Line + failure markers
  ctx.lineWidth = 2; ctx.strokeStyle = '#22c55e';
  started = false;
  ctx.beginPath();
  pts.forEach((s, i) => {
    if (s.latencyMs === null) { started = false; return; }
    if (!started) { ctx.moveTo(x(i), y(s.latencyMs)); started = true; }
    else ctx.lineTo(x(i), y(s.latencyMs));
  });
  ctx.stroke();
  pts.forEach((s, i) => {
    if (s.latencyMs === null) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(x(i), H - pad.b - 4, 3, 0, Math.PI * 2); ctx.fill();
    }
  });

  // X labels (first / mid / last time)
  ctx.fillStyle = '#9aa0b4';
  const label = (i, align) => { ctx.textAlign = align; ctx.fillText(fmtTime(pts[i].at), x(i), H - 6); };
  label(0, 'left');
  if (pts.length > 2) label(Math.floor(pts.length / 2), 'center');
  label(pts.length - 1, 'right');
  ctx.textAlign = 'left';
}

/** Render stats + log from config. */
function render(cfg) {
  const monitoring = !!(cfg && cfg.monitoring);
  $('startBtn').disabled = monitoring;
  $('stopBtn').disabled = !monitoring;
  $('urlInput').disabled = monitoring;
  $('intervalSelect').disabled = monitoring;

  const pill = $('statusPill');
  pill.className = 'status-pill';
  if (monitoring) {
    const samples = cfg.samples || [];
    const last = samples[samples.length - 1];
    if (last) {
      $('statusText').textContent = last.ok ? 'UP' : 'DOWN';
      pill.classList.add(last.ok ? 'up' : 'down');
    } else { $('statusText').textContent = 'Starting…'; pill.classList.add('checking'); }
  } else { $('statusText').textContent = 'Idle'; }

  const show = monitoring;
  $('statsCard').hidden = !show;
  $('logCard').hidden = !show;
  if (!show) return;

  const samples = cfg.samples || [];
  const last = samples[samples.length - 1];
  const st = $('statStatus');
  if (last) {
    st.textContent = last.ok ? `UP · ${last.status}` : 'DOWN';
    st.className = 'stat-value ' + (last.ok ? 'up' : 'down');
    $('statLatency').textContent = last.latencyMs !== null ? last.latencyMs + ' ms' : '—';
  } else { st.textContent = '—'; $('statLatency').textContent = '—'; }

  // Uptime over last 24h (or all samples if fewer)
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const recent = samples.filter(s => s.at >= dayAgo);
  const ups = recent.filter(s => s.ok).length;
  $('statUptime').textContent = recent.length ? ((ups / recent.length) * 100).toFixed(1) + '%' : '—';
  $('statChecks').textContent = samples.length;

  drawGraph(samples);

  // Log: only state-change events + failures, newest first, cap 40 rows
  const list = $('logList');
  list.innerHTML = '';
  const events = [];
  let prevOk;
  for (const s of samples) {
    if (prevOk === undefined || s.ok !== prevOk || !s.ok) {
      events.push(s);
    }
    prevOk = s.ok;
  }
  const rows = events.slice(-40).reverse();
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'empty'; li.textContent = 'No events yet.';
    list.appendChild(li);
  }
  for (const s of rows) {
    const li = document.createElement('li');
    const badge = document.createElement('span');
    badge.className = 'badge ' + (s.ok ? 'up' : 'down');
    badge.textContent = s.ok ? 'UP' : 'DOWN';
    const txt = document.createElement('span');
    txt.textContent = s.ok ? `HTTP ${s.status} · ${s.latencyMs} ms` : (s.status ? `HTTP ${s.status}` : 'Unreachable');
    const t = document.createElement('time');
    t.textContent = fmtDateTime(s.at);
    li.append(badge, txt, t);
    list.appendChild(li);
  }
}

async function refresh() {
  const { cfg } = await chrome.runtime.sendMessage({ type: 'get-state' });
  if (cfg) {
    $('urlInput').value = cfg.url || '';
    $('intervalSelect').value = String(cfg.intervalMin || 5);
    $('notifyCheck').checked = cfg.notify !== false;
  }
  render(cfg);
}

function validUrl(v) {
  try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch { return false; }
}

$('startBtn').addEventListener('click', async () => {
  const url = $('urlInput').value.trim();
  if (!validUrl(url)) { $('urlInput').focus(); $('urlInput').style.borderColor = '#ef4444'; return; }
  $('urlInput').style.borderColor = '';
  $('statusText').textContent = 'Starting…';
  $('statusPill').className = 'status-pill checking';
  await chrome.runtime.sendMessage({
    type: 'start', url,
    intervalMin: parseInt($('intervalSelect').value, 10),
    notify: $('notifyCheck').checked
  });
  refresh();
});

$('stopBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'stop' });
  refresh();
});

$('checkNowBtn').addEventListener('click', async () => {
  $('statusText').textContent = 'Checking…';
  $('statusPill').className = 'status-pill checking';
  await chrome.runtime.sendMessage({ type: 'check-now' });
  refresh();
});

$('clearBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'clear-log' });
  refresh();
});

// Live refresh while popup is open.
setInterval(refresh, 5000);
document.addEventListener('DOMContentLoaded', refresh);
refresh();
