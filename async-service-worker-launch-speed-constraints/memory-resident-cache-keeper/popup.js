/* CacheKeeper popup — per-origin storage usage scan + on-demand cache clear. */
"use strict";

const HISTORY_KEY = "scanHistory";
const MAX_HISTORY = 30;

const $ = (id) => document.getElementById(id);
const originLabel = $("originLabel");
const scanBtn = $("scanBtn");
const usageBlock = $("usageBlock");
const usageText = $("usageText");
const pctText = $("pctText");
const barFill = $("barFill");
const quotaNote = $("quotaNote");
const clearBtn = $("clearBtn");
const scanError = $("scanError");
const historyList = $("historyList");
const historyEmpty = $("historyEmpty");
const historyClear = $("historyClear");

let currentOrigin = "";
let lastEstimate = null;

/* ---------- helpers ---------- */
function fmtBytes(n) {
  if (!Number.isFinite(n) || n < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return n.toFixed(n >= 100 || i === 0 ? 0 : 1) + " " + units[i];
}

function originOf(url) {
  try { return new URL(url).origin; }
  catch { return ""; }
}

function showError(msg) {
  scanError.textContent = msg;
  scanError.hidden = false;
}
function clearError() {
  scanError.hidden = true;
  scanError.textContent = "";
}

async function loadHistory() {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  const h = data[HISTORY_KEY];
  return Array.isArray(h) ? h : [];
}

async function pushHistory(entry) {
  const h = (await loadHistory()).filter((e) => e.origin !== entry.origin);
  h.unshift(entry);
  await chrome.storage.local.set({ [HISTORY_KEY]: h.slice(0, MAX_HISTORY) });
}

/* ---------- scan: runs estimate() inside the tab's own context ---------- */
async function scanCurrentTab() {
  clearError();
  scanBtn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) throw new Error("No active tab found.");
    const origin = originOf(tab.url);
    if (!origin || origin.startsWith("chrome")) {
      throw new Error("Cannot scan browser-internal pages. Open a regular website.");
    }
    currentOrigin = origin;
    originLabel.textContent = origin;

    // MAIN world so the estimate reflects the page's origin, not the extension's.
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: async () => {
        const e = await navigator.storage.estimate();
        return { usage: e.usage || 0, quota: e.quota || 0 };
      },
    });
    const { usage, quota } = result.result;
    lastEstimate = { usage, quota };

    const pct = quota > 0 ? Math.min(100, (usage / quota) * 100) : 0;
    usageText.textContent = `${fmtBytes(usage)} of ${fmtBytes(quota)}`;
    pctText.textContent = quota > 0 ? pct.toFixed(1) + "%" : "quota unknown";
    barFill.style.width = pct + "%";
    barFill.classList.toggle("hot", pct >= 80);
    quotaNote.textContent = quota > 0
      ? "Origin quota reported by the browser; includes Cache, IndexedDB, and other site storage."
      : "The browser did not report a quota for this origin.";
    usageBlock.hidden = false;
    clearBtn.hidden = false;

    await pushHistory({ origin, usage, quota, at: Date.now() });
    await renderHistory();
  } catch (err) {
    showError(err.message || "Scan failed.");
  } finally {
    scanBtn.disabled = false;
  }
}

/* ---------- on-demand cache clear for the scanned origin ---------- */
async function clearOriginCache() {
  if (!currentOrigin) return;
  clearError();
  clearBtn.disabled = true;
  try {
    await chrome.browsingData.remove(
      { origins: [currentOrigin] },
      { cache: true }
    );
    quotaNote.textContent = "Cache cleared for this origin. Scan again to refresh numbers.";
    await scanCurrentTab();
  } catch (err) {
    showError("Clear failed: " + (err.message || err));
  } finally {
    clearBtn.disabled = false;
  }
}

/* ---------- history ---------- */
function fmtTime(at) {
  return new Date(at).toLocaleString([], {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

async function renderHistory() {
  const h = await loadHistory();
  historyList.innerHTML = "";
  historyEmpty.style.display = h.length ? "none" : "block";
  for (const e of h) {
    const li = document.createElement("li");
    li.className = "history-item";

    const meta = document.createElement("div");
    meta.className = "meta";
    const o = document.createElement("div");
    o.className = "origin";
    o.textContent = e.origin;
    o.title = e.origin;
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = `${fmtBytes(e.usage)} · ${fmtTime(e.at)}`;
    meta.append(o, sub);

    const pct = document.createElement("span");
    pct.className = "pct";
    pct.textContent = e.quota > 0
      ? Math.min(100, (e.usage / e.quota) * 100).toFixed(1) + "%"
      : "—";

    li.append(meta, pct);
    historyList.appendChild(li);
  }
}

/* ---------- wire up ---------- */
scanBtn.addEventListener("click", scanCurrentTab);
clearBtn.addEventListener("click", clearOriginCache);
historyClear.addEventListener("click", async () => {
  await chrome.storage.local.remove(HISTORY_KEY);
  await renderHistory();
});

(async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    const origin = originOf(tab.url);
    originLabel.textContent = origin && !origin.startsWith("chrome") ? origin : "—";
  }
  await renderHistory();
})();
