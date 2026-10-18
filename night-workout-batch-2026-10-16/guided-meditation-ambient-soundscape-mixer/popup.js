/* Ambient Soundscape Mixer — four synthesized layers, per-layer volume,
   master volume, session timer. 100% local; nothing recorded or transmitted. */

// ---------- Layer definitions (all synthesized with Web Audio) ----------
const LAYERS = [
  {
    id: "rain", name: "Rain", desc: "Filtered noise patter",
    icon: '<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/><line x1="8" y1="19" x2="8" y2="21"/><line x1="12" y1="17" x2="12" y2="19"/><line x1="16" y1="19" x2="16" y2="21"/>',
    defVol: 55,
    build(ctx) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, false);
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 0.4;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 900;
      src.connect(bp); bp.connect(hp);
      src.start();
      return { out: hp, stop: () => { try { src.stop(); } catch (e) {} } };
    }
  },
  {
    id: "rumble", name: "Deep rumble", desc: "Low brown-noise drone",
    icon: '<path d="M2 12h4l3-8 4 16 3-8h6"/>',
    defVol: 40,
    build(ctx) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, true);
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 180;
      src.connect(lp);
      src.start();
      return { out: lp, stop: () => { try { src.stop(); } catch (e) {} } };
    }
  },
  {
    id: "pad", name: "Warm pad", desc: "Soft synthesized chord",
    icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
    defVol: 45,
    build(ctx) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 700;
      const oscs = [];
      [130.81, 164.81, 196.0, 261.63].forEach((f) => {
        const o = ctx.createOscillator();
        o.type = "sine"; o.frequency.value = f;
        const g = ctx.createGain(); g.gain.value = 0.12;
        o.connect(g); g.connect(lp); o.start();
        oscs.push(o);
      });
      return { out: lp, stop: () => oscs.forEach((o) => { try { o.stop(); } catch (e) {} }) };
    }
  },
  {
    id: "ocean", name: "Ocean", desc: "Slow swelling waves",
    icon: '<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
    defVol: 50,
    build(ctx) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, true);
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 400;
      // Slow LFO sweeps the filter cutoff to mimic waves.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.09;
      const lfoG = ctx.createGain(); lfoG.gain.value = 220;
      lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
      src.connect(lp);
      src.start();
      return { out: lp, stop: () => { try { src.stop(); lfo.stop(); } catch (e) {} } };
    }
  }
];

// ---------- Shared noise buffer cache ----------
const _noiseCache = {};
function noiseBuffer(ctx, brown) {
  const key = brown ? "brown" : "white";
  if (_noiseCache[key]) return _noiseCache[key];
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else d[i] = w;
  }
  _noiseCache[key] = buf;
  return buf;
}

// ---------- State ----------
let ctx = null, master = null;
let playing = false;
const layerState = {};   // id -> { gain, nodes, on, vol }
let timerId = null, timerEnd = 0, timerMin = 15;

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const layersEl = $("layers"), playBtn = $("playBtn"), playIcon = $("playIcon");
const masterVol = $("masterVol"), timerSel = $("timerSel"), timerDisplay = $("timerDisplay");
const ICON_PLAY = '<polygon points="6 4 20 12 6 20"/>';
const ICON_STOP = '<rect x="6" y="6" width="12" height="12" rx="2"/>';

// ---------- Build layer UI ----------
LAYERS.forEach((L) => {
  const div = document.createElement("div");
  div.className = "layer";
  div.id = "layer-" + L.id;
  div.innerHTML = `
    <div class="layer-top">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${L.icon}</svg>
      <div class="name">${L.name}<span class="desc">${L.desc}</span></div>
      <label class="switch"><input type="checkbox" checked><span class="slider"></span></label>
    </div>
    <input type="range" min="0" max="100" value="${L.defVol}" aria-label="${L.name} volume">`;
  layersEl.appendChild(div);

  const toggle = div.querySelector('input[type="checkbox"]');
  const slider = div.querySelector('input[type="range"]');
  layerState[L.id] = { on: true, vol: L.defVol / 100, gain: null, nodes: null, toggle, slider, div, def: L };

  toggle.addEventListener("change", () => {
    layerState[L.id].on = toggle.checked;
    div.classList.toggle("off", !toggle.checked);
    applyLayerGain(L.id);
    savePrefs();
  });
  slider.addEventListener("input", () => {
    layerState[L.id].vol = slider.value / 100;
    applyLayerGain(L.id);
    savePrefs();
  });
});

function applyLayerGain(id) {
  const s = layerState[id];
  if (s.gain && ctx) {
    const target = s.on ? s.vol : 0;
    s.gain.gain.linearRampToValueAtTime(target * 0.6, ctx.currentTime + 0.3);
  }
}

// ---------- Transport ----------
function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = masterVol.value / 100 * 0.8;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
}

function startAll() {
  ensureAudio();
  LAYERS.forEach((L) => {
    const s = layerState[L.id];
    if (s.nodes) return; // already running
    const nodes = L.build(ctx);
    const g = ctx.createGain();
    g.gain.value = s.on ? s.vol * 0.6 : 0;
    nodes.out.connect(g);
    g.connect(master);
    s.gain = g; s.nodes = nodes;
  });
  playing = true;
  playIcon.innerHTML = ICON_STOP;
  startTimer();
}

function stopAll(fadeMs = 800) {
  if (!ctx) { playing = false; playIcon.innerHTML = ICON_PLAY; return; }
  const t = ctx.currentTime;
  master.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
  const oldMaster = master, oldCtx = ctx;
  const olds = Object.values(layerState).map((s) => s.nodes).filter(Boolean);
  Object.values(layerState).forEach((s) => { s.gain = null; s.nodes = null; });
  setTimeout(() => {
    olds.forEach((n) => { try { n.stop(); } catch (e) {} });
    try { oldMaster.disconnect(); } catch (e) {}
    // Fresh context next start avoids stale ramped gains.
    ctx = null; master = null;
    for (const k in _noiseCache) delete _noiseCache[k];
    void oldCtx;
  }, fadeMs + 300);
  clearInterval(timerId); timerId = null;
  playing = false;
  playIcon.innerHTML = ICON_PLAY;
  timerDisplay.textContent = timerMin > 0 ? "Timer off — plays until you stop it" : "Timer off — plays until you stop it";
  updateTimerText();
}

function ensureAudio() { ensureCtx(); }

playBtn.addEventListener("click", () => {
  if (playing) stopAll();
  else startAll();
});

masterVol.addEventListener("input", () => {
  if (master && ctx) master.gain.value = masterVol.value / 100 * 0.8;
  savePrefs();
});

// ---------- Session timer ----------
function startTimer() {
  clearInterval(timerId); timerId = null;
  if (timerMin <= 0) { updateTimerText(); return; }
  timerEnd = Date.now() + timerMin * 60 * 1000;
  updateTimerText();
  timerId = setInterval(() => {
    const left = timerEnd - Date.now();
    if (left <= 0) { stopAll(4000); timerDisplay.textContent = "Session complete — fading out…"; return; }
    updateTimerText(left);
  }, 1000);
}

function updateTimerText(left) {
  if (timerMin <= 0) { timerDisplay.textContent = "Timer off — plays until you stop it"; return; }
  const ms = left !== undefined ? left : timerMin * 60 * 1000;
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  timerDisplay.textContent = `Stopping in ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

timerSel.addEventListener("change", () => {
  timerMin = parseInt(timerSel.value, 10);
  savePrefs();
  if (playing) startTimer(); else updateTimerText();
});

// ---------- Prefs ----------
function savePrefs() {
  const p = {
    master: masterVol.value, timer: timerSel.value,
    layers: Object.fromEntries(Object.entries(layerState).map(([id, s]) => [id, { on: s.on, vol: Math.round(s.vol * 100) }]))
  };
  chrome.storage.local.set({ asmPrefs: p });
}

chrome.storage.local.get(["asmPrefs"], (res) => {
  const p = res.asmPrefs;
  if (!p) return;
  if (p.master !== undefined) masterVol.value = p.master;
  if (p.timer !== undefined) { timerSel.value = p.timer; timerMin = parseInt(p.timer, 10); }
  if (p.layers) {
    Object.entries(p.layers).forEach(([id, lp]) => {
      const s = layerState[id];
      if (!s) return;
      s.on = !!lp.on; s.vol = (lp.vol || 50) / 100;
      s.toggle.checked = s.on; s.slider.value = lp.vol || 50;
      s.div.classList.toggle("off", !s.on);
    });
  }
  updateTimerText();
});
