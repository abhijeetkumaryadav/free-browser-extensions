/* Readability Font Scaler — content script.
   Applies/removes a reversible reading-comfort style layer on the page.
   Stores nothing here; settings come from chrome.storage (per-site). */

const STYLE_ID = 'readability-font-scaler-style';

const FONT_STACKS = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: '-apple-system, "Segoe UI", Inter, Roboto, sans-serif',
  system: 'system-ui, -apple-system, sans-serif'
};

/* Build the override stylesheet for given settings. */
function buildCss({ fontSize, lineHeight, fontFamily }) {
  const stack = FONT_STACKS[fontFamily] || FONT_STACKS.sans;
  return `
    html.readability-scaled body,
    html.readability-scaled p, html.readability-scaled li,
    html.readability-scaled span, html.readability-scaled a,
    html.readability-scaled h1, html.readability-scaled h2,
    html.readability-scaled h3, html.readability-scaled h4,
    html.readability-scaled td, html.readability-scaled th {
      font-size: ${fontSize}px !important;
      line-height: ${lineHeight} !important;
      font-family: ${stack} !important;
    }
  `;
}

/* Apply settings: inject <style>, tag <html>. */
function apply(settings) {
  remove(); // idempotent — never stack duplicates
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = buildCss(settings);
  document.head.appendChild(style);
  document.documentElement.classList.add('readability-scaled');
}

/* Remove everything — restores the original page exactly. */
function remove() {
  const old = document.getElementById(STYLE_ID);
  if (old) old.remove();
  document.documentElement.classList.remove('readability-scaled');
}

/* On load, ask storage for this site's saved settings and apply if enabled. */
(async function init() {
  try {
    const host = location.hostname;
    const data = await chrome.storage.local.get(['sites', 'global']);
    const sites = data.sites || {};
    const site = sites[host];
    if (site && site.enabled) {
      apply(site);
    } else if (data.global && data.global.enabled) {
      apply(data.global); // global fallback when no per-site entry
    }
  } catch (e) {
    // storage unavailable (rare) — fail silently, page untouched
  }
})();

/* Popup talks to us directly for live preview while open. */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'rfs-apply') {
    apply(msg.settings);
    sendResponse({ ok: true });
  } else if (msg.type === 'rfs-remove') {
    remove();
    sendResponse({ ok: true });
  }
  return true;
});
