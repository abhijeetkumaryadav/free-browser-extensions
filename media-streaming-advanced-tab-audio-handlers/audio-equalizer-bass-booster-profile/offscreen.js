/* BassLab — offscreen document.
 * Owns the WebAudio graph for captured tab audio:
 *   tabCapture MediaStream -> source -> 5 biquad bands -> master gain -> destination
 * All messages come from the popup (user gesture chain), so tabCapture.capture
 * is allowed. Nothing is recorded; the stream is processed live and discarded.
 */

'use strict';

// 5-band EQ definition: [label, type, frequency, Q]
const BANDS = [
  { label: '60 Hz',  type: 'lowshelf',  freq: 60,   q: 0.7 },
  { label: '230 Hz', type: 'peaking',   freq: 230,  q: 1.0 },
  { label: '910 Hz', type: 'peaking',   freq: 910,  q: 1.0 },
  { label: '3.6 kHz',type: 'peaking',   freq: 3600, q: 1.0 },
  { label: '14 kHz', type: 'highshelf', freq: 14000,q: 0.7 }
];

let ctx = null;          // AudioContext
let filters = [];        // BiquadFilterNodes, one per band
let masterGain = null;   // master GainNode (bypass ramps through this)
let stream = null;       // captured MediaStream
let activeTabId = null;
let bypassed = false;
let gains = [0, 0, 0, 0, 0];

function ensureGraph() {
  if (ctx) return;
  ctx = new AudioContext();
  let node = null;
  filters = BANDS.map((b) => {
    const f = ctx.createBiquadFilter();
    f.type = b.type;
    f.frequency.value = b.freq;
    f.Q.value = b.q;
    f.gain.value = 0;
    if (node) node.connect(f);
    node = f;
    return f;
  });
  masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  filters[filters.length - 1].connect(masterGain);
  masterGain.connect(ctx.destination);
}

function applyGains() {
  if (!ctx) return;
  const t = ctx.currentTime;
  filters.forEach((f, i) => {
    const target = bypassed ? 0 : gains[i];
    f.gain.setTargetAtTime(target, t, 0.03); // smooth, click-free
  });
}

async function start(tabId) {
  ensureGraph();
  if (ctx.state === 'suspended') await ctx.resume();
  // Stop any previous capture first.
  stopCaptureOnly();

  stream = await new Promise((resolve, reject) => {
    chrome.tabCapture.capture({ audio: true, video: false }, (s) => {
      if (chrome.runtime.lastError || !s) {
        reject(new Error((chrome.runtime.lastError && chrome.runtime.lastError.message) || 'Capture failed'));
      } else {
        resolve(s);
      }
    });
  });

  const src = ctx.createMediaStreamSource(stream);
  src.connect(filters[0]);
  activeTabId = tabId;
  applyGains();
  return { ok: true, bands: BANDS.map((b) => b.label) };
}

function stopCaptureOnly() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  activeTabId = null;
}

function stop() {
  stopCaptureOnly();
  if (ctx) ctx.suspend().catch(() => {});
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target !== 'basslab-offscreen') return;
  (async () => {
    switch (msg.cmd) {
      case 'start':
        sendResponse(await start(msg.tabId));
        break;
      case 'stop':
        sendResponse(stop());
        break;
      case 'setGains':
        gains = msg.gains.slice(0, 5).map((g) => Math.max(-12, Math.min(12, Number(g) || 0)));
        ensureGraph();
        applyGains();
        sendResponse({ ok: true });
        break;
      case 'setBypass':
        bypassed = !!msg.bypass;
        ensureGraph();
        applyGains();
        sendResponse({ ok: true, bypassed });
        break;
      case 'state':
        sendResponse({ ok: true, active: !!stream, tabId: activeTabId, gains, bypassed });
        break;
      default:
        sendResponse({ ok: false, error: 'unknown command' });
    }
  })().catch((err) => {
    sendResponse({ ok: false, error: String((err && err.message) || err) });
  });
  return true; // async response
});
