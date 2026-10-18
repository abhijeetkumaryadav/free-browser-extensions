/* Data Broker Opt-Out Scanner — background service worker.
 * Fires a daily alarm and notifies about brokers whose follow-up
 * reminder date has arrived. All data lives in chrome.storage.local.
 */
'use strict';

var ALARM_NAME = 'dbos-daily-reminder';
var STORE_KEY = 'brokers';

// Ensure the daily alarm exists (created on install, re-created on startup).
function ensureAlarm() {
  chrome.alarms.get(ALARM_NAME, function (alarm) {
    if (!alarm) {
      // Check every 24h, starting ~1 minute after scheduling.
      chrome.alarms.create(ALARM_NAME, { delayInMinutes: 1, periodInMinutes: 1440 });
    }
  });
}

chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);

// A broker needs a nudge when: it has a reminder date <= today,
// and its status is not "confirmed".
function dueBrokers(brokers) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  return brokers.filter(function (b) {
    if (!b.reminder || b.status === 'confirmed') return false;
    var r = new Date(b.reminder + 'T00:00:00');
    return r <= today;
  });
}

function checkReminders() {
  chrome.storage.local.get({ brokers: [] }, function (res) {
    var due = dueBrokers(res.brokers);
    if (!due.length) return;
    var names = due.slice(0, 4).map(function (b) { return b.name; }).join(', ');
    var extra = due.length > 4 ? ' +' + (due.length - 4) + ' more' : '';
    chrome.notifications.create('dbos-reminder', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Data broker follow-up due',
      message: 'Check opt-out status: ' + names + extra,
      priority: 1
    });
  });
}

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === ALARM_NAME) checkReminders();
});

// Popup can trigger an immediate check after editing reminders.
chrome.runtime.onMessage.addListener(function (msg) {
  if (msg && msg.type === 'dbos-check-now') {
    ensureAlarm();
    checkReminders();
  }
});
