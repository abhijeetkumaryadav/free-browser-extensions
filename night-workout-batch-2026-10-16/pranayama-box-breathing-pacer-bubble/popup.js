// Box Breathing Pacer — popup logic.
// Animates a bubble through inhale/hold/exhale/hold phases with per-second
// countdowns, an optional gentle chime, and a session timer.
// Fully local, zero network. Pacing aid only — not medical advice.

// ---------------------------------------------------------------------------
// ENGINE-START: pure phase-plan builder (testable in node)
// ---------------------------------------------------------------------------
function buildPhasePlan({ inhale, hold1, exhale, hold2 }) {
  const phases = [];
  if (inhale > 0) phases.push({ name: "Inhale", secs: inhale, cls: "inhale" });
  if (hold1 > 0) phases.push({ name: "Hold", secs: hold1, cls: "hold" });
  if (exhale > 0) phases.push({ name: "Exhale", secs: exhale, cls: "exhale" });
  if (hold2 > 0) phases.push({ name: "Hold", secs: hold2, cls: "hold" });
  return phases;
}
// ENGINE-END

// ---------------------------------------------------------------------------
// DOM + audio
// ---------------------------------------------------------------------------
const bubble = document.getElementById("bubble");
const phaseLabel = document.getElementById("phaseLabel");
const countLabel = document.getElementById("countLabel");
const timerEl = document.getElementById("timer");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const inputs = {
  inhale: document.getElementById("inhale"),
  hold1: document.getElementById("hold1"),
  exhale: document.getElementById("exhale"),
  hold2: document.getElementById("hold2"),
  minutes: document.getElementById("minutes"),
  chime: document.getElementById("chime")
};

let audioCtx = null;   // created lazily on user gesture
let phaseTimer = null; // per-second ticker for the current phase
let sessionTimer = null;
let running = false;
let sessionEnd = 0;

// Gentle sine chime; no audio files needed.
function chime(freq = 528) {
  if (!inputs.chime.checked) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.85);
}

function clampInt(el, min, max) {
  const v = Math.max(min, Math.min(max, Number(el.value) || min));
  el.value = v;
  return v;
}

function readSettings() {
  return {
    inhale: clampInt(inputs.inhale, 2, 12),
    hold1: clampInt(inputs.hold1, 0, 12),
    exhale: clampInt(inputs.exhale, 2, 12),
    hold2: clampInt(inputs.hold2, 0, 12),
    minutes: clampInt(inputs.minutes, 1, 30)
  };
}

function fmtClock(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

// Run one phase, then advance. Phase duration drives the CSS bubble transition.
function runPhase(plan, idx) {
  if (!running) return;
  const phase = plan[idx % plan.length];
  bubble.className = "bubble " + phase.cls;
  phaseLabel.textContent = phase.name;
  let remaining = phase.secs;
  countLabel.textContent = remaining + "s";
  chime(phase.name === "Exhale" ? 396 : 528);
  clearInterval(phaseTimer);
  phaseTimer = setInterval(() => {
    if (!running) { clearInterval(phaseTimer); return; }
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(phaseTimer);
      runPhase(plan, idx + 1);
    } else {
      countLabel.textContent = remaining + "s";
    }
  }, 1000);
}

async function start() {
  const s = readSettings();
  const plan = buildPhasePlan(s);
  if (!plan.length) return;
  await chrome.storage.local.set({ ...s, chime: inputs.chime.checked });

  running = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  sessionEnd = Date.now() + s.minutes * 60 * 1000;
  timerEl.textContent = fmtClock(s.minutes * 60 * 1000);

  clearInterval(sessionTimer);
  sessionTimer = setInterval(() => {
    const left = sessionEnd - Date.now();
    timerEl.textContent = fmtClock(left);
    if (left <= 0) stop(true);
  }, 500);

  runPhase(plan, 0);
}

function stop(completed = false) {
  running = false;
  clearInterval(phaseTimer);
  clearInterval(sessionTimer);
  bubble.className = "bubble idle";
  phaseLabel.textContent = completed ? "Complete" : "Ready";
  countLabel.innerHTML = "&nbsp;";
  startBtn.disabled = false;
  stopBtn.disabled = true;
  if (completed) { timerEl.textContent = "00:00"; chime(660); }
}

startBtn.addEventListener("click", start);
stopBtn.addEventListener("click", () => stop(false));

// Restore last-used settings.
(async () => {
  const saved = await chrome.storage.local.get(["inhale", "hold1", "exhale", "hold2", "minutes", "chime"]);
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) continue;
    if (k === "chime") inputs[k].checked = !!v;
    else inputs[k].value = v;
  }
})();

// Node test export (ignored by the browser).
if (typeof module !== "undefined") module.exports = { buildPhasePlan };
