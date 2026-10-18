/* Weekly reminder alarm -> notification. */
'use strict';

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'rvaWeekly') return;
  chrome.storage.local.get(['rvaState'], (d) => {
    if (!d.rvaState || !d.rvaState.remind) return;
    const names = (d.rvaState.businesses || []).map((b) => b.name).slice(0, 3).join(', ');
    chrome.notifications.create('rvaWeekly', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Log your reviews',
      message: names
        ? `Time for the weekly review check-in: ${names}.`
        : 'Time for the weekly review check-in — open Review Velocity Analyzer.'
    });
  });
});
