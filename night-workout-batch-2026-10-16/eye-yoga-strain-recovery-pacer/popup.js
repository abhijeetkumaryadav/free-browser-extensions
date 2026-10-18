/* Eye Yoga Pacer — popup logic.
 * Canvas animation: dot follows figure-8, up-down, left-right paths;
 * palming mode shows a countdown overlay. Timed phases, session log.
 * All local. No network. */
'use strict';

const $ = id => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

/* ---------- path engines (ENGINE-START) ---------- */
function fig8(t) {
  // t in [0, 2π): lemniscate of Gerono scaled to stage
  const x = W / 2 + (W * 0.38) * Math.sin(t);
  const y = H / 2 + (H * 0.34) * Math.sin(t) * Math.cos(t);
  return [x, y];
}
function upDown(t) {
  const x = W / 2;
  const y = H / 2 + (H * 0.38) * Math.sin(t);
  return [x, y];
}
function leftRight(t) {
  const x = W / 2 + (W * 0.40) * Math.sin(t);
  const y = H / 2;
  return [x, y];
}
/* (ENGINE-END) */

const PHASES = {
  fig8:      { fn: fig8,      hint: 'Follow the dot with your eyes — keep your head still.' },
  updown:    { fn: upDown,    hint: 'Slowly trace up and down with your eyes only.' },
  leftright: { fn: leftRight, hint: 'Slowly trace left and right with your eyes only.' },
  palming:   { fn: null,      hint: 'Cover your eyes with warm palms, breathe slowly, and relax in the dark.' }
};

let phase = 'fig8';
let running = false;
let raf = 0;
let t0 = 0;
let remaining = 0;
let tickTimer = 0;
let speed = 3;
let duration = 60;
let phaseStart = null;

function fmtTime(ts) {
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function drawDot(x, y) {
  ctx.clearRect(0, 0, W, H);
  // faint guide path
  ctx.strokeStyle = 'rgba(52,211,153,.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const eng = PHASES[phase].fn;
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
    const [px, py] = eng(a);
    a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
  // dot
  const g = ctx.createRadialGradient(x, y, 0, x, y, 14);
  g.addColorStop(0, '#34d399');
  g.addColorStop(1, 'rgba(52,211,153,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#04140d';
  ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
}

function drawPalming() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(52,211,153,.9)';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(formatClock(remaining), W / 2, H / 2 - 10);
  ctx.fillStyle = '#9aa0b4';
  ctx.font = '12px sans-serif';
  ctx.fillText('palming — breathe slowly', W / 2, H / 2 + 26);
}

function formatClock(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function frame(now) {
  if (!running) return;
  const eng = PHASES[phase].fn;
  if (eng) {
    const t = ((now - t0) / 1000) * (0.35 * speed);
    const [x, y] = eng(t);
    drawDot(x, y);
  } else {
    drawPalming();
  }
  raf = requestAnimationFrame(frame);
}

function stopSession(finished) {
  running = false;
  cancelAnimationFrame(raf);
  clearInterval(tickTimer);
  $('startBtn').disabled = false;
  $('stopBtn').disabled = true;
  if (finished && phaseStart) logSession();
  phaseStart = null;
  drawIdle();
}

async function logSession() {
  const log = (await chrome.storage.local.get({ doneLog: [] })).doneLog;
  log.unshift({ ts: Date.now(), phase, secs: duration });
  await chrome.storage.local.set({ doneLog: log.slice(0, 50) });
  renderLog();
}

function startSession() {
  running = true;
  t0 = performance.now();
  phaseStart = Date.now();
  remaining = duration;
  $('timer').textContent = formatClock(remaining);
  $('startBtn').disabled = true;
  $('stopBtn').disabled = false;
  tickTimer = setInterval(() => {
    remaining -= 1;
    $('timer').textContent = formatClock(Math.max(0, remaining));
    if (remaining <= 0) stopSession(true);
  }, 1000);
  raf = requestAnimationFrame(frame);
}

function drawIdle() {
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(52,211,153,.18)';
  ctx.lineWidth = 1;
  const eng = PHASES[phase] && PHASES[phase].fn;
  if (eng) {
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
      const [px, py] = eng(a);
      a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    const [x, y] = eng(0);
    ctx.fillStyle = '#34d399';
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = '#9aa0b4';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Press Start — cover eyes with palms', W / 2, H / 2);
  }
}

async function renderLog() {
  const log = (await chrome.storage.local.get({ doneLog: [] })).doneLog;
  const box = $('log');
  if (!log.length) {
    box.innerHTML = '<span class="empty">No sessions yet.</span>';
    return;
  }
  box.innerHTML = '';
  const names = { fig8: 'Figure-8', updown: 'Up–Down', leftright: 'Left–Right', palming: 'Palming' };
  log.slice(0, 10).forEach(e => {
    const row = document.createElement('div');
    row.className = 'log-item';
    const a = document.createElement('span');
    a.textContent = names[e.phase] || e.phase;
    const b = document.createElement('span');
    b.textContent = `${e.secs}s · ${fmtTime(e.ts)}`;
    b.style.color = '#9aa0b4';
    row.append(a, b);
    box.appendChild(row);
  });
}

async function init() {
  const s = await chrome.storage.local.get({ phaseDuration: 60, dotSpeed: 3 });
  duration = s.phaseDuration; speed = s.dotSpeed;
  $('duration').value = duration;
  $('durationLabel').textContent = `${duration}s`;
  $('timer').textContent = formatClock(duration);
  $('speed').value = speed;
  $('speedLabel').textContent = String(speed);

  $('phaseRow').querySelectorAll('.phase').forEach(btn => {
    btn.addEventListener('click', () => {
      if (running) stopSession(false);
      phase = btn.dataset.phase;
      $('phaseRow').querySelectorAll('.phase').forEach(b => b.classList.toggle('active', b === btn));
      $('phaseHint').textContent = PHASES[phase].hint;
      drawIdle();
    });
  });

  $('duration').addEventListener('input', e => {
    duration = Number(e.target.value);
    $('durationLabel').textContent = `${duration}s`;
    if (!running) $('timer').textContent = formatClock(duration);
    chrome.storage.local.set({ phaseDuration: duration });
  });
  $('speed').addEventListener('input', e => {
    speed = Number(e.target.value);
    $('speedLabel').textContent = String(speed);
    chrome.storage.local.set({ dotSpeed: speed });
  });

  $('startBtn').addEventListener('click', startSession);
  $('stopBtn').addEventListener('click', () => stopSession(false));
  $('clearLog').addEventListener('click', async () => {
    await chrome.storage.local.set({ doneLog: [] });
    renderLog();
  });

  drawIdle();
  renderLog();
}

document.addEventListener('DOMContentLoaded', init);
