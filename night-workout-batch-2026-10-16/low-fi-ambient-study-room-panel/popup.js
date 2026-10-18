// Lo-Fi Study Room — popup UI.
// Canvas scene animation, timer controls (state owned by background.js),
// and locally-synthesized ambient sound via WebAudio (no audio files).

'use strict';

/* ---------- state <-> background ---------- */
async function bg(msg) {
  return chrome.runtime.sendMessage(msg);
}

/* ---------- timer UI ---------- */
const timerDisplay = document.getElementById('timerDisplay');
const timerState = document.getElementById('timerState');
const startPauseBtn = document.getElementById('startPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const modeChips = [...document.querySelectorAll('.mode-row .chip')];

function fmt(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' +
         String(total % 60).padStart(2, '0');
}

let current = null;

function render(s) {
  current = s;
  const remaining = s.running ? Math.max(0, s.endTime - Date.now()) : s.remainingMs;
  timerDisplay.textContent = fmt(remaining);
  timerState.textContent = s.running
    ? (s.mode === 'focus' ? 'focusing…' : 'on a break…')
    : (remaining < s.modeMins * 60 * 1000 ? 'paused' : 'ready to focus');
  startPauseBtn.textContent = s.running ? 'Pause' : (remaining < s.modeMins * 60 * 1000 ? 'Resume' : 'Start');
  modeChips.forEach(c => c.classList.toggle('active', c.dataset.mode === s.mode));
  document.getElementById('statFocus').textContent = s.stats.focus;
  document.getElementById('statBreaks').textContent = s.stats.breaks;
  document.getElementById('statMinutes').textContent = s.stats.minutes;
}

async function refresh() { render(await bg({ type: 'getState' })); }

startPauseBtn.addEventListener('click', async () => {
  if (!current) return;
  if (current.running) render(await bg({ type: 'pause' }));
  else if (current.remainingMs < current.modeMins * 60 * 1000) render(await bg({ type: 'resume' }));
  else render(await bg({ type: 'start', mode: current.mode, mins: current.modeMins }));
});
resetBtn.addEventListener('click', async () => render(await bg({ type: 'reset' })));
modeChips.forEach(c => c.addEventListener('click', async () =>
  render(await bg({ type: 'setMode', mode: c.dataset.mode, mins: Number(c.dataset.mins) }))));

setInterval(refresh, 500);
refresh();

/* ---------- ambient sound (WebAudio, synthesized locally) ---------- */
let actx = null, master = null, rainNodes = null, brownNodes = null;

function ensureCtx() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  master = actx.createGain();
  master.gain.value = Number(document.getElementById('volSlider').value) / 100 * 0.5;
  master.connect(actx.destination);
}

function whiteBuffer() {
  const len = actx.sampleRate * 2;
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function brownBuffer() {
  const len = actx.sampleRate * 2;
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

function startRain() {
  ensureCtx();
  const src = actx.createBufferSource();
  src.buffer = whiteBuffer(); src.loop = true;
  const bp = actx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 0.6;
  const g = actx.createGain(); g.gain.value = 0.35;
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start();
  rainNodes = { src, g };
}

function startBrown() {
  ensureCtx();
  const src = actx.createBufferSource();
  src.buffer = brownBuffer(); src.loop = true;
  const lp = actx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 500;
  const g = actx.createGain(); g.gain.value = 0.9;
  src.connect(lp); lp.connect(g); g.connect(master);
  src.start();
  brownNodes = { src, g };
}

function stopNodes(n) {
  if (!n) return;
  try { n.src.stop(); } catch (e) { /* already stopped */ }
  n.g.disconnect();
}

const rainToggle = document.getElementById('rainToggle');
const noiseToggle = document.getElementById('noiseToggle');
rainToggle.addEventListener('click', () => {
  const on = rainToggle.classList.toggle('on');
  if (on) startRain(); else stopNodes(rainNodes);
});
noiseToggle.addEventListener('click', () => {
  const on = noiseToggle.classList.toggle('on');
  if (on) startBrown(); else stopNodes(brownNodes);
});
document.getElementById('volSlider').addEventListener('input', (e) => {
  if (master) master.gain.value = Number(e.target.value) / 100 * 0.5;
});

/* ---------- cozy canvas scene ---------- */
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// Rain streaks inside the window pane.
const drops = Array.from({ length: 46 }, () => ({
  x: 60 + Math.random() * 120, y: Math.random() * 76,
  v: 1.6 + Math.random() * 2.2, len: 6 + Math.random() * 8
}));
let t = 0;

function drawScene() {
  t += 0.016;
  // wall
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#1a1626'); wall.addColorStop(1, '#12101c');
  ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);

  // window frame
  ctx.fillStyle = '#2a2438';
  ctx.fillRect(48, 12, 144, 96);
  // night sky in pane
  const sky = ctx.createLinearGradient(0, 16, 0, 104);
  sky.addColorStop(0, '#0b1026'); sky.addColorStop(1, '#1b2a4a');
  ctx.fillStyle = sky; ctx.fillRect(56, 20, 128, 80);
  // moon
  ctx.fillStyle = '#e8e4d2';
  ctx.beginPath(); ctx.arc(158, 38, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(232,228,210,.25)';
  ctx.beginPath(); ctx.arc(158, 38, 12, 0, Math.PI * 2); ctx.fill();
  // rain
  ctx.strokeStyle = 'rgba(174,194,224,.5)'; ctx.lineWidth = 1;
  for (const d of drops) {
    ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 2, d.y + d.len); ctx.stroke();
    d.y += d.v; d.x -= 0.35;
    if (d.y > 100) { d.y = 20; d.x = 60 + Math.random() * 120; }
  }
  // window cross bars
  ctx.fillStyle = '#2a2438';
  ctx.fillRect(118, 20, 4, 80); ctx.fillRect(56, 58, 128, 4);

  // desk
  ctx.fillStyle = '#241d33'; ctx.fillRect(0, 118, W, 52);

  // lamp: stand + warm glow
  ctx.strokeStyle = '#3a3350'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(292, 118); ctx.lineTo(292, 52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(292, 52); ctx.lineTo(318, 66); ctx.stroke();
  const glow = ctx.createRadialGradient(322, 84, 4, 322, 84, 56);
  glow.addColorStop(0, 'rgba(245,190,110,.5)');
  glow.addColorStop(1, 'rgba(245,190,110,0)');
  ctx.fillStyle = glow; ctx.fillRect(250, 20, 98, 120);
  ctx.fillStyle = '#f5be6e';
  ctx.beginPath(); ctx.arc(322, 78, 7, 0, Math.PI * 2); ctx.fill();

  // sleeping cat (breathes gently)
  const breathe = 1 + Math.sin(t * 2.2) * 0.035;
  ctx.save();
  ctx.translate(96, 118); ctx.scale(breathe, 1);
  ctx.fillStyle = '#17131f';
  ctx.beginPath(); ctx.ellipse(0, -14, 34, 15, 0, 0, Math.PI * 2); ctx.fill(); // body
  ctx.beginPath(); ctx.arc(30, -22, 12, 0, Math.PI * 2); ctx.fill();           // head
  ctx.beginPath();                                                            // ears
  ctx.moveTo(22, -30); ctx.lineTo(26, -40); ctx.lineTo(31, -31); ctx.closePath();
  ctx.moveTo(33, -32); ctx.lineTo(38, -40); ctx.lineTo(41, -30); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#17131f'; ctx.lineWidth = 5; ctx.lineCap = 'round';       // tail
  ctx.beginPath(); ctx.quadraticCurveTo(-38, -18, -30, -34 + Math.sin(t * 2.2) * 3); ctx.stroke();
  ctx.restore();
  // "Zzz"
  ctx.fillStyle = 'rgba(244,241,234,.6)';
  ctx.font = '11px sans-serif';
  const zFloat = (t * 14) % 24;
  ctx.fillText('z', 128, 74 - zFloat);
  ctx.fillText('Z', 134, 66 - zFloat * 0.7);
  ctx.fillText('z', 140, 58 - zFloat * 0.5);

  requestAnimationFrame(drawScene);
}
drawScene();
