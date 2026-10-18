/* Query Privacy Scrubber — popup: master toggle, stats, editable param list,
   URL-clean preview tester. Talks to the service worker via runtime messages. */
"use strict";

const DEFAULT_PARAMS = [
  "utm_*", "gclid", "gbraid", "wbraid", "fbclid", "msclkid", "dclid",
  "igshid", "ttclid", "mc_cid", "mc_eid", "_ga", "srsltid",
  "vero_conv", "vero_id", "yclid", "pk_campaign", "piwik_campaign"
];

const $ = id => document.getElementById(id);

function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* Render the parameter chips */
function renderParams(params) {
  const box = $("paramList");
  box.innerHTML = "";
  for (const p of params) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = p;
    chip.title = "Click to remove";
    chip.addEventListener("click", () => removeParam(p));
    box.appendChild(chip);
  }
  $("statParams").textContent = params.length;
}

async function refresh() {
  const state = await send("getState");
  $("masterToggle").checked = state.enabled;
  $("statStripped").textContent = state.stripped;
  $("statRules").textContent = state.ruleCount;
  renderParams(state.params);
}

async function saveParams(params) {
  await chrome.storage.local.set({ params });
  await send("rebuild");
  await refresh();
}

async function removeParam(p) {
  const { params = DEFAULT_PARAMS } = await chrome.storage.local.get("params");
  await saveParams(params.filter(x => x !== p));
}

async function addParam() {
  const input = $("newParam");
  const value = input.value.trim().toLowerCase().replace(/[^a-z0-9_*]/g, "");
  if (!value) return;
  const { params = DEFAULT_PARAMS } = await chrome.storage.local.get("params");
  if (!params.includes(value)) await saveParams([...params, value]);
  input.value = "";
}

/* Preview cleaner using the URL API (mirrors the DNR rules' intent) */
function previewClean(raw, params) {
  let url;
  try { url = new URL(raw.includes("://") ? raw : "https://" + raw); }
  catch { return "Invalid URL"; }
  const matchers = params.map(p =>
    p.endsWith("*") ? { prefix: p.slice(0, -1) } : { exact: p });
  for (const key of [...url.searchParams.keys()]) {
    if (matchers.some(m => (m.exact && m.exact === key) || (m.prefix && key.startsWith(m.prefix)))) {
      url.searchParams.delete(key);
    }
  }
  url.search = url.searchParams.toString();
  return url.toString();
}

async function testUrl() {
  const { params = DEFAULT_PARAMS } = await chrome.storage.local.get("params");
  const out = $("testOut");
  out.hidden = false;
  out.textContent = previewClean($("testUrl").value.trim(), params);
}

/* Wire up */
$("masterToggle").addEventListener("change", async e => {
  await chrome.storage.local.set({ enabled: e.target.checked });
  await send("rebuild");
  await refresh();
});
$("addParam").addEventListener("click", addParam);
$("newParam").addEventListener("keydown", e => { if (e.key === "Enter") addParam(); });
$("testBtn").addEventListener("click", testUrl);
$("testUrl").addEventListener("keydown", e => { if (e.key === "Enter") testUrl(); });
$("resetDefaults").addEventListener("click", () => saveParams([...DEFAULT_PARAMS]));
$("resetStats").addEventListener("click", async () => {
  await chrome.storage.local.set({ stripped: 0 });
  await refresh();
});

refresh();
