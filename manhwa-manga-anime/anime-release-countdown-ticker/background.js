/* HypeDrop — background service worker.
 * Keeps a per-minute alarm that (1) fires a notification when a tracked
 * release time passes and (2) keeps the toolbar badge showing the nearest
 * upcoming release. All data is local; the only network use is none.
 */
'use strict';

const STORAGE_KEY = 'hypedrop.releases.v1';
const TICK_ALARM = 'hypedrop.tick';

async function getReleases() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function saveReleases(releases) {
  await chrome.storage.local.set({ [STORAGE_KEY]: releases });
}

function badgeFor(msLeft) {
  if (msLeft <= 0) return '';
  const days = Math.floor(msLeft / 86400000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(msLeft / 3600000);
  if (hours >= 1) return `${hours}h`;
  const mins = Math.max(1, Math.floor(msLeft / 60000));
  return `${mins}m`;
}

async function refresh() {
  const now = Date.now();
  const releases = await getReleases();
  let changed = false;

  // Fire notifications for releases that just passed and weren't notified.
  for (const r of releases) {
    if (!r.notified && r.at <= now) {
      r.notified = true;
      changed = true;
      chrome.notifications.create(`hypedrop-${r.id}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Release day!',
        message: `${r.title} is out now.`
      }).catch(() => {});
    }
  }
  if (changed) await saveReleases(releases);

  // Badge: nearest upcoming release.
  const upcoming = releases
    .filter((r) => r.at > now)
    .sort((a, b) => a.at - b.at)[0];
  const text = upcoming ? badgeFor(upcoming.at - now) : '';
  chrome.action.setBadgeText({ text }).catch(() => {});
  if (text) chrome.action.setBadgeBackgroundColor({ color: '#22d3ee' }).catch(() => {});
}

async function ensureAlarm() {
  const existing = await chrome.alarms.get(TICK_ALARM);
  if (!existing) chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TICK_ALARM) refresh();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'hypedrop.refresh') refresh();
});

chrome.runtime.onInstalled.addListener(() => { ensureAlarm(); refresh(); });
chrome.runtime.onStartup.addListener(() => { ensureAlarm(); refresh(); });

// Self-heal: make sure the ticking alarm exists on every wake.
ensureAlarm();
