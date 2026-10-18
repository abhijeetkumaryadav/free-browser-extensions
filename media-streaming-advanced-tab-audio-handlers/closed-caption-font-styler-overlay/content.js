// Closed Caption Font Styler — content script.
//
// Auto-applies the user's ::cue overrides on every http(s) page (when the
// master switch is on), and listens for live updates from the popup.
// Pure CSS injection — fully reversible, nothing else on the page is touched.

const STYLE_ID = "cc-font-styler-overlay";

// ---------------------------------------------------------------------------
// CSS builder — mirrors the popup preview math exactly.
// settings: { fontSize, fontFamily, color, bgColor, bgOpacity (0..1), edge }
// ---------------------------------------------------------------------------
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function edgeShadow(edge) {
  switch (edge) {
    case "outline":
      return "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000";
    case "drop":
      return "2px 2px 4px rgba(0, 0, 0, 0.85)";
    case "raised":
      return "0 2px 2px rgba(0, 0, 0, 0.6), 0 -1px 0 rgba(255, 255, 255, 0.25)";
    case "depressed":
      return "0 -1px 1px rgba(0, 0, 0, 0.8)";
    case "none":
    default:
      return "none";
  }
}

function buildCSS(s) {
  return [
    "video::cue {",
    `  color: ${s.color};`,
    `  background-color: ${hexToRgba(s.bgColor, s.bgOpacity)};`,
    `  font-size: ${s.fontSize}px;`,
    `  font-family: ${s.fontFamily};`,
    `  text-shadow: ${edgeShadow(s.edge)};`,
    "}"
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Apply / clear
// ---------------------------------------------------------------------------
function applySettings(settings) {
  clearSettings();
  if (!settings) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = buildCSS(settings);
  (document.head || document.documentElement).appendChild(style);
}

function clearSettings() {
  const old = document.getElementById(STYLE_ID);
  if (old) old.remove();
}

// ---------------------------------------------------------------------------
// Storage -> effective settings for this origin
// ---------------------------------------------------------------------------
async function effectiveSettings() {
  const { ccStyler } = await chrome.storage.local.get("ccStyler");
  const cfg = ccStyler || {};
  if (!cfg.masterEnabled) return null;
  const sites = cfg.sites || {};
  return sites[location.origin] || cfg.global || null;
}

async function refresh() {
  applySettings(await effectiveSettings());
}

// ---------------------------------------------------------------------------
// Live updates from the popup
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "cc-apply") applySettings(msg.settings);
  else if (msg.type === "cc-clear") clearSettings();
  else if (msg.type === "cc-refresh") refresh();
  return false;
});

// Re-apply on history-driven navigations (SPAs) that don't reload the page.
let lastHref = location.href;
new MutationObserver(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    refresh();
  }
}).observe(document.documentElement, { childList: true, subtree: true });

refresh();
