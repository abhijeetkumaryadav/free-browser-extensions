// Content script: warm-tint overlay for the current tab.
// Boot-once guard: safe to inject multiple times without stacking overlays.
(() => {
  "use strict";

  const OVERLAY_ID = "__circadianWarmTint";
  const MAX_ALPHA = 0.38; // max overlay opacity at full strength

  if (window.__circadianTintBooted) {
    return;
  }
  window.__circadianTintBooted = true;

  /** Circadian factor: 0.3 by day, ramps to 1.0 after sunset, back down by morning. */
  function circadianFactor(date = new Date()) {
    const h = date.getHours() + date.getMinutes() / 60;
    if (h >= 21 || h < 5) return 1.0;
    if (h >= 18 && h < 21) return 0.3 + ((h - 18) / 3) * 0.7;
    if (h >= 5 && h < 9) return 1.0 - ((h - 5) / 4) * 0.7;
    return 0.3;
  }

  /** Get or create the overlay element. */
  function getOverlay() {
    let el = document.getElementById(OVERLAY_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = OVERLAY_ID;
      el.setAttribute("aria-hidden", "true");
      el.style.cssText = [
        "position:fixed",
        "inset:0",
        "width:100vw",
        "height:100vh",
        "pointer-events:none",
        "z-index:2147483647",
        "mix-blend-mode:multiply",
        "transition:background-color .4s ease, opacity .4s ease",
      ].join(";");
      (document.documentElement || document.body).appendChild(el);
    }
    return el;
  }

  /** Apply settings: { enabled, strength (0..100), circadian (bool) }. */
  function applySettings(settings) {
    const el = getOverlay();
    if (!settings || !settings.enabled) {
      el.style.opacity = "0";
      return;
    }
    const base = Math.max(0, Math.min(100, settings.strength ?? 60)) / 100;
    const factor = settings.circadian ? circadianFactor() : 1.0;
    const alpha = base * factor * MAX_ALPHA;
    // Warm amber tint over the page.
    el.style.backgroundColor = `rgba(255, 178, 92, ${alpha.toFixed(3)})`;
    el.style.opacity = "1";
  }

  // Re-evaluate circadian strength every 5 minutes while the page is open.
  setInterval(() => {
    chrome.storage.local.get(["csh_settings"], (res) => {
      if (res.csh_settings && res.csh_settings.enabled && res.csh_settings.circadian) {
        applySettings(res.csh_settings);
      }
    });
  }, 5 * 60 * 1000);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "csh_apply") {
      applySettings(msg.settings);
    }
    if (msg && msg.type === "csh_remove") {
      const el = document.getElementById(OVERLAY_ID);
      if (el) el.remove();
    }
  });

  // Apply persisted settings on injection so enabling persists across reloads.
  chrome.storage.local.get(["csh_settings"], (res) => {
    if (res.csh_settings) applySettings(res.csh_settings);
  });
})();
