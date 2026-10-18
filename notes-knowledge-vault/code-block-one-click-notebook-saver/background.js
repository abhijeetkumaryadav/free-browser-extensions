/* CodeVault — background service worker.
 * Currently a no-op placeholder kept for future alarms/context menus;
 * required by the manifest for a consistent MV3 structure.
 */
'use strict';
chrome.runtime.onInstalled.addListener(() => {
  // Nothing to initialize yet; notebooks live in chrome.storage.local.
});
