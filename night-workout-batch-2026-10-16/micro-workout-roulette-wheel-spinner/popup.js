// Workout Roulette — popup: canvas wheel spin + workout history log.
//
// ENGINE-START
// Pure engine — no DOM, no chrome APIs. Unit-testable in node.
const ENGINE = {
  TAU: Math.PI * 2,

  /** Bundled exercise list: name + duration in seconds. */
  EXERCISES: [
    { name: 'Push-ups', secs: 60 },
    { name: 'Squats', secs: 60 },
    { name: 'Plank', secs: 45 },
    { name: 'Jumping jacks', secs: 60 },
    { name: 'Lunges', secs: 60 },
    { name: 'High knees', secs: 45 },
    { name: 'Sit-ups', secs: 60 },
    { name: 'Wall sit', secs: 45 },
    { name: 'Burpees', secs: 30 },
    { name: 'Calf raises', secs: 60 },
    { name: 'Mountain climbers', secs: 45 },
    { name: 'Arm circles', secs: 30 },
  ],

  /** Angle (radians) of one wheel segment. */
  segmentAngle(len) {
    return ENGINE.TAU / len;
  },

  /** Map a 0..1 random value to a segment index (clamped). */
  pickIndex(len, rand01) {
    const r = Math.min(0.999999999, Math.max(0, rand01));
    return Math.floor(r * len);
  },

  /**
   * Which segment sits under the top pointer given the wheel's rotation.
   * Segments are drawn starting at `rotation` (segment i spans
   * rotation + i*seg .. rotation + (i+1)*seg); the pointer is at -PI/2.
   */
  indexFromRotation(rotation, len) {
    const seg = ENGINE.segmentAngle(len);
    const rel = ((((-Math.PI / 2 - rotation) % ENGINE.TAU) + ENGINE.TAU) % ENGINE.TAU);
    return Math.min(len - 1, Math.floor(rel / seg));
  },

  /**
   * Final rotation that lands targetIndex under the pointer after
   * `spins` full turns. Segment center is used for a stable landing.
   */
  spinTarget(rotation, targetIndex, len, spins) {
    const seg = ENGINE.segmentAngle(len);
    const desiredMod = -Math.PI / 2 - (targetIndex + 0.5) * seg;
    const curMod = ((rotation % ENGINE.TAU) + ENGINE.TAU) % ENGINE.TAU;
    const wantMod = ((desiredMod % ENGINE.TAU) + ENGINE.TAU) % ENGINE.TAU;
    const delta = ((wantMod - curMod + ENGINE.TAU) % ENGINE.TAU);
    return rotation + spins * ENGINE.TAU + delta;
  },

  /** Format seconds as "1m 05s" / "45s". */
  fmtSecs(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
  },
};
// ENGINE-END
'use strict';

/* ---------- state ---------- */

let rotation = 0;
let spinning = false;
let lastResult = null;
const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const SEG_COLORS = ['rgba(163,230,53,0.20)', 'rgba(255,255,255,0.05)'];

/* ---------- wheel rendering ---------- */

function drawWheel() {
  const n = ENGINE.EXERCISES.length;
  const seg = ENGINE.segmentAngle(n);
  const R = 148, cx = 150, cy = 150;
  ctx.clearRect(0, 0, 300, 300);

  for (let i = 0; i < n; i += 1) {
    const a0 = rotation + i * seg;
    const a1 = a0 + seg;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, a0, a1);
    ctx.closePath();
    ctx.fillStyle = SEG_COLORS[i % 2];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label: radial text near the rim.
    const mid = (a0 + a1) / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(mid);
    ctx.textAlign = 'right';
    ctx.fillStyle = i % 2 === 0 ? '#a3e635' : '#e4e4e7';
    ctx.font = '600 11px system-ui, sans-serif';
    const label = ENGINE.EXERCISES[i].name;
    ctx.fillText(label.length > 16 ? label.slice(0, 15) + '…' : label, R - 8, 4);
    ctx.restore();
  }

  // Hub.
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, ENGINE.TAU);
  ctx.fillStyle = '#a3e635';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, ENGINE.TAU);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

/* ---------- spin ---------- */

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function spin() {
  if (spinning) return;
  spinning = true;
  document.getElementById('spinBtn').disabled = true;
  document.getElementById('resultBox').classList.add('hidden');

  const n = ENGINE.EXERCISES.length;
  const targetIndex = ENGINE.pickIndex(n, Math.random());
  const from = rotation;
  const to = ENGINE.spinTarget(rotation, targetIndex, n, 5 + Math.floor(Math.random() * 3));
  const duration = 3200;
  const start = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    rotation = from + (to - from) * easeOutCubic(t);
    drawWheel();
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      spinning = false;
      rotation = to % ENGINE.TAU; // keep numbers small
      document.getElementById('spinBtn').disabled = false;
      lastResult = ENGINE.EXERCISES[targetIndex];
      showResult(lastResult);
    }
  }
  requestAnimationFrame(frame);
}

function showResult(ex) {
  document.getElementById('resultExercise').textContent = ex.name;
  document.getElementById('resultDuration').textContent =
    `Do it for ${ENGINE.fmtSecs(ex.secs)} — for fun, not coaching.`;
  document.getElementById('resultBox').classList.remove('hidden');
}

/* ---------- history log ---------- */

async function getLog() {
  const { workoutLog } = await chrome.storage.local.get({ workoutLog: [] });
  return Array.isArray(workoutLog) ? workoutLog : [];
}

async function setLog(log) {
  await chrome.storage.local.set({ workoutLog: log });
}

function fmtWhen(ts) {
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function renderLog() {
  const log = await getLog();
  const list = document.getElementById('logList');
  list.innerHTML = '';
  document.getElementById('emptyNote').classList.toggle('hidden', log.length > 0);
  [...log].reverse().forEach((entry) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.innerHTML = `<strong>${escapeHtml(entry.name)}</strong> · ${ENGINE.fmtSecs(entry.secs)}<br><span class="when">${escapeHtml(fmtWhen(entry.ts))}</span>`;
    const del = document.createElement('button');
    del.textContent = '×';
    del.title = 'Delete';
    del.addEventListener('click', async () => {
      await setLog((await getLog()).filter((e) => e.ts !== entry.ts || e.name !== entry.name));
      renderLog();
    });
    li.append(label, del);
    list.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function logResult() {
  if (!lastResult) return;
  const log = await getLog();
  log.push({ ts: Date.now(), name: lastResult.name, secs: lastResult.secs });
  await setLog(log);
  lastResult = null;
  document.getElementById('resultBox').classList.add('hidden');
  renderLog();
}

async function clearLog() {
  if (!confirm('Delete all logged workouts?')) return;
  await setLog([]);
  renderLog();
}

/* ---------- init ---------- */

document.getElementById('spinBtn').addEventListener('click', spin);
document.getElementById('logBtn').addEventListener('click', logResult);
document.getElementById('clearBtn').addEventListener('click', clearLog);

drawWheel();
renderLog();
