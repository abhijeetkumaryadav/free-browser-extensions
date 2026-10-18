/**
 * Ad-Stripper popup — user-triggered only.
 * Scans the active tab via chrome.scripting on explicit click; no background scanning.
 */

const $ = (id) => document.getElementById(id);

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function tabAllowed(tab) {
  return tab && tab.id && /^https?:/.test(tab.url || "");
}

/** Load the content functions into the tab (file-based, MV3-safe). */
async function ensureContentLoaded(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });
}

function renderResults(items) {
  const box = $("results");
  const list = $("flagList");
  $("flagBadge").textContent = items.length;
  list.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "No ad-like results found on this page.";
    list.appendChild(li);
  } else {
    for (const item of items) {
      const li = document.createElement("li");
      const t = document.createElement("div");
      t.textContent = item.title;
      const w = document.createElement("span");
      w.className = "why";
      w.textContent = "Why: " + item.why;
      li.appendChild(t);
      li.appendChild(w);
      list.appendChild(li);
    }
  }
  box.hidden = false;
}

async function refreshCounts(tabId) {
  const data = await chrome.storage.local.get(["perTab", "total"]);
  const perTab = data.perTab || {};
  $("collapsedCount").textContent = perTab[String(tabId)] || 0;
  $("totalCount").textContent = data.total || 0;
}

async function onScan() {
  const tab = await getActiveTab();
  if (!tabAllowed(tab)) {
    renderResults([]);
    $("flagBadge").textContent = "0";
    $("flagList").innerHTML = '<li>Open a regular web page (not chrome:// or a new-tab page) and try again.</li>';
    $("results").hidden = false;
    return;
  }
  const aggressive = $("aggressive").checked;
  await chrome.storage.local.set({ aggressive });
  await ensureContentLoaded(tab.id);
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (agg) => adStripperScan(agg),
    args: [aggressive]
  });
  renderResults(result.flagged);
  // Persist counts
  const data = await chrome.storage.local.get(["perTab", "total"]);
  const perTab = data.perTab || {};
  perTab[String(tab.id)] = (perTab[String(tab.id)] || 0) + result.flagged.length;
  await chrome.storage.local.set({ perTab, total: (data.total || 0) + result.flagged.length });
  await refreshCounts(tab.id);
}

async function onRestore() {
  const tab = await getActiveTab();
  if (!tabAllowed(tab)) return;
  await ensureContentLoaded(tab.id);
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => adStripperRestore()
  });
  // Reset this tab's counter (global total stays as a lifetime stat)
  const data = await chrome.storage.local.get(["perTab"]);
  const perTab = data.perTab || {};
  delete perTab[String(tab.id)];
  await chrome.storage.local.set({ perTab });
  await refreshCounts(tab.id);
  $("results").hidden = true;
}

document.addEventListener("DOMContentLoaded", async () => {
  const tab = await getActiveTab();
  const data = await chrome.storage.local.get(["aggressive"]);
  $("aggressive").checked = !!data.aggressive;
  if (tab) await refreshCounts(tab.id);
  $("scanBtn").addEventListener("click", onScan);
  $("restoreBtn").addEventListener("click", onRestore);
});
