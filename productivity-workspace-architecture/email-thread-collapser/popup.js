// Email Thread Collapser — popup logic.
// Reads the master toggle from storage and asks the content script
// on the active Gmail tab how many quoted blocks it has collapsed.

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const { etc_enabled = true } = await chrome.storage.local.get("etc_enabled");
  $("enabled").checked = etc_enabled;
  $("enabled").addEventListener("change", onToggle);
  refreshCount();
}

async function onToggle(e) {
  const enabled = e.target.checked;
  await chrome.storage.local.set({ etc_enabled: enabled });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id && tab.url && tab.url.includes("mail.google.com")) {
    try {
      await chrome.tabs.sendMessage(tab.id, { cmd: "setEnabled", enabled });
    } catch (err) { /* content script not ready yet */ }
  }
  refreshCount();
}

async function refreshCount() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const box = $("status");
  if (!tab || !tab.url || !tab.url.includes("mail.google.com")) {
    box.innerHTML = "Open a <b>Gmail</b> tab to see the count.";
    return;
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { cmd: "count" });
    const n = res && typeof res.collapsed === "number" ? res.collapsed : 0;
    box.innerHTML = `<b>${n}</b> quoted block${n === 1 ? "" : "s"} collapsed on this tab.`;
  } catch (err) {
    box.innerHTML = "Reload the Gmail tab once after installing, then reopen here.";
  }
}
