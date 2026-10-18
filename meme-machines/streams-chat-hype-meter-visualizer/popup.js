/* HypeMeter popup — gauge, sparkline, session log, export. */
const $ = id => document.getElementById(id);
const hypeBtn = $('hypeBtn'), sessionBtn = $('sessionBtn'), clearBtn = $('clearBtn'),
      exportBtn = $('exportBtn'), gaugeArc = $('gaugeArc'), gaugeText = $('gaugeText'),
      stEvents = $('stEvents'), stPeak = $('stPeak'), stTime = $('stTime'),
      logList = $('logList'), spark = $('spark');
const sctx = spark.getContext('2d');

const ARC_LEN = 267;          // dasharray length of the gauge arc
const WINDOW_MS = 120000;     // sparkline window: last 2 minutes
const BUCKETS = 48;

function hypeLevel(events, now) {
  let l = 0;
  for (const t of events) {
    const age = (now - t) / 1000;
    if (age >= 0 && age < 300) l += 25 * Math.exp(-age / 20);
  }
  return Math.min(100, Math.round(l));
}

async function getData() {
  return chrome.storage.local.get({ hm_events: [], hm_session: null, hm_peak: 0 });
}

async function logHype() {
  const data = await getData();
  data.hm_events.push(Date.now());
  while (data.hm_events.length > 3000) data.hm_events.shift();
  await chrome.storage.local.set({ hm_events: data.hm_events });
  await refresh(true);
  hypeBtn.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }],
    { duration: 160 }
  );
}

function fmtClock(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function fmtTime(t) {
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ---- gauge ----
function drawGauge(level) {
  gaugeArc.style.strokeDashoffset = ARC_LEN * (1 - level / 100);
  gaugeText.textContent = level;
}

// ---- sparkline: hype level sampled per bucket over the last 2 minutes ----
function drawSpark(events, now) {
  const W = spark.width, H = spark.height;
  sctx.clearRect(0, 0, W, H);
  const vals = [];
  for (let i = 0; i < BUCKETS; i++) {
    const t = now - WINDOW_MS + (WINDOW_MS * (i + 0.5)) / BUCKETS;
    vals.push(hypeLevel(events.filter(e => e <= t), t));
  }
  const max = Math.max(10, ...vals);
  const bw = W / BUCKETS;
  vals.forEach((v, i) => {
    const h = (v / max) * (H - 8);
    const grad = sctx.createLinearGradient(0, H - h, 0, H);
    grad.addColorStop(0, '#ec4899');
    grad.addColorStop(1, 'rgba(236,72,153,.25)');
    sctx.fillStyle = grad;
    const x = i * bw + 1;
    sctx.beginPath();
    sctx.roundRect(x, H - h, bw - 2, h, 2);
    sctx.fill();
  });
}

// ---- log list ----
function drawLog(events, session) {
  logList.innerHTML = '';
  const recent = events.slice(-15).reverse();
  if (!recent.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No hype logged yet — smash that button!';
    logList.appendChild(li);
    return;
  }
  for (const t of recent) {
    const li = document.createElement('li');
    const zap = document.createElement('span');
    zap.className = 'zap';
    zap.textContent = '⚡ hype';
    const time = document.createElement('span');
    time.className = 't';
    time.textContent = fmtTime(t);
    li.append(zap, time);
    logList.appendChild(li);
  }
}

// ---- session ----
function drawSession(session) {
  const live = !!session;
  sessionBtn.textContent = live ? 'Stop session' : 'Start session';
  sessionBtn.classList.toggle('live', live);
}

async function refresh(fromTap = false) {
  const now = Date.now();
  const data = await getData();
  const events = data.hm_events;
  const level = hypeLevel(events, now);
  drawGauge(level);
  drawSpark(events, now);
  drawLog(events, data.hm_session);
  drawSession(data.hm_session);

  // Track all-time peak
  if (level > (data.hm_peak || 0)) {
    await chrome.storage.local.set({ hm_peak: level });
    data.hm_peak = level;
  }
  stEvents.textContent = events.length;
  stPeak.textContent = data.hm_peak || 0;
  stTime.textContent = data.hm_session ? fmtClock(now - data.hm_session.start) : '0:00';
  if (!fromTap) chrome.action.setBadgeText({ text: level > 0 ? String(level) : '' });
}

hypeBtn.addEventListener('click', logHype);

sessionBtn.addEventListener('click', async () => {
  const data = await getData();
  if (data.hm_session) {
    await chrome.storage.local.set({ hm_session: null });
  } else {
    await chrome.storage.local.set({ hm_session: { start: Date.now() } });
  }
  refresh();
});

clearBtn.addEventListener('click', async () => {
  if (!confirm('Clear all logged hype moments?')) return;
  await chrome.storage.local.set({ hm_events: [], hm_peak: 0, hm_session: null });
  chrome.action.setBadgeText({ text: '' });
  refresh();
});

exportBtn.addEventListener('click', async () => {
  const data = await getData();
  const payload = {
    exportedAt: new Date().toISOString(),
    session: data.hm_session,
    peak: data.hm_peak || 0,
    count: data.hm_events.length,
    events: data.hm_events.map(t => new Date(t).toISOString())
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hypemeter-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// Live refresh while open (gauge decay + session clock), paused when hidden.
let timer = null;
function tick() { refresh(); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearInterval(timer); timer = null; }
  else if (!timer) { timer = setInterval(tick, 1000); tick(); }
});
timer = setInterval(tick, 1000);
refresh();
