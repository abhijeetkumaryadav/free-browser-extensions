/**
 * Motion Calm — page-side animation/flash reduction engine.
 * Injected only when the user clicks "Apply to this page" (activeTab + scripting).
 * Applies a prefers-reduced-motion-style CSS override plus optional media dimming.
 * One style element is added/removed — the page is never otherwise touched.
 */
(() => {
  if (window.__motionCalmEngine) return; // boot-once guard
  window.__motionCalmEngine = true;

  const STYLE_ID = '__motion-calm-style__';

  // Neutralize CSS animations/transitions and smooth scrolling site-wide.
  const CSS_BASE = `
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-delay: 0s !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      transition-delay: 0s !important;
      scroll-behavior: auto !important;
    }`;

  // Dim media elements to soften bright flashing content.
  const CSS_DIM = `
    img, video, canvas, svg, iframe, embed, object {
      filter: brightness(0.72) saturate(0.85) !important;
    }`;

  function remove() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  }

  function apply(mode) {
    remove();
    if (mode === 'off') return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS_BASE + (mode === 'strict' ? CSS_DIM : '');
    (document.head || document.documentElement).appendChild(s);
  }

  function active() {
    return !!document.getElementById(STYLE_ID);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      if (msg.type === 'MOTION_APPLY') {
        apply(msg.mode === 'strict' ? 'strict' : 'freeze');
        sendResponse({ ok: true, active: active(), mode: msg.mode });
      } else if (msg.type === 'MOTION_REMOVE') {
        remove();
        sendResponse({ ok: true, active: false });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
    return true;
  });
})();
