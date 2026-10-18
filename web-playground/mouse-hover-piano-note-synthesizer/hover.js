/* HoverPiano content script — injected on demand via chrome.scripting.
 * While armed, hovering elements plays a Web-Audio-synthesized piano-ish note.
 * Pitch follows the element's vertical position (top of viewport = high note).
 * Idempotent: re-injection just re-arms the existing instance. */
(() => {
  // --- Scales: semitone offsets from C, across ~2 octaves ---
  const SCALES = {
    penta: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36],
    major: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24],
    chroma: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  };
  const BASE_FREQ = 261.63; // C4
  const THROTTLE_MS = 80;
  const FLASH_COLOR = 'rgba(139, 92, 246, 0.85)';

  const state = {
    enabled: false,
    volume: 0.5,
    scale: 'penta',
    ctx: null,
    lastPlay: 0,
    flashTimers: new WeakMap(),
  };

  function ensureCtx() {
    if (!state.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      state.ctx = new AC();
    }
    if (state.ctx.state === 'suspended') state.ctx.resume().catch(() => {});
    return state.ctx;
  }

  // Piano-ish voice: triangle + octave sine through a lowpass, quick ADSR-ish envelope.
  function playNote(freq) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(Math.max(0.001, state.volume * 0.5), t + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3400;
    filter.Q.value = 0.4;

    const osc1 = ctx.createOscillator(); // body
    osc1.type = 'triangle';
    osc1.frequency.value = freq;

    const osc2 = ctx.createOscillator(); // octave shimmer
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    const shimmer = ctx.createGain();
    shimmer.gain.value = 0.22;

    osc1.connect(filter);
    osc2.connect(shimmer);
    shimmer.connect(filter);
    filter.connect(amp);
    amp.connect(ctx.destination);

    osc1.start(t); osc2.start(t);
    osc1.stop(t + 1); osc2.stop(t + 1);
  }

  function freqForElement(el) {
    const rect = el.getBoundingClientRect();
    if (rect.height === 0 && rect.width === 0) return null;
    const cy = rect.top + rect.height / 2;
    const frac = Math.min(1, Math.max(0, cy / Math.max(1, window.innerHeight)));
    const scale = SCALES[state.scale] || SCALES.penta;
    // Top of viewport -> highest note.
    const idx = Math.round((1 - frac) * (scale.length - 1));
    const semis = scale[idx];
    return BASE_FREQ * Math.pow(2, semis / 12);
  }

  // Brief, non-destructive outline flash so the user sees which element sang.
  function flash(el) {
    if (!(el instanceof Element)) return;
    const prev = state.flashTimers.get(el);
    if (prev) clearTimeout(prev);
    const oldOutline = el.style.outline;
    const oldOffset = el.style.outlineOffset;
    el.style.outline = `2px solid ${FLASH_COLOR}`;
    el.style.outlineOffset = '1px';
    state.flashTimers.set(el, setTimeout(() => {
      el.style.outline = oldOutline;
      el.style.outlineOffset = oldOffset;
    }, 140));
  }

  function onMouseOver(e) {
    if (!state.enabled) return;
    const now = performance.now();
    if (now - state.lastPlay < THROTTLE_MS) return;
    state.lastPlay = now;
    const el = e.target instanceof Element ? e.target : null;
    if (!el) return;
    const freq = freqForElement(el);
    if (freq == null) return;
    playNote(freq);
    flash(el);
  }

  if (!window.__hoverPianoInjected) {
    window.__hoverPianoInjected = true;
    document.addEventListener('mouseover', onMouseOver, { passive: true });
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'hp-enable') {
        state.enabled = true;
        if (typeof msg.volume === 'number') state.volume = msg.volume;
        if (msg.scale && SCALES[msg.scale]) state.scale = msg.scale;
        ensureCtx();
      } else if (msg.type === 'hp-disable') {
        state.enabled = false;
      } else if (msg.type === 'hp-settings') {
        if (typeof msg.volume === 'number') state.volume = msg.volume;
        if (msg.scale && SCALES[msg.scale]) state.scale = msg.scale;
      }
    });
  } else {
    // Re-injected: arm with the latest settings via the message listener already present.
  }
})();
