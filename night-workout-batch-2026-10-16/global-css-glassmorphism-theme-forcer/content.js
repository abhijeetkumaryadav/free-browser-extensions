/* GlassForce content script — injects/removes a frosted-glass stylesheet.
   Pure CSS, fully reversible: removal deletes the <style> node. */
const STYLE_ID = 'glassforce-theme';

/* Preset definitions: blur px, panel alpha, border alpha */
const PRESETS = {
  soft:    { blur: 8,  alpha: 0.45, border: 0.12 },
  frosted: { blur: 14, alpha: 0.62, border: 0.18 },
  deep:    { blur: 22, alpha: 0.80, border: 0.24 }
};

function buildCSS(opts) {
  const { blur, opacity, preset } = opts;
  const p = PRESETS[preset] || PRESETS.frosted;
  const alpha = (opacity / 100 * p.alpha / 0.62).toFixed(2); // blend slider with preset
  const b = p.border;
  return `
  .glassforce-scope article, .glassforce-scope main, .glassforce-scope section,
  .glassforce-scope aside, .glassforce-scope nav, .glassforce-scope header,
  .glassforce-scope footer, .glassforce-scope .card, .glassforce-scope .panel,
  .glassforce-scope [role="dialog"], .glassforce-scope [role="main"] {
    background: rgba(20, 20, 26, ${alpha}) !important;
    backdrop-filter: blur(${blur}px) saturate(140%) !important;
    -webkit-backdrop-filter: blur(${blur}px) saturate(140%) !important;
    border: 1px solid rgba(255, 255, 255, ${b}) !important;
    border-radius: 14px !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25) !important;
  }
  .glassforce-scope { background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 50%, #1e293b 100%) !important; }
  `;
}

function applyTheme(opts) {
  removeTheme();
  document.documentElement.classList.add('glassforce-scope');
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = buildCSS(opts);
  document.head.appendChild(style);
}

function removeTheme() {
  document.getElementById(STYLE_ID)?.remove();
  document.documentElement.classList.remove('glassforce-scope');
}

/* Messages from popup */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'glassforce:apply') { applyTheme(msg.opts); sendResponse({ ok: true }); }
  if (msg.type === 'glassforce:remove') { removeTheme(); sendResponse({ ok: true }); }
  return false;
});
