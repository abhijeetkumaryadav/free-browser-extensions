// Closed Caption Font Styler — popup logic.
//
// Settings model in chrome.storage.local under "ccStyler":
//   { masterEnabled: bool, global: {...}, sites: { origin: {...} } }
// The popup edits the site override if one exists for the current origin,
// otherwise the global settings.

const DEFAULTS = {
  fontSize: 24,
  fontFamily: "system-ui, sans-serif",
  color: "#ffffff",
  bgColor: "#000000",
  bgOpacity: 0.8,
  edge: "outline"
};

const els = {
  masterToggle: document.getElementById("masterToggle"),
  contextBar: document.getElementById("contextBar"),
  contextLabel: document.getElementById("contextLabel"),
  resetSiteBtn: document.getElementById("resetSiteBtn"),
  previewText: document.getElementById("previewText"),
  fontSize: document.getElementById("fontSize"),
  fontSizeValue: document.getElementById("fontSizeValue"),
  fontFamily: document.getElementById("fontFamily"),
  textColor: document.getElementById("textColor"),
  bgColor: document.getElementById("bgColor"),
  bgOpacity: document.getElementById("bgOpacity"),
  bgOpacityValue: document.getElementById("bgOpacityValue"),
  edgeStyle: document.getElementById("edgeStyle"),
  saveSiteBtn: document.getElementById("saveSiteBtn"),
  copyCssBtn: document.getElementById("copyCssBtn"),
  resetAllBtn: document.getElementById("resetAllBtn")
};

let cfg = null;          // full stored config
let origin = null;       // current tab origin (null on restricted pages)
let tabId = null;
let usingOverride = false;

// ---------------------------------------------------------------------------
// CSS helpers — must mirror content.js exactly.
// ---------------------------------------------------------------------------
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${alpha})`;
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
// Storage
// ---------------------------------------------------------------------------
async function loadCfg() {
  const { ccStyler } = await chrome.storage.local.get("ccStyler");
  cfg = ccStyler || { masterEnabled: true, global: { ...DEFAULTS }, sites: {} };
  cfg.global = { ...DEFAULTS, ...(cfg.global || {}) };
  cfg.sites = cfg.sites || {};
}

async function saveCfg() {
  await chrome.storage.local.set({ ccStyler: cfg });
}

// Effective settings for the current origin.
function effectiveSettings() {
  if (!cfg.masterEnabled) return null;
  return (origin && cfg.sites[origin]) || cfg.global;
}

// The settings object currently being edited.
function editingTarget() {
  if (origin && cfg.sites[origin]) return cfg.sites[origin];
  return cfg.global;
}

// ---------------------------------------------------------------------------
// Messaging the tab
// ---------------------------------------------------------------------------
async function pushToTab() {
  if (tabId === null) return;
  const settings = effectiveSettings();
  try {
    if (settings) {
      await chrome.tabs.sendMessage(tabId, { type: "cc-apply", settings });
    } else {
      await chrome.tabs.sendMessage(tabId, { type: "cc-clear" });
    }
  } catch (_e) {
    // Tab has no content script (restricted page, or not yet injected). The
    // content script auto-applies on load where it can run, so this is fine.
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function render() {
  const s = editingTarget();
  usingOverride = !!(origin && cfg.sites[origin]);

  els.masterToggle.checked = cfg.masterEnabled;

  els.contextBar.classList.toggle("override", usingOverride);
  els.contextLabel.textContent = usingOverride
    ? `Site override · ${origin}`
    : (origin ? `Global settings · ${origin}` : "Global settings");
  els.resetSiteBtn.hidden = !usingOverride;

  els.fontSize.value = s.fontSize;
  els.fontSizeValue.textContent = `${s.fontSize}px`;
  els.fontFamily.value = s.fontFamily;
  els.textColor.value = s.color;
  els.bgColor.value = s.bgColor;
  els.bgOpacity.value = Math.round(s.bgOpacity * 100);
  els.bgOpacityValue.textContent = `${Math.round(s.bgOpacity * 100)}%`;
  els.edgeStyle.value = s.edge;

  // Live preview mirrors the ::cue rules as inline styles.
  els.previewText.style.color = s.color;
  els.previewText.style.backgroundColor = hexToRgba(s.bgColor, s.bgOpacity);
  els.previewText.style.fontSize = `${s.fontSize}px`;
  els.previewText.style.fontFamily = s.fontFamily;
  els.previewText.style.textShadow = edgeShadow(s.edge);
}

async function onEdit(mutator) {
  mutator(editingTarget());
  await saveCfg();
  render();
  await pushToTab();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
els.masterToggle.addEventListener("change", async () => {
  cfg.masterEnabled = els.masterToggle.checked;
  await saveCfg();
  await pushToTab();
});

els.fontSize.addEventListener("input", () =>
  onEdit((s) => { s.fontSize = parseInt(els.fontSize.value, 10); }));
els.fontFamily.addEventListener("change", () =>
  onEdit((s) => { s.fontFamily = els.fontFamily.value; }));
els.textColor.addEventListener("input", () =>
  onEdit((s) => { s.color = els.textColor.value; }));
els.bgColor.addEventListener("input", () =>
  onEdit((s) => { s.bgColor = els.bgColor.value; }));
els.bgOpacity.addEventListener("input", () =>
  onEdit((s) => { s.bgOpacity = parseInt(els.bgOpacity.value, 10) / 100; }));
els.edgeStyle.addEventListener("change", () =>
  onEdit((s) => { s.edge = els.edgeStyle.value; }));

els.saveSiteBtn.addEventListener("click", async () => {
  if (!origin) return;
  cfg.sites[origin] = { ...editingTarget() };
  await saveCfg();
  render();
  await pushToTab();
});

els.resetSiteBtn.addEventListener("click", async () => {
  if (!origin) return;
  delete cfg.sites[origin];
  await saveCfg();
  render();
  await pushToTab();
});

els.copyCssBtn.addEventListener("click", async () => {
  const css = buildCSS(editingTarget());
  try {
    await navigator.clipboard.writeText(css);
    els.copyCssBtn.textContent = "Copied!";
  } catch (_e) {
    els.copyCssBtn.textContent = "Copy failed";
  }
  setTimeout(() => { els.copyCssBtn.textContent = "Copy CSS"; }, 1400);
});

els.resetAllBtn.addEventListener("click", async () => {
  cfg = { masterEnabled: true, global: { ...DEFAULTS }, sites: {} };
  await saveCfg();
  render();
  await pushToTab();
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
(async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      tabId = tab.id;
      if (tab.url && (tab.url.startsWith("http://") || tab.url.startsWith("https://"))) {
        origin = new URL(tab.url).origin;
      }
    }
  } catch (_e) { /* activeTab unavailable — global editing still works */ }

  await loadCfg();
  render();
})();
