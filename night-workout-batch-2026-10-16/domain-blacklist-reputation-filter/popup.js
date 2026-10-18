// Domain Blacklist Filter — popup logic
// Manages the user's own blacklist, hide mode, and one-click page filtering.
"use strict";

const STORAGE_KEY = "dblf.settings";

/* ---------- helpers ---------- */
function parseDomains(text) {
  return text.split(/\s+/).map((d) => d.trim().toLowerCase())
    .filter(Boolean)
    .map((d) => d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""));
}

async function loadSettings() {
  const out = await chrome.storage.local.get(STORAGE_KEY);
  return out[STORAGE_KEY] || { domains: [], mode: "dim" };
}

async function saveSettings(patch) {
  const cur = await loadSettings();
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...cur, ...patch } });
}

async function inject() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error("No active tab.");
  if (!/^https?:/.test(tab.url || "")) throw new Error("Works only on http(s) pages.");
  const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  return res;
}

function showStatus(msg, isError) {
  const el = document.getElementById("stats");
  el.textContent = msg;
  el.style.color = isError ? "#f87171" : "";
}

/* ---------- wiring ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  const ta = document.getElementById("domains");
  const countEl = document.getElementById("domainCount");
  const dimBtn = document.getElementById("modeDim");
  const colBtn = document.getElementById("modeCollapse");

  const settings = await loadSettings();
  ta.value = (settings.domains || []).join("\n");
  countEl.textContent = `${settings.domains.length || 0} domains`;
  if (settings.mode === "collapse") { dimBtn.classList.remove("active"); colBtn.classList.add("active"); }

  ta.addEventListener("input", () => {
    const n = parseDomains(ta.value).length;
    countEl.textContent = `${n} domain${n === 1 ? "" : "s"}`;
  });

  document.getElementById("saveBtn").addEventListener("click", async () => {
    const domains = [...new Set(parseDomains(ta.value))];
    ta.value = domains.join("\n");
    await saveSettings({ domains });
    countEl.textContent = `${domains.length} domains`;
    showStatus("Blacklist saved.");
  });

  const setMode = async (mode) => {
    dimBtn.classList.toggle("active", mode === "dim");
    colBtn.classList.toggle("active", mode === "collapse");
    await saveSettings({ mode });
  };
  dimBtn.addEventListener("click", () => setMode("dim"));
  colBtn.addEventListener("click", () => setMode("collapse"));

  document.getElementById("filterBtn").addEventListener("click", async () => {
    try {
      const domains = [...new Set(parseDomains(ta.value))];
      if (!domains.length) return showStatus("Add at least one domain first.", true);
      await saveSettings({ domains });
      await inject();
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const settings = await loadSettings();
      const res = await chrome.tabs.sendMessage(tab.id, { type: "scan", domains, mode: settings.mode });
      if (res && res.ok) showStatus(`Hidden ${res.hidden} result${res.hidden === 1 ? "" : "s"} from your blacklist.`);
      else showStatus("No matching results found on this page.");
    } catch (e) { showStatus(String(e.message || e), true); }
  });

  document.getElementById("restoreBtn").addEventListener("click", async () => {
    try {
      await inject();
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const res = await chrome.tabs.sendMessage(tab.id, { type: "restore" });
      showStatus(res && res.ok ? "Page restored." : "Nothing to restore.");
    } catch (e) { showStatus(String(e.message || e), true); }
  });
});
