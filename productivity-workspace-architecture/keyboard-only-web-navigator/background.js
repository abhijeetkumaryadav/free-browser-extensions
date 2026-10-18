/* Keyboard-Only Web Navigator — background service worker.
 * Handles tab actions the content script cannot perform itself.
 * No browsing data is read or stored. */
"use strict";

/** Move to the tab `dir` steps away from the sender tab, wrapping around. */
async function moveTab(senderTab, dir) {
  if (!senderTab) return;
  const tabs = await chrome.tabs.query({ windowId: senderTab.windowId });
  if (!tabs.length) return;
  const sorted = tabs.slice().sort((a, b) => a.index - b.index);
  const pos = sorted.findIndex((t) => t.id === senderTab.id);
  const next = sorted[(pos + dir + sorted.length) % sorted.length];
  if (next) await chrome.tabs.update(next.id, { active: true });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.action === "closeTab" && sender.tab) {
        await chrome.tabs.remove(sender.tab.id);
      } else if (msg.action === "nextTab") {
        await moveTab(sender.tab, 1);
      } else if (msg.action === "prevTab") {
        await moveTab(sender.tab, -1);
      }
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false });
    }
  })();
  return true; // keep the message channel open for the async reply
});
