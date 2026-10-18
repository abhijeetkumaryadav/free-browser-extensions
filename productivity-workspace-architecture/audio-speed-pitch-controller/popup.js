// Audio Speed & Pitch Controller — popup logic.
// scanMedia() and applyMedia() are injected into the page via
// chrome.scripting.executeScript, so they must stay self-contained
// (no references to outer scope).

function scanMedia() {
  const els = Array.from(document.querySelectorAll("audio, video"));
  return {
    count: els.length,
    rates: Array.from(new Set(els.map((e) => e.playbackRate))),
  };
}

function applyMedia(settings) {
  const els = document.querySelectorAll("audio, video");
  let count = 0;
  els.forEach((el) => {
    try {
      el.playbackRate = settings.rate;
      if ("preservesPitch" in el) el.preservesPitch = settings.preservePitch;
      if ("webkitPreservesPitch" in el) el.webkitPreservesPitch = settings.preservePitch;
      count++;
    } catch (e) { /* a locked element shouldn't stop the rest */ }
  });
  return count;
}

const $ = (id) => document.getElementById(id);
let tabId = null;
let host = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("rate").addEventListener("input", apply);
  $("pitch").addEventListener("change", apply);
  $("reset").addEventListener("click", () => { $("rate").value = 1; apply(); });
  $("remember").addEventListener("click", rememberSite);
  $("forget").addEventListener("click", forgetSite);
  document.querySelectorAll(".presets button").forEach((b) =>
    b.addEventListener("click", () => { $("rate").value = b.dataset.rate; apply(); })
  );

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) { say("Open a regular web page, then try again."); return; }
  tabId = tab.id;
  try {
    host = new URL(tab.url).hostname.replace(/^www\./, "");
    $("pageHost").textContent = host;
    $("siteName").textContent = host;
  } catch (e) { /* restricted page; host stays null */ }

  // Per-site memory: auto-apply a previously saved speed for this host.
  const { siteSpeeds = {} } = await chrome.storage.local.get("siteSpeeds");
  const saved = host && siteSpeeds[host];
  if (saved) {
    $("rate").value = saved.rate;
    $("pitch").checked = saved.preservePitch !== false;
    showSaved();
  }
  await apply();
}

function say(msg) {
  $("msg").textContent = msg;
}

async function refresh() {
  if (tabId == null) return;
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: scanMedia });
    const info = (res && res.result) || { count: 0, rates: [] };
    $("stCount").textContent = info.count;
    $("stRate").textContent = info.rates.length
      ? info.rates.map((r) => Number(r).toFixed(2) + "x").join(", ")
      : "—";
    say(info.count ? "" : "No audio or video on this page yet — they get picked up automatically when they load.");
  } catch (e) {
    say("Can't reach this page. Try a regular website (not a browser settings page).");
  }
}

async function apply() {
  const rate = parseFloat($("rate").value);
  $("rateLabel").textContent = rate.toFixed(2) + "x";
  document.querySelectorAll(".presets button").forEach((b) =>
    b.classList.toggle("on", parseFloat(b.dataset.rate) === rate)
  );
  if (tabId == null) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: applyMedia,
      args: [{ rate, preservePitch: $("pitch").checked }],
    });
  } catch (e) { /* restricted page — message shown by refresh() */ }
  await refresh();
}

async function rememberSite() {
  if (!host) return;
  const { siteSpeeds = {} } = await chrome.storage.local.get("siteSpeeds");
  siteSpeeds[host] = { rate: parseFloat($("rate").value), preservePitch: $("pitch").checked };
  await chrome.storage.local.set({ siteSpeeds });
  showSaved();
}

async function forgetSite() {
  if (!host) return;
  const { siteSpeeds = {} } = await chrome.storage.local.get("siteSpeeds");
  delete siteSpeeds[host];
  await chrome.storage.local.set({ siteSpeeds });
  $("siteNote").textContent = "No saved speed";
  $("forget").hidden = true;
  $("remember").hidden = false;
}

function showSaved() {
  $("siteNote").textContent = "Saved speed auto-applies here";
  $("forget").hidden = false;
  $("remember").hidden = true;
}
