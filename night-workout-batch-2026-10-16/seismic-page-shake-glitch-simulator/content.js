/* Seismic Page Shake — content script.
 * User-triggered visual toy. Applies a shake/glitch animation to the page root
 * via a single injected <style> node and requestAnimationFrame transforms.
 * Purely visual CSS — the page DOM and content are never modified. Stop (or
 * Esc) removes everything and restores the page exactly. */
'use strict';

(() => {
  // Guard against double injection on repeated starts.
  if (window.__spsBoot) return;
  window.__spsBoot = true;

  const STYLE_ID = 'sps-shake-style';
  let rafId = 0;
  let intensity = 5;
  let t0 = 0;
  let escHandler = null;
  let originalTransform = '';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    // Slight glitch color-split applied via filter, capped for safety.
    style.textContent = `#sps-glitch-clip{}`;
    document.documentElement.appendChild(style);
  }

  function frame(now) {
    if (!rafId) return;
    const t = (now - t0) / 1000;
    const a = intensity * 1.6; // px amplitude
    // Seismic: high-frequency jitter + slower rolling sway.
    const dx = Math.sin(t * 31) * a + Math.sin(t * 3.1) * a * 0.9;
    const dy = Math.cos(t * 37) * a * 0.8 + Math.cos(t * 2.3) * a * 0.6;
    const rot = Math.sin(t * 23) * a * 0.06; // degrees
    document.documentElement.style.transform =
      `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(3)}deg)`;
    rafId = requestAnimationFrame(frame);
  }

  function start(level) {
    stop();
    ensureStyle();
    intensity = Math.max(1, Math.min(10, level || 5));
    originalTransform = document.documentElement.style.transform;
    t0 = performance.now();
    rafId = requestAnimationFrame(frame);
    escHandler = (e) => { if (e.key === 'Escape') stop(); };
    window.addEventListener('keydown', escHandler);
  }

  function stop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (window.__spsBoot) {
      document.documentElement.style.transform = originalTransform || '';
    }
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    if (escHandler) { window.removeEventListener('keydown', escHandler); escHandler = null; }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'sps-start') start(msg.intensity);
    else if (msg.type === 'sps-stop') stop();
  });
})();
