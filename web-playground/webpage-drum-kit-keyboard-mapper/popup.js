"use strict";
/* BeatPad — keyboard drum kit.
 * Every sound is synthesized live with the Web Audio API. No audio files,
 * no network calls, no data collection. Just a fun toy.
 */

/* ---- Pad definitions: key label -> drum voice ---- */
const PADS = [
  { key: "A", name: "Kick",   play: playKick  },
  { key: "S", name: "Snare",  play: playSnare },
  { key: "D", name: "Hi-Hat", play: playHat   },
  { key: "F", name: "Tom 1",  play: (t, v) => playTom(t, v, 180) },
  { key: "G", name: "Tom 2",  play: (t, v) => playTom(t, v, 140) },
  { key: "H", name: "Tom 3",  play: (t, v) => playTom(t, v, 100) },
  { key: "J", name: "Crash",  play: playCrash },
  { key: "K", name: "Clap",   play: playClap  },
];

let audioCtx = null;      // created lazily on first user gesture
let masterGain = null;    // master volume node
let volume = 0.8;         // 0..1, persisted
let noiseBuffer = null;   // shared white-noise buffer

/** Get (or create) the AudioContext — must be created/resumed from a user gesture. */
function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(audioCtx.destination);
    // Shared 2s white-noise buffer for all noise-based voices.
    noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

/** Helper: a noise source routed through a filter with an amplitude envelope. */
function noiseHit({ time, duration, filterType, frequency, q = 1, gainPeak = 1 }) {
  const ac = ctx();
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  const filt = ac.createBiquadFilter();
  filt.type = filterType;
  filt.frequency.value = frequency;
  filt.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(gainPeak, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + duration);
  src.connect(filt).connect(g).connect(masterGain);
  src.start(time);
  src.stop(time + duration + 0.05);
}

/** Helper: an oscillator with pitch drop + amplitude envelope. */
function toneHit({ time, duration, type = "sine", freqStart, freqEnd, gainPeak = 1 }) {
  const ac = ctx();
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, time);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, time + duration);
  const g = ac.createGain();
  g.gain.setValueAtTime(gainPeak, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + duration);
  osc.connect(g).connect(masterGain);
  osc.start(time);
  osc.stop(time + duration + 0.05);
}

/* ---- Drum voices ---- */
function playKick(time) {
  toneHit({ time, duration: 0.42, freqStart: 150, freqEnd: 40, gainPeak: 1 });
  noiseHit({ time, duration: 0.03, filterType: "lowpass", frequency: 900, gainPeak: 0.4 });
}

function playSnare(time) {
  noiseHit({ time, duration: 0.18, filterType: "highpass", frequency: 1800, gainPeak: 0.7 });
  toneHit({ time, duration: 0.11, type: "triangle", freqStart: 220, freqEnd: 170, gainPeak: 0.5 });
}

function playHat(time) {
  noiseHit({ time, duration: 0.055, filterType: "highpass", frequency: 7500, gainPeak: 0.45 });
}

function playTom(time, _vol, baseFreq) {
  toneHit({ time, duration: 0.35, freqStart: baseFreq * 1.6, freqEnd: baseFreq * 0.7, gainPeak: 0.9 });
}

function playCrash(time) {
  noiseHit({ time, duration: 1.4, filterType: "highpass", frequency: 5000, gainPeak: 0.5 });
  noiseHit({ time, duration: 0.9, filterType: "bandpass", frequency: 8000, q: 0.8, gainPeak: 0.3 });
}

function playClap(time) {
  // A clap is 3 quick noise bursts + a tail.
  for (let i = 0; i < 3; i++) {
    noiseHit({ time: time + i * 0.02, duration: 0.03, filterType: "bandpass", frequency: 2200, q: 2, gainPeak: 0.7 });
  }
  noiseHit({ time: time + 0.06, duration: 0.22, filterType: "bandpass", frequency: 1800, q: 1.5, gainPeak: 0.6 });
}

/* ---- UI ---- */
const padGrid = document.getElementById("padGrid");
const padEls = [];

PADS.forEach((pad) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pad";
  btn.innerHTML = "";
  const keyEl = document.createElement("span");
  keyEl.className = "key";
  keyEl.textContent = pad.key;
  const nameEl = document.createElement("span");
  nameEl.className = "name";
  nameEl.textContent = pad.name;
  btn.appendChild(keyEl);
  btn.appendChild(nameEl);
  btn.title = `${pad.name} (${pad.key})`;
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    hitPad(pad);
  });
  padGrid.appendChild(btn);
  padEls.push(btn);
});

/** Trigger a pad: flash it and play its voice. */
function hitPad(pad, when = 0) {
  const ac = ctx();
  const t = when || ac.currentTime;
  pad.play(t);
  const el = padEls[PADS.indexOf(pad)];
  if (el) {
    el.classList.add("hit");
    setTimeout(() => el.classList.remove("hit"), 110);
  }
}

/* Keyboard mapping: A–K. Ignore key events from form controls. */
const keyMap = {};
PADS.forEach((p) => { keyMap[p.key.toLowerCase()] = p; });

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  const pad = keyMap[e.key.toLowerCase()];
  if (pad) {
    e.preventDefault();
    hitPad(pad);
  }
});

/* Volume control (persisted in chrome.storage.local). */
const volumeEl = document.getElementById("volume");
const volVal = document.getElementById("volVal");

function applyVolume(v) {
  volume = Math.min(1, Math.max(0, v));
  if (masterGain) masterGain.gain.value = volume;
  volumeEl.value = Math.round(volume * 100);
  volVal.textContent = `${Math.round(volume * 100)}%`;
}

volumeEl.addEventListener("input", () => {
  applyVolume(volumeEl.value / 100);
  chrome.storage.local.set({ beatpadVolume: volume });
});

chrome.storage.local.get({ beatpadVolume: 0.8 }, (res) => applyVolume(res.beatpadVolume));

/* ---- Demo beat ---- */
let demoTimers = [];
const demoBtn = document.getElementById("demoBtn");
const stopBtn = document.getElementById("stopBtn");

/* A simple 8th-note rock groove, 120 BPM. Steps reference pad indexes:
 * 0=Kick 1=Snare 2=Hat 3..5=Toms 6=Crash 7=Clap */
const DEMO_PATTERN = [
  [0, 2], [2], [1, 2], [2], [0, 2], [2], [1, 2], [2],
  [0, 2], [2], [1, 2], [2], [0, 3, 2], [4], [5, 2], [6],
];

function stopDemo() {
  demoTimers.forEach(clearTimeout);
  demoTimers = [];
}

function playDemo() {
  stopDemo();
  ctx(); // ensure audio is unlocked from this gesture
  const stepDur = 60 / 120 / 2; // 8th note at 120 BPM
  const start = audioCtx.currentTime + 0.06;
  DEMO_PATTERN.forEach((hits, i) => {
    demoTimers.push(setTimeout(() => {
      hits.forEach((idx) => hitPad(PADS[idx]));
    }, (start - audioCtx.currentTime + i * stepDur) * 1000));
  });
}

demoBtn.addEventListener("click", playDemo);
stopBtn.addEventListener("click", stopDemo);
window.addEventListener("unload", stopDemo);
