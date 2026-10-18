/* CloudTail — background service worker.
 * Every 2 minutes (when the user enables auto-refresh) it re-tails the last
 * selected log group with the last filter pattern, caches the events, and
 * updates the toolbar badge with the event count.
 * Uses only the user's own stored credentials, SigV4-signed locally. */

'use strict';
/* global SigV4 */
importScripts('sigv4.js');

const ALARM_NAME = 'cloudtail-refresh';
const FILTER_TARGET = 'Logs_20140328.FilterLogEvents';

async function tick() {
  try {
    const d = await chrome.storage.local.get([
      'aws_access_key', 'aws_secret_key', 'aws_session_token', 'aws_region',
      'aws_auto_refresh', 'aws_last_group', 'aws_last_pattern',
    ]);
    if (!d.aws_access_key || !d.aws_secret_key || !d.aws_region) return;
    if (!d.aws_auto_refresh || !d.aws_last_group) return;

    const creds = {
      region: d.aws_region,
      accessKeyId: d.aws_access_key,
      secretAccessKey: d.aws_secret_key,
      sessionToken: d.aws_session_token || undefined,
    };
    const body = { logGroupName: d.aws_last_group, limit: 50, interleaved: true };
    if (d.aws_last_pattern) body.filterPattern = d.aws_last_pattern;
    const data = await SigV4.callCloudWatch(creds, FILTER_TARGET, body);
    const events = data.events || [];
    events.sort((a, b) => b.timestamp - a.timestamp);

    const now = Date.now();
    await chrome.storage.local.set({ aws_last_events: events, aws_last_check: now });

    if (events.length > 0) {
      await chrome.action.setBadgeText({ text: String(events.length) });
      await chrome.action.setBadgeBackgroundColor({ color: '#ff9900' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch {
    // Silent: transient network/signing errors should not spam the user.
    // The popup surfaces errors on its next manual tail.
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) tick();
});

// Keep the ticker alive after install/update if already configured.
chrome.runtime.onInstalled.addListener(async () => {
  const { aws_auto_refresh } = await chrome.storage.local.get(['aws_auto_refresh']);
  if (aws_auto_refresh) {
    const existing = await chrome.alarms.get(ALARM_NAME);
    if (!existing) await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 2 });
  }
});
