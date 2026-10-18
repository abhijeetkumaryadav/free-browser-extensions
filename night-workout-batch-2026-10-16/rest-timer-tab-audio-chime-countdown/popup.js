// popup.js — Rest Timer UI.
// Countdown state lives in chrome.storage.local (driven by the background
// worker's alarm). Chime = generated Web Audio tone (no audio files).

// --- Generated chime (Web Audio) -------------------------------------------
let audioCtx = null;
function playChime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    // Three ascending tones, triangle wave, simple envelope.
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch (e) { /* audio unavailable — silent finish */ }
}

// --- UI --------------------------------------------------------------------
const RING = 439.8; // 2πr, r=70
const timeEl = document.getElementById("time");
const progEl = document.getElementById("prog");
const startStopBtn = document.getElementById("startStop");
const resetBtn = document.getElementById("reset");
const customInput = document.getElementById("customSec");
const presetBtns = [...document.querySelectorAll("#presets button")];

let lastRunning = false;
let chimedFor = 0;

function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
}

function refresh() {
  chrome.storage.local.get(["endsAt", "durationSec", "running", "finishedAt"],
    ({ endsAt, durationSec, running, finishedAt }) => {
      durationSec = durationSec || 90;
      const left = running ? Math.max(0, Math.round((endsAt - Date.now()) / 1000)) : durationSec;
      timeEl.textContent = fmt(left);
      progEl.style.strokeDashoffset = String(RING * (1 - left / durationSec));
      startStopBtn.textContent = running ? "Stop" : "Start";
      startStopBtn.classList.toggle("stop", running);
      // Chime once when the timer just finished (popup open at that moment).
      if (!running && finishedAt && finishedAt !== chimedFor) {
        chimedFor = finishedAt;
        playChime();
      }
      lastRunning = running;
    });
}

function pickDuration() {
  const custom = parseInt(customInput.value, 10);
  if (!isNaN(custom) && custom >= 1 && custom <= 3600) return custom;
  const active = document.querySelector("#presets button.active");
  return active ? parseInt(active.dataset.sec, 10) : 90;
}

presetBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    presetBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    customInput.value = btn.dataset.sec;
    chrome.storage.local.get("running", ({ running }) => {
      if (!running) chrome.storage.local.set({ durationSec: parseInt(btn.dataset.sec, 10) });
    });
  });
});

startStopBtn.addEventListener("click", () => {
  chrome.storage.local.get("running", ({ running }) => {
    if (running) {
      chrome.runtime.sendMessage({ type: "STOP" }, refresh);
    } else {
      const sec = pickDuration();
      // User gesture: resume AudioContext now so the later chime is allowed.
      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") audioCtx.resume();
      } catch (e) {}
      chrome.runtime.sendMessage({ type: "START", durationSec: sec }, refresh);
    }
  });
});

resetBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "RESET" }, refresh);
});

setInterval(refresh, 250);
refresh();
