/* LoopBreaker — background service worker.
 * Injects the friction content script into navigated http(s) pages when
 * protection is enabled. Tracks nothing; all state stays in local storage. */
/* global chrome */
(() => {
  'use strict';

  // Inject on completed navigation so the friction timer starts per page.
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    const url = tab.url || '';
    if (!/^https?:/.test(url)) return;
    const { enabled } = await chrome.storage.local.get({ enabled: false });
    if (!enabled) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
    } catch {
      // Page may not allow injection (web store, etc.) — ignore.
    }
  });

  // Keep a lightweight daily heartbeat so stats days exist even idle.
  chrome.alarms.create('loopbreaker-day', { periodInMinutes: 60 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== 'loopbreaker-day') return;
    const day = new Date().toISOString().slice(0, 10);
    chrome.storage.local.get({ stats: {} }, ({ stats }) => {
      if (!stats[day]) {
        stats[day] = { breaks: 0, mins: 0, loops: 0 };
        chrome.storage.local.set({ stats });
      }
    });
  });
})();
