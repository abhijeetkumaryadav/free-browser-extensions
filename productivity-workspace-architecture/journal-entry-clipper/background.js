// Journal Entry Clipper — background service worker.
// Adds a "Clip to journal" context-menu item for selected text.

const MENU_ID = "clip-to-journal";

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Clip to journal",
    contexts: ["selection"],
  });
  const { entries } = await chrome.storage.local.get("entries");
  if (!entries) await chrome.storage.local.set({ entries: [] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;
  const { entries = [] } = await chrome.storage.local.get("entries");
  entries.unshift({
    id: "e-" + Date.now(),
    text: info.selectionText.trim().slice(0, 5000),
    tags: [],
    mood: null,
    at: Date.now(),
    src: tab ? { title: tab.title || "", url: tab.url || "" } : null,
  });
  await chrome.storage.local.set({ entries: entries.slice(0, 1000) });
});
