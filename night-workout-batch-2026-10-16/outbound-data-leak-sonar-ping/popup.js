/* Data Leak Sonar — popup logic. Pure view layer; the service worker owns data. */
"use strict";

let tabId = null;
let pollTimer = null;

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function timeAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return "now";
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  return m + "m ago";
}

function renderFeed(records) {
  const feed = $("feed");
  if (!records.length) {
    feed.innerHTML = '<div class="empty">No requests captured yet.<br>Browse in this tab and the sonar will light up.</div>';
    return;
  }
  feed.innerHTML = records.map((r) => {
    const cls = r.tracker ? "tracker" : (r.firstParty ? "" : "third");
    const party = r.firstParty
      ? '<span class="badge first">1st-party</span>'
      : '<span class="badge thirdp">3rd-party</span>';
    const trk = r.tracker ? `<span class="badge trk">TRACKER · ${esc(r.tracker)}</span>` : "";
    return `<div class="req ${cls}">
      <div class="r1"><span class="host" title="${esc(r.url)}">${esc(r.host)}</span><span class="type">${esc(r.type)}</span></div>
      <div class="r2">${party}${trk}<span class="time">${timeAgo(r.t)}</span></div>
    </div>`;
  }).join("");
}

function renderTrackers(list) {
  $("trackerChips").innerHTML = list.map((d) =>
    `<span class="chip">${esc(d)}<button data-del="${esc(d)}" title="Remove">×</button></span>`
  ).join("");
  $("trackerChips").querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => removeTracker(b.dataset.del)));
}

async function refresh() {
  if (tabId === null) return;
  try {
    const res = await chrome.runtime.sendMessage({ type: "getFeed", tabId });
    $("enabledToggle").checked = res.enabled;
    $("statTotal").textContent = res.stats.total;
    $("statThird").textContent = res.stats.thirdParty;
    $("statTrackers").textContent = res.stats.trackerHits;
    renderFeed(res.records);
    renderTrackers(res.trackers);
  } catch { /* worker asleep; next poll will retry */ }
}

async function removeTracker(domain) {
  const res = await chrome.runtime.sendMessage({ type: "getFeed", tabId });
  const next = (res.trackers || []).filter((d) => d !== domain);
  await chrome.runtime.sendMessage({ type: "setTrackers", trackers: next });
  refresh();
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    tabId = tab.id;
    try { $("tabHost").textContent = "· " + new URL(tab.url).hostname; }
    catch { $("tabHost").textContent = ""; }
  }

  $("enabledToggle").addEventListener("change", async (e) => {
    await chrome.runtime.sendMessage({ type: "setEnabled", enabled: e.target.checked });
    refresh();
  });

  $("clearBtn").addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "clearFeed", tabId });
    refresh();
  });

  const add = async () => {
    const input = $("trackerInput");
    const v = input.value.trim().toLowerCase();
    if (!v) return;
    const res = await chrome.runtime.sendMessage({ type: "getFeed", tabId });
    const next = [...new Set([...(res.trackers || []), v])];
    await chrome.runtime.sendMessage({ type: "setTrackers", trackers: next });
    input.value = "";
    refresh();
  };
  $("addTracker").addEventListener("click", add);
  $("trackerInput").addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });

  await refresh();
  pollTimer = setInterval(refresh, 1500);
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("unload", () => clearInterval(pollTimer));
