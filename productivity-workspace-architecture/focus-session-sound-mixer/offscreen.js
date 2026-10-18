// Focus Session Sound Mixer — offscreen audio document.
// Generates ambient sounds live with WebAudio (no audio files):
// white / pink / brown noise plus a rain-like filtered noise with a
// gentle amplitude wobble. Each sound has its own gain; everything is
// created lazily and kept looping so toggling is instant.

const IDS = ["rain", "white", "pink", "brown"];
let ctx = null;
let master = null;
const voices = {}; // id -> { gain: GainNode, wobble: GainNode|null }

function ensure() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  for (const id of IDS) {
    const src = ctx.createBufferSource();
    src.buffer = buildBuffer(id);
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(g);
    g.connect(master);
    src.start();
    let wobble = null;
    if (id === "rain") {
      // slow amplitude wobble so the rain feels alive
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.12;
      wobble = ctx.createGain();
      wobble.gain.value = 0;
      lfo.connect(wobble);
      wobble.connect(g.gain);
      lfo.start();
    }
    voices[id] = { gain: g, wobble };
  }
}

// 2-second looping buffers. Pink uses the Paul Kellet filter,
// brown is a leaky integrator, rain is low-passed white noise.
function buildBuffer(id) {
  const len = 2 * ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (id === "white") {
      d[i] = w * 0.45;
    } else if (id === "pink") {
      b0 = 0.997 * b0 + 0.029591 * w;
      b1 = 0.985 * b1 + 0.032534 * w;
      b2 = 0.95 * b2 + 0.048056 * w;
      d[i] = (b0 + b1 + b2 + w * 0.05) * 0.22;
    } else if (id === "brown") {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.0;
    } else { // rain: darkened, softened noise
      last += 0.16 * (w - last);
      d[i] = last * 1.5;
    }
  }
  return buf;
}

// Apply a full mixer snapshot: { master, sounds: { id: { on, vol } } }
function apply(mixer) {
  ensure();
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(mixer.master, t, 0.1);
  for (const id of IDS) {
    const s = mixer.sounds[id];
    const v = voices[id];
    v.gain.gain.setTargetAtTime(s.on ? s.vol * 0.9 : 0, t, 0.15);
    if (v.wobble) v.wobble.gain.setTargetAtTime(s.on ? s.vol * 0.25 : 0, t, 0.3);
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target !== "offscreen") return;
  if (msg.cmd === "audio.apply" && msg.mixer) apply(msg.mixer);
});
