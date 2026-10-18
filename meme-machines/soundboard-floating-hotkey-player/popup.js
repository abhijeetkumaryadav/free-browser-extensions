/* SoundBoard — popup logic.
 * All sounds are synthesized live with the Web Audio API. No audio files,
 * no network requests. Hotkeys 1–8 play while the popup is open. */

'use strict';

/* ------------------------------------------------------------------ */
/* Audio engine                                                        */
/* ------------------------------------------------------------------ */

let audioCtx = null;   // lazily created on first user gesture
let masterGain = null;
let volume = 0.8;      // 0..1, persisted in storage

/** Get (or create) the shared AudioContext. Must be called from a user gesture. */
function ac() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/** Reusable white-noise buffer for percussive sounds. */
let noiseBuf = null;
function getNoise(ctx) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** Small helper: simple ADSR-ish envelope on a gain node. */
function env(gainNode, t, peak, attack, decay) {
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(peak, t + attack);
  g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/* Each synth function schedules one sound on `dest` starting at `t`. */

function synthAirhorn(ctx, dest, t) {
  // Classic stadium airhorn: stacked detuned saws around 233 Hz with vibrato.
  const dur = 1.1;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 30;
  lfoGain.gain.value = 12;
  lfo.connect(lfoGain);
  lfo.start(t); lfo.stop(t + dur);
  [233.1, 466.2, 349.2].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = f;
    lfoGain.connect(o.frequency);
    env(g, t, 0.22 - i * 0.05, 0.02, dur);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.1);
  });
}

function synthDrum(ctx, dest, t) {
  // Kick-drum thump: pitch-dropping sine + click of noise.
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
  env(g, t, 0.9, 0.004, 0.28);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + 0.35);

  const n = ctx.createBufferSource();
  n.buffer = getNoise(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 3000;
  const ng = ctx.createGain();
  env(ng, t, 0.25, 0.002, 0.06);
  n.connect(hp).connect(ng).connect(dest);
  n.start(t); n.stop(t + 0.1);
}

function synthLaser(ctx, dest, t) {
  // Retro laser zap: saw sweeping 1800 -> 120 Hz.
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(1800, t);
  o.frequency.exponentialRampToValueAtTime(120, t + 0.5);
  env(g, t, 0.5, 0.005, 0.55);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + 0.65);
}

function synthPop(ctx, dest, t) {
  // Short cartoon pop.
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(700, t);
  o.frequency.exponentialRampToValueAtTime(1400, t + 0.03);
  env(g, t, 0.6, 0.003, 0.09);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + 0.15);
}

function synthApplause(ctx, dest, t) {
  // Crowd-ish applause: a spray of short band-passed noise bursts.
  const dur = 1.6;
  for (let i = 0; i < 60; i++) {
    const start = t + Math.random() * dur;
    const n = ctx.createBufferSource();
    n.buffer = getNoise(ctx);
    n.playbackRate.value = 0.8 + Math.random() * 0.6;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200 + Math.random() * 2800;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    env(g, start, 0.16, 0.005, 0.05 + Math.random() * 0.08);
    n.connect(bp).connect(g).connect(dest);
    n.start(start); n.stop(start + 0.2);
  }
}

function synthSiren(ctx, dest, t) {
  // Two-tone siren: triangle swept by a slow LFO.
  const dur = 2.0;
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = 700;
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 0.9;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 260;
  lfo.connect(lfoGain).connect(o.frequency);
  const g = ctx.createGain();
  env(g, t, 0.4, 0.05, dur);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.1);
  lfo.start(t); lfo.stop(t + dur + 0.1);
}

function synthWhistle(ctx, dest, t) {
  // Referee whistle: sine ~2200 Hz with fast vibrato + breath noise.
  const dur = 0.9;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = 2200;
  const vib = ctx.createOscillator();
  vib.frequency.value = 25;
  const vibGain = ctx.createGain();
  vibGain.gain.value = 180;
  vib.connect(vibGain).connect(o.frequency);
  const g = ctx.createGain();
  env(g, t, 0.35, 0.02, dur);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.1);
  vib.start(t); vib.stop(t + dur + 0.1);

  const n = ctx.createBufferSource();
  n.buffer = getNoise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 4;
  const ng = ctx.createGain();
  env(ng, t, 0.06, 0.02, dur);
  n.connect(bp).connect(ng).connect(dest);
  n.start(t); n.stop(t + dur + 0.1);
}

function synthBell(ctx, dest, t) {
  // Chime: stacked sine partials with long exponential decay.
  const partials = [
    { f: 523.25, a: 0.5 },
    { f: 783.99, a: 0.28 },
    { f: 1046.5, a: 0.18 },
    { f: 1567.98, a: 0.08 },
  ];
  partials.forEach(p => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = p.f;
    env(g, t, p.a, 0.005, 1.8);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + 2.0);
  });
}

/* ------------------------------------------------------------------ */
/* Sound catalog                                                       */
/* ------------------------------------------------------------------ */

/* Lucide-style stroke icons (24x24, stroke-width 2, round caps). */
const ICONS = {
  airhorn: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  drum: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>',
  laser: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  pop: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>',
  applause: '<path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/>',
  siren: '<path d="M7 18v-6a5 5 0 0 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1z"/><path d="M12 7V4"/>',
  whistle: '<path d="M4 10v4a8 8 0 0 0 8 8h1a4 4 0 0 0 4-4v-1a8 8 0 0 0-8-8z"/><circle cx="17.5" cy="11.5" r="1.5"/><path d="M4 10h4"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
};

const SOUNDS = [
  { id: 'airhorn',  name: 'Airhorn',  key: '1', synth: synthAirhorn,  icon: ICONS.airhorn },
  { id: 'drum',     name: 'Drum Hit', key: '2', synth: synthDrum,     icon: ICONS.drum },
  { id: 'laser',    name: 'Laser',    key: '3', synth: synthLaser,    icon: ICONS.laser },
  { id: 'pop',      name: 'Pop',      key: '4', synth: synthPop,      icon: ICONS.pop },
  { id: 'applause', name: 'Applause', key: '5', synth: synthApplause, icon: ICONS.applause },
  { id: 'siren',    name: 'Siren',    key: '6', synth: synthSiren,    icon: ICONS.siren },
  { id: 'whistle',  name: 'Whistle',  key: '7', synth: synthWhistle,  icon: ICONS.whistle },
  { id: 'bell',     name: 'Bell',     key: '8', synth: synthBell,     icon: ICONS.bell },
];

/** Play a sound by id through the popup's own AudioContext. */
function playSound(id) {
  const s = SOUNDS.find(x => x.id === id);
  if (!s) return;
  const ctx = ac();
  s.synth(ctx, masterGain, ctx.currentTime);
  // Button press feedback.
  const btn = document.querySelector(`[data-sound="${id}"]`);
  if (btn) {
    btn.classList.add('playing');
    setTimeout(() => btn.classList.remove('playing'), 250);
  }
}

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

function iconSvg(inner) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

function buildGrid() {
  const grid = document.getElementById('soundGrid');
  SOUNDS.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'sound-btn';
    btn.dataset.sound = s.id;
    btn.innerHTML = `${iconSvg(s.icon)}<span>${s.name}</span><span class="key">${s.key}</span>`;
    btn.addEventListener('click', () => playSound(s.id));
    grid.appendChild(btn);
  });
}

/** Hotkeys 1–8 while the popup is open. */
function bindHotkeys() {
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return; // don't hijack the volume slider
    const s = SOUNDS.find(x => x.key === e.key);
    if (s) playSound(s.id);
  });
}

/* Volume: persisted in chrome.storage.local, shared with the mini player. */
async function initVolume() {
  const { sbVolume = 80 } = await chrome.storage.local.get('sbVolume');
  volume = sbVolume / 100;
  const slider = document.getElementById('volume');
  const label = document.getElementById('volVal');
  slider.value = sbVolume;
  label.textContent = sbVolume + '%';
  slider.addEventListener('input', async () => {
    volume = slider.value / 100;
    label.textContent = slider.value + '%';
    if (masterGain) masterGain.gain.value = volume;
    await chrome.storage.local.set({ sbVolume: Number(slider.value) });
  });
}

/* Floating mini player: injects a small draggable panel into the active tab.
 * Runs only on an explicit user click. Toggle removes it if already open. */
async function toggleFloatingPlayer() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['player-content.js'],
    });
  } catch (err) {
    // Restricted pages (chrome://, Web Store, etc.) refuse injection.
    alert('Cannot add the floating player to this page (browser-restricted page).');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  buildGrid();
  bindHotkeys();
  initVolume();
  document.getElementById('floatBtn').addEventListener('click', toggleFloatingPlayer);
});
