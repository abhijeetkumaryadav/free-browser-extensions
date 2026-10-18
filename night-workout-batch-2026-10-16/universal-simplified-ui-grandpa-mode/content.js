/* Grandpa Mode content script.
 * - Auto-applies the user's saved per-site settings on page load.
 * - Re-applies on demand when the popup re-injects this file (idempotent).
 * - All changes are a single <style> node + classes on <html>; removal restores the page exactly.
 * 100% local. Nothing is read from the page or transmitted anywhere.
 */
(() => {
  'use strict';

  const STYLE_ID = 'grandpa-mode-style';

  // Conservative list of layout elements to hide in "Simplify layout" mode.
  const CSS = `
    html.gm-text body { font-size: 125% !important; line-height: 1.9 !important; letter-spacing: .02em; }
    html.gm-contrast body { background: #fdfbf5 !important; color: #141414 !important; }
    html.gm-contrast body a { color: #0b4fd6 !important; }
    html.gm-contrast body a:visited { color: #6a1fb0 !important; }
    html.gm-simplify aside,
    html.gm-simplify [role="complementary"],
    html.gm-simplify .sidebar, html.gm-simplify [id*="sidebar"], html.gm-simplify [class*="sidebar"],
    html.gm-simplify .advertisement, html.gm-simplify [id*="advert"], html.gm-simplify [class*="advert"],
    html.gm-simplify .ads, html.gm-simplify [id^="ad-"], html.gm-simplify [class^="ad-"] { display: none !important; }
    html.gm-simplify body { max-width: 960px !important; margin-left: auto !important; margin-right: auto !important; }
    html.gm-targets a, html.gm-targets button,
    html.gm-targets input[type="button"], html.gm-targets input[type="submit"],
    html.gm-targets input[type="reset"] {
      min-height: 44px !important; min-width: 44px !important;
      padding: 12px 18px !important;
    }
  `;

  const CLASSES = ['gm-text', 'gm-contrast', 'gm-simplify', 'gm-targets'];

  function ensureStyle() {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      el.textContent = CSS;
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  }

  function removeAll() {
    document.documentElement.classList.remove(...CLASSES);
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  }

  // features: { text, contrast, simplify, targets } booleans
  function apply(features) {
    removeAll();
    const root = document.documentElement;
    ensureStyle();
    if (features.text) root.classList.add('gm-text');
    if (features.contrast) root.classList.add('gm-contrast');
    if (features.simplify) root.classList.add('gm-simplify');
    if (features.targets) root.classList.add('gm-targets');
  }

  // Listen for popup commands.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'gm-apply') apply(msg.features || {});
    if (msg && msg.type === 'gm-remove') removeAll();
  });

  // Auto-apply saved per-site settings on load.
  try {
    chrome.storage.local.get({ grandpaSites: {} }, ({ grandpaSites }) => {
      const saved = grandpaSites[location.hostname];
      if (saved && saved.enabled) apply(saved.features || {});
    });
  } catch (e) { /* storage unavailable — stay inert */ }
})();
