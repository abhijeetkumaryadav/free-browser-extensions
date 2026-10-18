/* Stagehand background — open the side panel on toolbar click (Chromium). */
"use strict";

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch {
    // sidePanel behavior API unavailable (e.g. Firefox) — popup remains the entry point.
  }
});
