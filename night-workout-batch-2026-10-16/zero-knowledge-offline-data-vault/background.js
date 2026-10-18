/* ZK Vault — background service worker.
 * Runs a periodic auto-lock check: if the vault has been idle longer than the
 * configured timeout, the in-memory session key is wiped, forcing re-login.
 */
'use strict';

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'zkv-autolock') return;
  const sess = await chrome.storage.session.get(['lastActive', 'autolockMinutes', 'key']);
  if (!sess.key) return; // already locked
  const timeoutMs = (sess.autolockMinutes || 5) * 60 * 1000;
  if (Date.now() - (sess.lastActive || 0) > timeoutMs) {
    await chrome.storage.session.clear();
    await chrome.alarms.clear('zkv-autolock');
  }
});

// Fresh installs start locked.
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.session.clear();
});
