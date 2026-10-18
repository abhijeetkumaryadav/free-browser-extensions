'use strict';

/* UVGuard background service worker.
 * Fires the reapply-sunscreen notification when the timer alarm goes off,
 * even if the popup is closed.
 */

const TIMER_ALARM = 'uvguard-reapply';

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== TIMER_ALARM) return;

  chrome.storage.local.get('uvguardTimer', (res) => {
    const t = res.uvguardTimer;
    const mins = t && t.durationMin ? `${t.durationMin}-minute ` : '';
    chrome.notifications.create('uvguard-done', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'UVGuard — time to reapply',
      message: `Your ${mins}sunscreen timer is up. Reapply and stay sun-safe.`,
    });
    chrome.storage.local.remove('uvguardTimer');
    chrome.action.setBadgeText({ text: '' });
  });
});
