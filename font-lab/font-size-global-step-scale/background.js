/* ZoomStep background service worker.
 * Re-applies remembered per-site zoom when a page finishes loading.
 * (The browser already remembers per-tab zoom itself; this covers
 *  the "remember for this site" promise across visits and restarts.)
 */

'use strict';

const MIN = 0.5;
const MAX = 3.0;

function hostOf(url) {
  try { return new URL(url).hostname || ''; } catch (e) { return ''; }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const host = hostOf(tab.url || '');
  if (!host) return;
  try {
    const data = await chrome.storage.local.get('zoomstep');
    const sites = (data.zoomstep && data.zoomstep.sites) || {};
    const z = sites[host];
    if (typeof z === 'number' && z >= MIN && z <= MAX && z !== 1) {
      await chrome.tabs.setZoom(tabId, z);
    }
  } catch (e) {
    // Tab may have closed; ignore.
  }
});
