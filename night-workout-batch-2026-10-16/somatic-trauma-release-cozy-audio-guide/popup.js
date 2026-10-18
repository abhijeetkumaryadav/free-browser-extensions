/* Cozy Audio Guide — generated ambient tones + timed relaxation prompts.
   100% local. No audio is recorded, uploaded, or sent anywhere. */

// ---------- Guided session script (gentle prompts, no therapeutic claims) ----------
const PHASES = [
  {
    title: "Settle In",
    secs: 60,
    text: "Find a comfortable position. Let your shoulders drop and unclench your jaw. There's nothing you need to do for the next few minutes."
  },
  {
    title: "Slow Breathing",
    secs: 120,
    text: "Breathe in slowly through your nose… and out through your mouth. Let each exhale be a little longer than the inhale. Follow the soft tones."
  },
  {
    title: "Soften",
    secs: 120,
    text: "Notice anywhere that feels tight — your forehead, neck, hands. With each exhale, imagine that area softening, just a little."
  },
  {
    title: "Quiet Rest",
    secs: 180,
    text: "Rest in the quiet. The tones will fade gently on their own. When the session ends, take one more slow breath before continuing your day."
  }
];

// ---------- State ----------
let audioCtx = null;      // Web Audio context (created on user gesture)
let masterGain = null;    // master output gain
let padNodes = [];        // oscillator nodes for the ambient pad
let ambientOn = true;
let volume = 0.6;

let sessionRunning = false;
let phaseIdx = -1;
let remaining = 0;
let tickId = null;

// ---------- DOM refs ----------
const $ = (id) => document.getElementById(id);
const startBtn = $("startBtn"), prevBtn = $("prevBtn"), nextBtn = $("nextBtn");
const phaseKicker = $("phaseKicker"), phaseTime = $("phaseTime");
const phaseTitle = $("phaseTitle"), phaseText = $("phaseText");
const progressFill = $("progressFill"), dots = $("dots");
const ambientToggle = $("ambientToggle"), volumeSlider = $("volume");

// ---------- Audio engine (all sounds synthesized, no files) ----------
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = ambientOn ? volume * 0.5 : 0;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

// Warm, slow pad: two detuned sines through a lowpass + gentle LFO swell.
function startPad() {
  if (!audioCtx || padNodes.length) return;
  const t = audioCtx.currentTime;
  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  filter.connect(masterGain);

  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 0.05;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  [[110, "sine", 0.10], [164.81, "sine", 0.07], [220, "triangle", 0.04]].forEach(([freq, type, g]) => {
    const osc = audioCtx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const og = audioCtx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(g, t + 4); // slow fade-in
    osc.connect(og);
    og.connect(filter);
    osc.start();
    padNodes.push(osc, og);
  });
  lfo.start();
  padNodes.push(lfo, lfoGain, filter);
}

function stopPad() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  padNodes.forEach((n) => {
    try {
      if (n instanceof GainNode) n.gain.linearRampToValueAtTime(0, t + 1.5);
      else if (n instanceof OscillatorNode) n.stop(t + 2);
    } catch (e) { /* already stopped */ }
  });
  const old = padNodes;
  padNodes = [];
  setTimeout(() => old.forEach((n) => { try { n.disconnect(); } catch (e) {} }), 2200);
}

// Soft chime marking phase changes.
function chime() {
  if (!audioCtx || !ambientOn) return;
  const t = audioCtx.currentTime;
  [523.25, 784].forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, t + i * 0.25);
    g.gain.linearRampToValueAtTime(0.12, t + i * 0.25 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.25 + 2.5);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t + i * 0.25);
    osc.stop(t + i * 0.25 + 2.6);
  });
}

// ---------- Session engine ----------
function fmt(s) {
  s = Math.max(0, Math.ceil(s));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

function renderDots() {
  dots.innerHTML = "";
  PHASES.forEach((_, i) => {
    const d = document.createElement("span");
    if (i < phaseIdx) d.className = "done";
    else if (i === phaseIdx) d.className = "active";
    dots.appendChild(d);
  });
}

function showPhase(i) {
  phaseIdx = i;
  const p = PHASES[i];
  remaining = p.secs;
  phaseKicker.textContent = `Phase ${i + 1} of ${PHASES.length}`;
  phaseTitle.textContent = p.title;
  phaseText.textContent = p.text;
  phaseTime.textContent = fmt(remaining);
  progressFill.style.width = "0%";
  prevBtn.disabled = i === 0;
  nextBtn.disabled = i === PHASES.length - 1;
  renderDots();
  chime();
}

function tick() {
  remaining -= 1;
  const p = PHASES[phaseIdx];
  phaseTime.textContent = fmt(remaining);
  progressFill.style.width = ((p.secs - remaining) / p.secs * 100).toFixed(1) + "%";
  if (remaining <= 0) {
    if (phaseIdx < PHASES.length - 1) showPhase(phaseIdx + 1);
    else endSession(true);
  }
}

function startSession() {
  ensureAudio();
  if (ambientOn) startPad();
  sessionRunning = true;
  startBtn.textContent = "End session";
  startBtn.classList.add("stop");
  showPhase(0);
  tickId = setInterval(tick, 1000);
}

function endSession(completed) {
  sessionRunning = false;
  clearInterval(tickId);
  tickId = null;
  stopPad();
  startBtn.textContent = "Start guided session";
  startBtn.classList.remove("stop");
  prevBtn.disabled = true;
  nextBtn.disabled = true;
  phaseKicker.textContent = completed ? "Complete" : "Ended";
  phaseTitle.textContent = completed ? "Well done" : "Session ended";
  phaseText.textContent = completed
    ? "Take one more slow breath, gently move your fingers and toes, and carry a little of this calm with you."
    : "Press Start whenever you'd like to begin again.";
  phaseTime.textContent = "--:--";
  progressFill.style.width = completed ? "100%" : "0%";
  dots.innerHTML = "";
  phaseIdx = -1;
}

// ---------- Events ----------
startBtn.addEventListener("click", () => {
  if (sessionRunning) endSession(false);
  else startSession();
});
prevBtn.addEventListener("click", () => { if (sessionRunning && phaseIdx > 0) showPhase(phaseIdx - 1); });
nextBtn.addEventListener("click", () => { if (sessionRunning && phaseIdx < PHASES.length - 1) showPhase(phaseIdx + 1); });

ambientToggle.addEventListener("change", () => {
  ambientOn = ambientToggle.checked;
  chrome.storage.local.set({ cagAmbient: ambientOn });
  if (audioCtx) {
    masterGain.gain.linearRampToValueAtTime(ambientOn ? volume * 0.5 : 0, audioCtx.currentTime + 0.5);
    if (ambientOn && sessionRunning) startPad();
  }
});

volumeSlider.addEventListener("input", () => {
  volume = volumeSlider.value / 100;
  chrome.storage.local.set({ cagVolume: volumeSlider.value });
  if (audioCtx && ambientOn) masterGain.gain.value = volume * 0.5;
});

// ---------- Restore prefs ----------
chrome.storage.local.get(["cagVolume", "cagAmbient"], (res) => {
  if (res.cagVolume !== undefined) {
    volume = res.cagVolume / 100;
    volumeSlider.value = res.cagVolume;
  }
  if (res.cagAmbient !== undefined) {
    ambientOn = !!res.cagAmbient;
    ambientToggle.checked = ambientOn;
  }
});
