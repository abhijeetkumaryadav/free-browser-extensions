// content.js — per-tab Web Audio equalizer.
//
// Strategy: route every <audio>/<video> element through a chain of 5
// BiquadFilterNodes plus a master gain. Messages from the popup:
//   {type:'get-state'}              -> {bands, enabled, preset}
//   {type:'apply', bands:[..], enabled, preset} -> apply & persist
//   {type:'ping'}                   -> {alive:true}
//
// Honest limits: only audio that passes through page media elements can be
// processed; some DRM/protected streams bypass it. One AudioContext per tab;
// elements added later are hooked via MutationObserver.

(function () {
  'use strict';

  // Five fixed band centre frequencies (Hz).
  const BAND_FREQS = [60, 230, 910, 3600, 14000];
  const BAND_TYPES = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];

  const DEFAULT_STATE = { enabled: true, preset: 'flat', bands: [0, 0, 0, 0, 0] };

  let ctx = null;          // AudioContext
  let filters = [];        // BiquadFilterNode chain
  let masterGain = null;
  let sources = new Map(); // media element -> MediaElementSourceNode
  let state = { ...DEFAULT_STATE };

  // ---- Graph setup -------------------------------------------------------

  /** Build (once) the filter chain shared by all media elements. */
  function ensureGraph() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    filters = BAND_FREQS.map((freq, i) => {
      const f = ctx.createBiquadFilter();
      f.type = BAND_TYPES[i];
      f.frequency.value = freq;
      f.Q.value = 1.0;
      return f;
    });
    masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    // Chain: source -> f0 -> f1 -> ... -> f4 -> gain -> destination
    for (let i = 0; i < filters.length - 1; i++) {
      filters[i].connect(filters[i + 1]);
    }
    filters[filters.length - 1].connect(masterGain);
    masterGain.connect(ctx.destination);
  }

  /** Route one media element through the EQ chain (idempotent). */
  function hookElement(el) {
    if (!el || sources.has(el)) return;
    ensureGraph();
    if (!ctx) return;
    try {
      const src = ctx.createMediaElementSource(el);
      if (state.enabled) {
        src.connect(filters[0]);
      } else {
        src.connect(ctx.destination); // bypass path
      }
      sources.set(el, src);
      applyBands(); // make sure fresh elements get current gains
    } catch (e) {
      // An element can only have one MediaElementSource; if the page already
      // claimed it (or it is a protected stream), skip it.
    }
  }

  /** (Re)route every known source through EQ or bypass. */
  function applyEnabled() {
    if (!ctx) return;
    sources.forEach((src, el) => {
      try {
        src.disconnect();
        if (state.enabled) {
          src.connect(filters[0]);
        } else {
          src.connect(ctx.destination);
        }
      } catch (e) { /* ignore */ }
    });
  }

  /** Push band gains to the filters. */
  function applyBands() {
    if (!ctx) return;
    state.bands.forEach((db, i) => {
      filters[i].gain.setTargetAtTime(db, ctx.currentTime, 0.02);
    });
  }

  function hookAll() {
    document.querySelectorAll('audio, video').forEach(hookElement);
  }

  // ---- State -------------------------------------------------------------

  function getHost() {
    try { return location.hostname || 'local'; } catch (e) { return 'local'; }
  }

  async function loadState() {
    try {
      const store = await chrome.storage.local.get('eqSites');
      const sites = store.eqSites || {};
      const saved = sites[getHost()];
      if (saved && Array.isArray(saved.bands) && saved.bands.length === 5) {
        state = { enabled: saved.enabled !== false, preset: saved.preset || 'custom', bands: saved.bands.slice() };
      }
    } catch (e) { /* storage unavailable -> defaults */ }
  }

  async function saveState() {
    try {
      const store = await chrome.storage.local.get('eqSites');
      const sites = store.eqSites || {};
      sites[getHost()] = { ...state };
      await chrome.storage.local.set({ eqSites: sites });
    } catch (e) { /* ignore */ }
  }

  // ---- Wiring ------------------------------------------------------------

  function observe() {
    hookAll();
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLMediaElement) {
            hookElement(node);
          } else if (node && node.querySelectorAll) {
            node.querySelectorAll('audio, video').forEach(hookElement);
          }
        }
      }
    });
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.action !== 'eq') return false;
    if (msg.type === 'ping') {
      sendResponse({ alive: true });
      return false;
    }
    (async () => {
      if (msg.type === 'get-state') {
        await loadState();
        ensureGraph();
        hookAll();
        sendResponse({ state });
      } else if (msg.type === 'apply') {
        if (Array.isArray(msg.bands) && msg.bands.length === 5) state.bands = msg.bands.slice();
        if (typeof msg.enabled === 'boolean') state.enabled = msg.enabled;
        if (typeof msg.preset === 'string') state.preset = msg.preset;
        ensureGraph();
        if (ctx && ctx.state === 'suspended') {
          try { await ctx.resume(); } catch (e) { /* autoplay policy */ }
        }
        applyBands();
        applyEnabled();
        hookAll();
        await saveState();
        sendResponse({ ok: true, state });
      }
    })();
    return true; // async response
  });

  // Load saved settings eagerly so a returning site sounds right away.
  loadState().then(() => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', observe);
    } else {
      observe();
    }
  });
})();
