/* RainScape offscreen audio engine.
 * All ambience is synthesized with the Web Audio API — no audio files, no network.
 * Lives in an offscreen document (AUDIO_PLAYBACK) so sound continues while the popup is closed.
 * State is mirrored to chrome.storage.local so the popup always shows the truth. */
'use strict';

const MSG_TARGET = 'rainscape-offscreen';

let ctx = null;          // AudioContext, created on play, closed on stop
let playing = false;
let master = null, rainGain = null, windGain = null;
let thunderTimer = null, sleepTimer = null;
let settings = { master: 70, rain: 60, wind: 30, thunder: 50 };

// --- Noise buffers -----------------------------------------------------------
function makeNoiseBuffer(seconds, brown) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      // Leaky integrator -> brown-ish noise, good for low rumbles.
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    } else {
      d[i] = w;
    }
  }
  return buf;
}

// --- Graph -------------------------------------------------------------------
function build() {
  ctx = new AudioContext();

  master = ctx.createGain();
  master.gain.value = settings.master / 100;
  master.connect(ctx.destination);

  // Rain: looped white noise, band-shaped to sound like rainfall.
  const rainSrc = ctx.createBufferSource();
  rainSrc.buffer = makeNoiseBuffer(2, false);
  rainSrc.loop = true;
  const rainHP = ctx.createBiquadFilter();
  rainHP.type = 'highpass'; rainHP.frequency.value = 900;
  const rainLP = ctx.createBiquadFilter();
  rainLP.type = 'lowpass'; rainLP.frequency.value = 6500;
  rainGain = ctx.createGain();
  rainGain.gain.value = (settings.rain / 100) * 0.5;
  rainSrc.connect(rainHP); rainHP.connect(rainLP); rainLP.connect(rainGain);
  rainGain.connect(master);
  rainSrc.start();

  // Wind: looped white noise through a lowpass whose cutoff slowly breathes.
  const windSrc = ctx.createBufferSource();
  windSrc.buffer = makeNoiseBuffer(3, false);
  windSrc.loop = true;
  const windLP = ctx.createBiquadFilter();
  windLP.type = 'lowpass'; windLP.frequency.value = 420; windLP.Q.value = 0.6;
  windGain = ctx.createGain();
  windGain.gain.value = (settings.wind / 100) * 0.7;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine'; lfo.frequency.value = 0.08; // one gust cycle ~12 s
  const lfoAmt = ctx.createGain();
  lfoAmt.gain.value = 260;
  lfo.connect(lfoAmt); lfoAmt.connect(windLP.frequency);
  lfo.start();
  windSrc.connect(windLP); windLP.connect(windGain);
  windGain.connect(master);
  windSrc.start();

  scheduleThunder();
}

// --- Thunder -----------------------------------------------------------------
function rumble() {
  if (!ctx || !playing) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(4, true);
  src.playbackRate.value = 0.45 + Math.random() * 0.3;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 90 + Math.random() * 120;
  const g = ctx.createGain();
  const peak = Math.max(0.001, 0.9 * (settings.thunder / 100));
  const attack = 0.15 + Math.random() * 0.35;
  const decay = 2.2 + Math.random() * 2.0;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  src.connect(lp); lp.connect(g); g.connect(master);
  src.start(t);
  src.stop(t + attack + decay + 0.2);
}

function scheduleThunder() {
  if (thunderTimer) { clearTimeout(thunderTimer); thunderTimer = null; }
  if (!playing || settings.thunder <= 0) return;
  // Slider 1..100 maps to a mean interval of ~30 s .. ~5 s.
  const base = 30 - (settings.thunder / 100) * 25;
  const delayMs = base * (0.6 + Math.random() * 0.8) * 1000;
  thunderTimer = setTimeout(() => {
    rumble();
    scheduleThunder();
  }, delayMs);
}

// --- Settings ----------------------------------------------------------------
function applySettings(next) {
  settings = { ...settings, ...next };
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.master / 100, t, 0.05);
  rainGain.gain.setTargetAtTime((settings.rain / 100) * 0.5, t, 0.1);
  windGain.gain.setTargetAtTime((settings.wind / 100) * 0.7, t, 0.1);
  scheduleThunder();
}

async function persist() {
  const endsAt = sleepTimer ? Date.now() + sleepTimer._ms : 0;
  await chrome.storage.local.set({
    rainscape: { playing, endsAt, settings: { ...settings } },
  });
}

async function start(nextSettings, sleepMin) {
  settings = { ...settings, ...(nextSettings || {}) };
  if (!ctx) build();
  else applySettings({});
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch (e) { /* non-fatal */ }
  }
  playing = true;

  if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null; }
  if (sleepMin > 0) {
    const ms = sleepMin * 60000;
    sleepTimer = setTimeout(async () => {
      await stop();
    }, ms);
    sleepTimer._ms = ms; // stash for persist()
  }
  await persist();
}

async function stop() {
  playing = false;
  if (thunderTimer) { clearTimeout(thunderTimer); thunderTimer = null; }
  if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null; }
  if (ctx) {
    try { await ctx.close(); } catch (e) { /* non-fatal */ }
    ctx = null;
  }
  await chrome.storage.local.set({
    rainscape: { playing: false, endsAt: 0, settings: { ...settings } },
  });
}

// --- Messages from the popup ---------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target !== MSG_TARGET) return false;
  (async () => {
    if (msg.type === 'rs-play') {
      await start(msg.settings, msg.sleepMin || 0);
      sendResponse({ ok: true, playing });
    } else if (msg.type === 'rs-stop') {
      await stop();
      sendResponse({ ok: true, playing });
    } else if (msg.type === 'rs-update') {
      applySettings(msg.settings || {});
      await persist();
      sendResponse({ ok: true, playing });
    } else if (msg.type === 'rs-state') {
      sendResponse({ ok: true, playing, settings: { ...settings } });
    } else {
      sendResponse({ ok: false });
    }
  })().catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true; // async response
});
