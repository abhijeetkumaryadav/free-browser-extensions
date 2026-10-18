/* Font Fingerprint Scrambler — popup logic.
 * 1. Probes which fonts are installed on this device via canvas
 *    measureText against fallback fonts (the same technique tracking
 *    scripts use). Runs locally; the list never leaves the browser.
 * 2. Lets the user standardize fonts per-site: a tiny common font stack
 *    injected as CSS, shrinking font-probe entropy. Stored per-origin,
 *    fully reversible. */

// Fonts worth probing: common system fonts plus distinctive ones that
// make a fingerprint unique when present.
const PROBE_FONTS = [
  "Arial", "Helvetica", "Verdana", "Tahoma", "Trebuchet MS",
  "Times New Roman", "Georgia", "Palatino", "Garamond", "Book Antiqua",
  "Courier New", "Lucida Console", "Monaco", "Menlo", "Consolas",
  "Comic Sans MS", "Impact", "Arial Black", "Arial Narrow",
  "Segoe UI", "Calibri", "Cambria", "Candara", "Constantia", "Corbel",
  "Roboto", "Noto Sans", "Open Sans", "Lato", "Montserrat", "Poppins",
  "Ubuntu", "Fira Code", "Fira Sans", "Source Sans Pro", "Inter",
  "Playfair Display", "Merriweather", "Oswald", "Raleway",
  "Wingdings", "Webdings", "Symbol", "MS Gothic", "SimSun",
  "Apple Chancery", "Brush Script MT", "Copperplate", "Papyrus",
  "San Francisco", "Helvetica Neue", "Avenir", "Gill Sans"
];

// The small "safe" stack applied when standardizing a site.
const SAFE_STACK = '"Segoe UI", Arial, "Helvetica Neue", Helvetica, sans-serif';
const SAFE_MONO = '"Courier New", Courier, monospace';

const $ = (id) => document.getElementById(id);
const enabledBox = $("enabled"), hostEl = $("host"), siteEl = $("site");
const fontsEl = $("fonts"), countEl = $("count"), statusEl = $("status");

let currentOrigin = null;
let currentTabId = null;

function setStatus(msg) { statusEl.textContent = msg || ""; }

/* ------------------------------------------------------------------ */
/* Font detection (canvas measurement, local only)                      */
/* ------------------------------------------------------------------ */

function detectFonts(fonts) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const test = "mmmmmmmmmmlli"; // wide glyph mix for good discrimination
  const size = "72px ";
  const fallbacks = ["monospace", "sans-serif", "serif"];
  const base = {};
  for (const fb of fallbacks) {
    ctx.font = size + fb;
    base[fb] = ctx.measureText(test).width;
  }
  const found = [];
  for (const f of fonts) {
    let differs = false;
    for (const fb of fallbacks) {
      ctx.font = size + `"${f}", ${fb}`;
      if (Math.abs(ctx.measureText(test).width - base[fb]) > 0.1) { differs = true; break; }
    }
    if (differs) found.push(f);
  }
  return found;
}

function renderFonts(found) {
  fontsEl.innerHTML = "";
  // Fonts considered "common enough" not to add entropy.
  const common = new Set(["Arial", "Helvetica", "Verdana", "Times New Roman", "Georgia", "Courier New", "Tahoma", "Segoe UI", "Roboto", "Noto Sans", "San Francisco", "Helvetica Neue"]);
  countEl.textContent = `· ${found.length} detected`;
  for (const f of found) {
    const li = document.createElement("li");
    li.textContent = f;
    if (common.has(f)) {
      li.classList.add("common");
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = "common";
      li.appendChild(tag);
    }
    fontsEl.appendChild(li);
  }
}

/* ------------------------------------------------------------------ */
/* Per-site standardization                                            */
/* ------------------------------------------------------------------ */

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function originOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

async function refreshSite() {
  const tab = await getActiveTab();
  if (!tab || !tab.url) {
    siteEl.textContent = "No active page";
    enabledBox.disabled = true;
    return;
  }
  currentTabId = tab.id;
  currentOrigin = originOf(tab.url);
  if (!currentOrigin) {
    siteEl.textContent = "Cannot standardize this page (browser-internal)";
    hostEl.textContent = "—";
    enabledBox.disabled = true;
    return;
  }
  const u = new URL(currentOrigin);
  siteEl.textContent = "Current site";
  hostEl.textContent = u.host;
  const { sites = {} } = await chrome.storage.local.get("sites");
  enabledBox.checked = !!sites[currentOrigin];
  enabledBox.disabled = false;
}

async function applyToTab(tabId, enable) {
  if (enable) {
    await chrome.scripting.insertCSS({
      target: { tabId },
      css: `* { font-family: ${SAFE_STACK} !important; }
            code, kbd, pre, samp, tt, .mono, [class*="mono"] { font-family: ${SAFE_MONO} !important; }`
    });
  } else {
    await chrome.scripting.removeCSS({
      target: { tabId },
      css: `* { font-family: ${SAFE_STACK} !important; }
            code, kbd, pre, samp, tt, .mono, [class*="mono"] { font-family: ${SAFE_MONO} !important; }`
    });
  }
}

enabledBox.addEventListener("change", async () => {
  if (!currentOrigin || currentTabId == null) return;
  const on = enabledBox.checked;
  const { sites = {} } = await chrome.storage.local.get("sites");
  if (on) sites[currentOrigin] = true;
  else delete sites[currentOrigin];
  await chrome.storage.local.set({ sites });
  try {
    await applyToTab(currentTabId, on);
    setStatus(on ? "Fonts standardized on this site." : "Original fonts restored.");
  } catch (e) {
    setStatus("Could not restyle this page (restricted page).");
  }
});

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

(async function init() {
  setStatus("Probing fonts…");
  // Probe off the main thread timing; canvas measurement is synchronous and fast.
  const found = detectFonts(PROBE_FONTS);
  renderFonts(found);
  setStatus(found.length
    ? "Each detected font is one more bit trackers can probe for."
    : "No probed fonts detected.");
  await refreshSite();
})();
