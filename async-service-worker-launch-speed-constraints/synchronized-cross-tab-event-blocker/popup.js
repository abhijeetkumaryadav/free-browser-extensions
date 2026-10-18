/* FocusSync popup logic.
 * The shared focus flag lives in chrome.storage.local so every tab's content
 * script sees the same state. Per-tab pause reports live in chrome.storage.session
 * (keyed "focussync_tab_<pageId>") so the popup needs no `tabs` permission.
 */
'use strict';

const STATE_KEY = 'focussync_state';
const MAP_PREFIX = 'focussync_tab_';
const STALE_MS = 5 * 60 * 1000; // ignore reports older than 5 minutes

const toggle = document.getElementById('focusToggle');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const statusHint = document.getElementById('statusHint');
const tabsAffected = document.getElementById('tabsAffected');
const mediaPaused = document.getElementById('mediaPaused');
const clearBtn = document.getElementById('clearBtn');

function renderState(enabled) {
  toggle.checked = enabled;
  statusDot.classList.toggle('on', enabled);
  statusText.textContent = enabled ? 'Focus mode on' : 'Focus mode off';
  statusHint.textContent = enabled
    ? 'Playing media in every tab is paused. New media gets paused automatically.'
    : 'Turn focus on to pause playing media in every tab.';
}

async function refreshStats() {
  try {
    const session = await chrome.storage.session.get(null);
    let tabs = 0, media = 0;
    const now = Date.now();
    for (const [key, entry] of Object.entries(session)) {
      if (!key.startsWith(MAP_PREFIX) || !entry || typeof entry !== 'object') continue;
      if (now - (entry.ts || 0) > STALE_MS) continue;
      if ((entry.paused || 0) > 0) {
        tabs += 1;
        media += entry.paused;
      }
    }
    tabsAffected.textContent = String(tabs);
    mediaPaused.textContent = String(media);
  } catch (e) { /* session storage unavailable */ }
}

async function load() {
  try {
    const res = await chrome.storage.local.get(STATE_KEY);
    renderState(Boolean(res[STATE_KEY] && res[STATE_KEY].enabled));
  } catch (e) {
    renderState(false);
  }
  refreshStats();
}

toggle.addEventListener('change', async () => {
  const enabled = toggle.checked;
  renderState(enabled);
  try {
    await chrome.storage.local.set({ [STATE_KEY]: { enabled, ts: Date.now() } });
  } catch (e) { /* noop */ }
  setTimeout(refreshStats, 600); // give content scripts a moment to report
});

clearBtn.addEventListener('click', async () => {
  try {
    const session = await chrome.storage.session.get(null);
    const keys = Object.keys(session).filter(k => k.startsWith(MAP_PREFIX));
    if (keys.length) await chrome.storage.session.remove(keys);
    await chrome.storage.local.remove(STATE_KEY);
    renderState(false);
    refreshStats();
  } catch (e) { /* noop */ }
});

document.addEventListener('DOMContentLoaded', load);
load();

// Keep stats fresh while the popup is open.
setInterval(refreshStats, 1500);
