/* Page Drum Kit — content script.
 * User-triggered visual/audio toy. Builds an overlay of CLONES of visible page
 * elements as drum pads; the real page DOM is never modified. Sounds are
 * synthesized locally with the Web Audio API (no audio files, no network).
 * Esc or the popup's stop button removes everything. */
'use strict';

(() => {
  // Guard against double injection on repeated starts.
  if (window.__pdkBoot) return;
  window.__pdkBoot = true;

  const ACCENT = '#34d399';
  let overlay = null;      // wrapper div holding pad clones
  let audioCtx = null;     // lazily created on first user gesture
  let volume = 0.7;
  let escHandler = null;

  /* ---------- audio: local Web Audio synthesis ---------- */

  function ctx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function noiseBuffer(ac) {
    const len = ac.sampleRate * 0.5;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function playNoise(ac, { freq, q, type, dur, gain }) {
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac);
    const filt = ac.createBiquadFilter();
    filt.type = type; filt.frequency.value = freq; filt.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain * volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt).connect(g).connect(ac.destination);
    src.start(t); src.stop(t + dur);
  }

  function playTone(ac, { f0, f1, type, dur, gain }) {
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(gain * volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t); osc.stop(t + dur);
  }

  // 8 distinct drum voices; pads beyond 8 cycle through them.
  const VOICES = [
    () => { const ac = ctx(); playTone(ac, { f0: 150, f1: 40, type: 'sine', dur: 0.28, gain: 1.0 }); },            // kick
    () => { const ac = ctx(); playNoise(ac, { freq: 1800, q: 0.8, type: 'bandpass', dur: 0.18, gain: 0.9 });       // snare
            playTone(ac, { f0: 220, f1: 140, type: 'triangle', dur: 0.1, gain: 0.5 }); },
    () => { const ac = ctx(); playNoise(ac, { freq: 8000, q: 1, type: 'highpass', dur: 0.05, gain: 0.5 }); },      // closed hat
    () => { const ac = ctx(); playTone(ac, { f0: 300, f1: 120, type: 'sine', dur: 0.25, gain: 0.9 }); },           // low tom
    () => { const ac = ctx(); playNoise(ac, { freq: 1200, q: 1.5, type: 'bandpass', dur: 0.12, gain: 0.8 }); },    // clap
    () => { const ac = ctx(); playNoise(ac, { freq: 6000, q: 0.7, type: 'highpass', dur: 0.4, gain: 0.45 }); },    // cymbal
    () => { const ac = ctx(); playTone(ac, { f0: 450, f1: 200, type: 'sine', dur: 0.2, gain: 0.85 }); },           // high tom
    () => { const ac = ctx(); playTone(ac, { f0: 80, f1: 30, type: 'sine', dur: 0.4, gain: 1.0 }); },              // sub kick
  ];

  const NAMES = ['Kick', 'Snare', 'Hat', 'Low Tom', 'Clap', 'Cymbal', 'High Tom', 'Sub Kick'];

  /* ---------- overlay construction ---------- */

  function visibleElements() {
    const out = [];
    const els = document.body ? document.body.getElementsByTagName('*') : [];
    for (const el of els) {
      if (out.length >= 200) break;
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24 || r.width > innerWidth * 0.9 || r.height > innerHeight * 0.9) continue;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      out.push(el);
    }
    return out;
  }

  function start(padCount, vol) {
    stop(); // clear any previous run
    volume = vol;

    const candidates = visibleElements();
    if (!candidates.length) return;

    overlay = document.createElement('div');
    overlay.id = 'pdk-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    document.documentElement.appendChild(overlay);

    // Evenly sample candidates so pads spread across the page.
    const step = Math.max(1, Math.floor(candidates.length / padCount));
    let n = 0;
    for (let i = 0; i < candidates.length && n < padCount; i += step, n++) {
      const el = candidates[i];
      const r = el.getBoundingClientRect();
      const pad = document.createElement('div');
      pad.className = 'pdk-pad';
      pad.dataset.voice = String(n % VOICES.length);
      pad.style.cssText =
        `position:absolute;left:${r.left + scrollX}px;top:${r.top + scrollY}px;` +
        `width:${r.width}px;height:${r.height}px;pointer-events:auto;cursor:pointer;` +
        `border:2px dashed ${ACCENT};border-radius:8px;` +
        `background:rgba(52,211,153,.10);box-shadow:0 0 0 9999px transparent;` +
        `display:flex;align-items:center;justify-content:center;` +
        `color:#fff;font:700 11px/1 sans-serif;text-shadow:0 1px 3px #000;` +
        `transition:background .08s, transform .08s;`;
      pad.textContent = NAMES[n % NAMES.length];
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        VOICES[Number(pad.dataset.voice)]();
        pad.style.background = 'rgba(52,211,153,.55)';
        pad.style.transform = 'scale(.96)';
        setTimeout(() => { pad.style.background = 'rgba(52,211,153,.10)'; pad.style.transform = ''; }, 110);
      }, { capture: true });
      overlay.appendChild(pad);
    }

    escHandler = (e) => { if (e.key === 'Escape') stop(); };
    window.addEventListener('keydown', escHandler);
  }

  function stop() {
    if (overlay) { overlay.remove(); overlay = null; }
    if (escHandler) { window.removeEventListener('keydown', escHandler); escHandler = null; }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'pdk-start') start(msg.pads || 8, msg.vol ?? 0.7);
    else if (msg.type === 'pdk-stop') stop();
  });
})();
