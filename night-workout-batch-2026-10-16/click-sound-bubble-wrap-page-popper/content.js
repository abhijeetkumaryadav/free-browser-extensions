/* Bubble Wrap Popper — content script.
 * User-triggered overlay only: a fixed full-viewport grid of poppable bubbles.
 * Click/press pops a bubble with a Web Audio "pop" (synthesized, no audio files).
 * Esc or the popup's Remove button deletes the overlay completely. Page untouched. */
(function () {
  "use strict";

  if (window.__bubbleWrapPopperLoaded) {
    // Re-arm with new settings on an existing overlay.
    window.__bubbleWrapPopperRebuild && window.__bubbleWrapPopperRebuild();
    return;
  }
  window.__bubbleWrapPopperLoaded = true;

  const OVERLAY_ID = "__bubble_wrap_popper_overlay__";
  let audioCtx = null;
  let soundOn = true;
  let bubbleSize = 56;

  /** Lazily create the AudioContext (needs a user gesture — pops are gestures). */
  function ctx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  /** Synthesize a short bubble "pop": quick noise burst + pitch blip. */
  function playPop() {
    if (!soundOn) return;
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime;
    // Noise burst through a bandpass = the "pop" snap.
    const dur = 0.08;
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900 + Math.random() * 700;
    bp.Q.value = 1.2;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp); bp.connect(gain); gain.connect(ac.destination);
    src.start(t);
  }

  function removeOverlay() {
    const old = document.getElementById(OVERLAY_ID);
    if (old) old.remove();
    document.removeEventListener("keydown", onKey, true);
  }

  function onKey(e) {
    if (e.key === "Escape") removeOverlay();
  }

  function build() {
    removeOverlay();
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    const o = overlay.style;
    o.position = "fixed"; o.inset = "0"; o.zIndex = "2147483647";
    o.display = "flex"; o.flexWrap = "wrap"; o.alignContent = "center"; o.justifyContent = "center";
    o.gap = "6px"; o.padding = "24px"; o.overflow = "hidden";
    o.background = "rgba(10,10,14,0.55)"; o.backdropFilter = "blur(2px)";
    o.cursor = "pointer";

    const cols = Math.max(1, Math.floor((window.innerWidth - 48) / (bubbleSize + 6)));
    const rows = Math.max(1, Math.floor((window.innerHeight - 48) / (bubbleSize + 6)));
    const total = Math.min(cols * rows, 400);

    for (let i = 0; i < total; i++) {
      const b = document.createElement("div");
      const bs = b.style;
      bs.width = bs.height = bubbleSize + "px";
      bs.borderRadius = "50%";
      bs.border = "2px solid rgba(74,222,128,0.75)";
      bs.background = "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), rgba(74,222,128,0.12))";
      bs.boxSizing = "border-box";
      bs.transition = "transform 0.08s";
      bs.flex = "0 0 auto";
      b.addEventListener("pointerdown", (ev) => {
        ev.stopPropagation();
        playPop();
        bs.transform = "scale(0.6)";
        bs.background = "rgba(74,222,128,0.45)";
        bs.borderColor = "transparent";
        setTimeout(() => { b.remove(); bumpCount(); }, 90);
      });
      overlay.appendChild(b);
    }

    const hint = document.createElement("div");
    hint.textContent = "Click bubbles to pop · Esc to remove";
    const hs = hint.style;
    hs.position = "absolute"; hs.bottom = "14px"; hs.left = "50%"; hs.transform = "translateX(-50%)";
    hs.color = "#a7a7b3"; hs.font = "12px system-ui"; hs.pointerEvents = "none";
    overlay.appendChild(hint);

    overlay.addEventListener("pointerdown", (ev) => {
      if (ev.target === overlay) removeOverlay();
    });
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onKey, true);
  }

  function bumpCount() {
    chrome.storage.local.get(["bw_pops"], (res) => {
      const n = (res.bw_pops || 0) + 1;
      chrome.storage.local.set({ bw_pops: n });
    });
  }

  window.__bubbleWrapPopperRebuild = function () {
    chrome.storage.local.get(["bw_sound", "bw_size"], (res) => {
      soundOn = res.bw_sound !== false;
      bubbleSize = res.bw_size || 56;
      build();
    });
  };

  // Initial arm: read settings, then build.
  window.__bubbleWrapPopperRebuild();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "BW_REMOVE") removeOverlay();
  });
})();
