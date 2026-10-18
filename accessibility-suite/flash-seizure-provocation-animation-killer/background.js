/* FlashGuard background service worker.
 * Re-applies "kill all animations" on navigation when the user enabled it. */
'use strict';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ killAll: false, thresholdMs: 500 });
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete') return;
  if (!tab.url || !/^https?:/.test(tab.url)) return;
  const { killAll } = await chrome.storage.local.get({ killAll: false });
  if (!killAll) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, { type: 'fg-kill', on: true });
  } catch {
    // Tab not scriptable (e.g. chrome://) — ignore.
  }
});
