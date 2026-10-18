/* Markdown Toolbar — popup logic: attach/remove the floating toolbar on the active tab. */
"use strict";

/** Guard: content scripts can't run on internal pages. */
async function tabOk() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return null;
  if (!/^https?:|^file:/.test(tab.url || "")) {
    setHint("This page can't be scripted (browser internal page). Try a normal web page.");
    return null;
  }
  return tab;
}

function setHint(msg) { document.getElementById("hint").innerHTML = msg; }

async function send(cmd) {
  const tab = await tabOk();
  if (!tab) return;
  // Ensure the content script is present, then send the command.
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch (e) { /* already injected — boot-once guard handles it */ }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { cmd });
    setHint(res && res.ok ? "Toolbar " + (cmd === "attach" ? "attached — click a text field." : "removed.") : "Couldn't reach the page. Try again.");
  } catch (e) {
    setHint("Couldn't reach the page. Try again.");
  }
}

document.getElementById("attachBtn").addEventListener("click", () => send("attach"));
document.getElementById("removeBtn").addEventListener("click", () => send("remove"));
