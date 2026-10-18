// Dark Mode Inverter Engine — popup logic.
// Toggle per site; enabling remembers the site and auto-applies on
// every visit via a dynamically registered content script. All on-device.

const STYLE_ID = "dmi-dark-style";
const $ = (id) => document.getElementById(id);
let host = null, tabId = null;

// Injected into the page: install the inversion stylesheet. Must be
// fully self-contained — executeScript serializes this function alone.
function applyDarkFull(cssText) {
  document.documentElement.classList.add("dmi-on");
  let el = document.getElementById("dmi-dark-style");
  if (!el) {
    el = document.createElement("style");
    el.id = "dmi-dark-style";
    (document.head || document.documentElement).appendChild(el);
  }
  el.textContent = cssText;
}

// Injected into the page: remove the inversion stylesheet.
function removeDarkFull() {
  document.documentElement.classList.remove("dmi-on");
  const el = document.getElementById("dmi-dark-style");
  if (el) el.remove();
}

// Build the inversion stylesheet. Images/video are re-inverted so
// they keep their natural colors under the global invert filter.
function buildCss(dim, contrast) {
  const b = (dim / 100).toFixed(2);
  const c = (contrast / 100).toFixed(2);
  return (
    `html.dmi-on { filter: invert(1) hue-rotate(180deg) brightness(${b}) contrast(${c}) !important; background: #0b0b0f !important; }\n` +
    `html.dmi-on img, html.dmi-on video, html.dmi-on picture, html.dmi-on svg, html.dmi-on canvas, html.dmi-on [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }`
  );
}

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("toggle").addEventListener("change", onToggle);
  $("dim").addEventListener("input", onSlider);
  $("contrast").addEventListener("input", onSlider);
  $("forgetAll").addEventListener("click", forgetAll);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;
  try {
    const u = new URL(tab.url);
    if (!/^https?:$/.test(u.protocol)) {
      $("hostLine").textContent = "Not available on this page";
      $("toggle").disabled = true;
      return;
    }
    host = u.hostname.replace(/^www\./, "");
    tabId = tab.id;
    $("hostLine").textContent = host;
  } catch (e) { return; }
  syncUi();
}

async function getSites() {
  const { sites = {} } = await chrome.storage.local.get("sites");
  return sites;
}

function currentSettings() {
  return { dim: parseInt($("dim").value, 10), contrast: parseInt($("contrast").value, 10) };
}

async function syncUi() {
  const sites = await getSites();
  const s = sites[host];
  $("toggle").checked = !!s;
  if (s) {
    $("dim").value = s.dim; $("contrast").value = s.contrast;
  }
  $("dimVal").textContent = $("dim").value + "%";
  $("conVal").textContent = $("contrast").value + "%";
  $("memNote").textContent = s
    ? "Remembered — dark mode applies automatically on every visit to this site."
    : "Enable to remember this site — dark mode applies automatically on every visit.";
}

async function applyNow() {
  const { dim, contrast } = currentSettings();
  const css = buildCss(dim, contrast);
  await chrome.scripting.executeScript({ target: { tabId }, func: applyDarkFull, args: [css] });
}

async function removeNow() {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: removeDarkFull });
  } catch (e) { /* tab may not allow scripting */ }
}

function scriptId(h) { return "dmi-" + h.replace(/[^a-z0-9-]/gi, "_"); }

async function registerAuto(h) {
  const id = scriptId(h);
  try { await chrome.scripting.unregisterContentScripts({ ids: [id] }); } catch (e) {}
  await chrome.scripting.registerContentScripts([{
    id,
    matches: [`https://${h}/*`, `http://${h}/*`],
    js: ["content.js"],
    runAt: "document_start",
  }]);
}

async function unregisterAuto(h) {
  try { await chrome.scripting.unregisterContentScripts({ ids: [scriptId(h)] }); } catch (e) {}
}

async function onToggle() {
  const sites = await getSites();
  if ($("toggle").checked) {
    sites[host] = currentSettings();
    await chrome.storage.local.set({ sites });
    await registerAuto(host);
    await applyNow();
  } else {
    delete sites[host];
    await chrome.storage.local.set({ sites });
    await unregisterAuto(host);
    await removeNow();
  }
  syncUi();
}

async function onSlider() {
  const sites = await getSites();
  if (!sites[host]) { syncUi(); return; }
  sites[host] = currentSettings();
  await chrome.storage.local.set({ sites });
  await applyNow();
  syncUi();
}

async function forgetAll() {
  const sites = await getSites();
  for (const h of Object.keys(sites)) await unregisterAuto(h);
  await chrome.storage.local.set({ sites: {} });
  await removeNow();
  syncUi();
}
