/* Pomodoro timing engine lives in the background worker (survives popup close).
 * This popup only reads state, sends commands, and plays chimes while open. */

// ENGINE-START
// Pure helper: compute the next phase given state. Testable in isolation.
/**
 * @param {{phase:'idle'|'focus'|'break'|'longbreak', sessions:number, longEvery:number}} s
 * @returns {'focus'|'break'|'longbreak'|'idle'}
 */
function nextPhase(s) {
  if (s.phase === 'idle') return 'focus';
  if (s.phase === 'focus') {
    const done = s.sessions + 1;
    return (done % s.longEvery === 0) ? 'longbreak' : 'break';
  }
  return 'focus';
}

/** Format seconds as m:ss. */
function fmtTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}
// ENGINE-END

// ---------- Web Audio chimes (generated tones, no audio files) ----------
let audioCtx = null;

/** Ensure an AudioContext created from a user gesture. */
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/** Play a short tone of given frequency/duration. */
function tone(freqHz, delaySec, durSec, type) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freqHz;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0); osc.stop(t0 + durSec + 0.05);
}

/** Focus-start chime: two rising tones. Break chime: three gentle tones. */
function playChime(kind) {
  ensureAudio();
  if (kind === 'break') { tone(523.25, 0, 0.35); tone(659.25, 0.22, 0.35); tone(783.99, 0.44, 0.5); }
  else if (kind === 'focus') { tone(440, 0, 0.3); tone(554.37, 0.2, 0.4); }
}

// ---------- State ----------
const els = {
  ring: document.getElementById('ring'),
  time: document.getElementById('time'),
  phaseLabel: document.getElementById('phaseLabel'),
  sessions: document.getElementById('sessions'),
  startBtn: document.getElementById('startBtn'),
  resetBtn: document.getElementById('resetBtn'),
  focusMin: document.getElementById('focusMin'),
  breakMin: document.getElementById('breakMin'),
  longEvery: document.getElementById('longEvery'),
  longMin: document.getElementById('longMin'),
};

/** Ask the background worker for the current timer state. */
async function loadState() {
  const resp = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  render(resp.state);
}

/** Render state into the popup. */
function render(st) {
  els.ring.classList.remove('focus', 'break');
  if (st.phase === 'focus') els.ring.classList.add('focus');
  if (st.phase === 'break' || st.phase === 'longbreak') els.ring.classList.add('break');
  els.time.textContent = fmtTime(st.remainingSec);
  els.phaseLabel.textContent =
    st.phase === 'idle' ? 'Ready' :
    st.phase === 'focus' ? 'Focus' :
    st.phase === 'break' ? 'Break — take a short walk' : 'Long break — stretch your legs';
  els.sessions.textContent = 'Sessions today: ' + st.sessions;
  els.startBtn.textContent = (st.phase === 'idle') ? 'Start focus' : 'Pause';
  if (st.settings) {
    els.focusMin.value = st.settings.focusMin;
    els.breakMin.value = st.settings.breakMin;
    els.longEvery.value = st.settings.longEvery;
    els.longMin.value = st.settings.longMin;
  }
}

/** Collect settings from the inputs. */
function readSettings() {
  return {
    focusMin: Math.min(180, Math.max(1, +els.focusMin.value || 25)),
    breakMin: Math.min(60, Math.max(1, +els.breakMin.value || 5)),
    longEvery: Math.min(12, Math.max(1, +els.longEvery.value || 4)),
    longMin: Math.min(60, Math.max(1, +els.longMin.value || 15)),
  };
}

els.startBtn.addEventListener('click', async () => {
  ensureAudio(); // user gesture: unlock audio for chimes
  const resp = await chrome.runtime.sendMessage({ type: 'TOGGLE', settings: readSettings() });
  render(resp.state);
});

els.resetBtn.addEventListener('click', async () => {
  const resp = await chrome.runtime.sendMessage({ type: 'RESET' });
  render(resp.state);
});

for (const el of [els.focusMin, els.breakMin, els.longEvery, els.longMin]) {
  el.addEventListener('change', () => chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings: readSettings() }));
}

// Refresh countdown every second while open.
setInterval(loadState, 1000);
// Play chimes when the background announces a phase change.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'PHASE_CHANGED') playChime(msg.kind);
});

loadState();
