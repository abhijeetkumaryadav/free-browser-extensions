/* Contrast Timer — popup logic.
 * Mirrors the background countdown locally for a smooth ring;
 * chimes on phase change while the popup is open. */

const CIRC = 326.7; // 2*pi*52

const els = {
  configView: document.getElementById('configView'),
  runView: document.getElementById('runView'),
  coldSec: document.getElementById('coldSec'),
  hotSec: document.getElementById('hotSec'),
  rounds: document.getElementById('rounds'),
  startBtn: document.getElementById('startBtn'),
  phasePill: document.getElementById('phasePill'),
  ringBar: document.getElementById('ringBar'),
  timeLeft: document.getElementById('timeLeft'),
  roundLabel: document.getElementById('roundLabel'),
  skipBtn: document.getElementById('skipBtn'),
  stopBtn: document.getElementById('stopBtn'),
  logList: document.getElementById('logList'),
  clearLog: document.getElementById('clearLog'),
};

let audioCtx = null;
let lastPhaseIdx = -1;
let tickTimer = null;

/** Generated Web Audio chime — three ascending triangle tones, no files. */
function chime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    [440, 554, 659].forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.2);
    });
  } catch (e) { /* audio unavailable — notifications still fire */ }
}

function send(msg) {
  return new Promise((res) => chrome.runtime.sendMessage(msg, res));
}

function fmt(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/** Render one frame of the running view from background state. */
function renderRun(state) {
  const p = state.plan[state.idx];
  if (!p) { showConfig(); return; }
  els.configView.hidden = true;
  els.runView.hidden = false;

  const isCold = p.phase === 'cold';
  els.phasePill.textContent = isCold ? 'COLD' : 'HOT';
  els.phasePill.classList.toggle('hot', !isCold);

  const remaining = (state.phaseEnd - Date.now()) / 1000;
  els.timeLeft.textContent = fmt(remaining);
  els.roundLabel.textContent = `Round ${p.round} / ${state.cfg.rounds}`;
  const frac = Math.max(0, Math.min(1, remaining / p.durationSec));
  els.ringBar.style.strokeDashoffset = String(CIRC * (1 - frac));

  if (state.idx !== lastPhaseIdx) {
    if (lastPhaseIdx !== -1) chime(); // don't chime on first paint
    lastPhaseIdx = state.idx;
  }
}

function showConfig() {
  els.runView.hidden = true;
  els.configView.hidden = false;
  lastPhaseIdx = -1;
  clearInterval(tickTimer);
  tickTimer = null;
}

async function refresh() {
  const r = await send({ type: 'GET' });
  const state = r && r.state;
  if (state && state.plan[state.idx]) {
    if (!tickTimer) {
      tickTimer = setInterval(async () => {
        const rr = await send({ type: 'GET' });
        if (rr && rr.state && rr.state.plan[rr.state.idx]) renderRun(rr.state);
        else showConfig();
      }, 500);
    }
    renderRun(state);
  } else {
    showConfig();
  }
}

async function renderLog() {
  const log = (await chrome.storage.local.get('contrast_log')).contrast_log || [];
  els.logList.innerHTML = '';
  if (!log.length) {
    els.logList.innerHTML = '<li class="empty">No sessions yet.</li>';
    return;
  }
  log.slice(0, 20).forEach((e) => {
    const li = document.createElement('li');
    const d = new Date(e.when);
    li.innerHTML = `<span>${e.rounds} rounds · ${e.coldSec}s cold / ${e.hotSec}s hot</span><span class="t">${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
    els.logList.appendChild(li);
  });
}

els.startBtn.addEventListener('click', async () => {
  const r = await send({
    type: 'START',
    coldSec: Number(els.coldSec.value),
    hotSec: Number(els.hotSec.value),
    rounds: Number(els.rounds.value),
  });
  if (r && r.state) { lastPhaseIdx = -1; refresh(); }
});

els.skipBtn.addEventListener('click', async () => {
  const r = await send({ type: 'SKIP' });
  if (r && r.state) refresh();
  else showConfig();
});

els.stopBtn.addEventListener('click', async () => {
  if (confirm('End this session?')) {
    await send({ type: 'STOP' });
    showConfig();
    renderLog();
  }
});

els.clearLog.addEventListener('click', async () => {
  if (confirm('Clear the session log?')) {
    await chrome.storage.local.remove('contrast_log');
    renderLog();
  }
});

// Restore last config values
(async () => {
  const s = await chrome.storage.local.get('contrast_cfg');
  if (s.contrast_cfg) {
    els.coldSec.value = s.contrast_cfg.coldSec;
    els.hotSec.value = s.contrast_cfg.hotSec;
    els.rounds.value = s.contrast_cfg.rounds;
  }
  ['coldSec', 'hotSec', 'rounds'].forEach((id) => {
    els[id].addEventListener('change', () => {
      chrome.storage.local.set({
        contrast_cfg: {
          coldSec: Number(els.coldSec.value),
          hotSec: Number(els.hotSec.value),
          rounds: Number(els.rounds.value),
        },
      });
    });
  });
  refresh();
  renderLog();
})();
