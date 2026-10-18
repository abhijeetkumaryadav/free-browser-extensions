/* CloudTail — popup logic.
 * Uses the user's own IAM credentials (stored only in chrome.storage.local)
 * to call CloudWatch Logs via SigV4-signed requests (see sigv4.js).
 * Credentials are never sent anywhere except logs.<region>.amazonaws.com. */

'use strict';
/* global SigV4 */

const $ = (id) => document.getElementById(id);
const ALARM_NAME = 'cloudtail-refresh';
const DESCRIBE_TARGET = 'Logs_20140328.DescribeLogGroups';
const FILTER_TARGET = 'Logs_20140328.FilterLogEvents';
const REGION_RE = /^[a-z]{2}-[a-z0-9-]+-\d$/;

// ---- DOM ----
const settingsPanel = $('settings-panel');
const settingsToggle = $('settings-toggle');
const accessKeyInput = $('access-key');
const secretKeyInput = $('secret-key');
const sessionTokenInput = $('session-token');
const regionInput = $('region');
const autoRefreshInput = $('auto-refresh');
const saveBtn = $('save-settings');
const clearBtn = $('clear-settings');
const settingsStatus = $('settings-status');
const secretVisibility = $('secret-visibility');
const groupSelect = $('log-group');
const refreshGroupsBtn = $('refresh-groups');
const chips = [...document.querySelectorAll('.chip')];
const patternInput = $('custom-pattern');
const tailBtn = $('tail-now');
const eventsList = $('events-list');
const eventsStatus = $('events-status');
const eventCountEl = $('event-count');
const lastCheckedEl = $('last-checked');

/** Stored settings; credentials live ONLY in chrome.storage.local. */
async function loadSettings() {
  const d = await chrome.storage.local.get([
    'aws_access_key', 'aws_secret_key', 'aws_session_token', 'aws_region',
    'aws_auto_refresh', 'aws_last_group', 'aws_last_pattern',
    'aws_last_events', 'aws_last_check',
  ]);
  return {
    accessKeyId: d.aws_access_key || '',
    secretAccessKey: d.aws_secret_key || '',
    sessionToken: d.aws_session_token || '',
    region: (d.aws_region || '').trim(),
    autoRefresh: !!d.aws_auto_refresh,
    lastGroup: d.aws_last_group || '',
    lastPattern: d.aws_last_pattern || '',
    lastEvents: d.aws_last_events || null,
    lastCheck: d.aws_last_check || 0,
  };
}

async function saveSettings(patch) {
  await chrome.storage.local.set(patch);
}

function credsOf(s) {
  return {
    region: s.region,
    accessKeyId: s.accessKeyId,
    secretAccessKey: s.secretAccessKey,
    sessionToken: s.sessionToken || undefined,
  };
}

/** List log group names (up to ~100 across two pages). */
async function describeGroups(creds) {
  const names = [];
  let nextToken;
  for (let page = 0; page < 2; page++) {
    const body = { limit: 50 };
    if (nextToken) body.nextToken = nextToken;
    const data = await SigV4.callCloudWatch(creds, DESCRIBE_TARGET, body);
    for (const g of data.logGroups || []) names.push(g.logGroupName);
    nextToken = data.nextToken;
    if (!nextToken) break;
  }
  return names;
}

/** Fetch the most recent matching events for a log group. */
async function tailEvents(creds, logGroupName, pattern) {
  const body = { logGroupName, limit: 50, interleaved: true };
  if (pattern) body.filterPattern = pattern; // omit when empty: unfiltered tail
  const data = await SigV4.callCloudWatch(creds, FILTER_TARGET, body);
  const events = data.events || [];
  // Newest first for a "tail" view.
  events.sort((a, b) => b.timestamp - a.timestamp);
  return events;
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour12: false }) +
    '.' + String(new Date(ts).getMilliseconds()).padStart(3, '0');
}

function renderEvents(events) {
  if (!events.length) {
    eventsList.innerHTML = '<div class="empty-state">No matching events in this log group.</div>';
    eventCountEl.textContent = '';
    return;
  }
  eventCountEl.textContent = `${events.length} event${events.length === 1 ? '' : 's'}`;
  eventsList.innerHTML = events.map((e) => {
    const msg = String(e.message || '');
    const short = msg.length > 400 ? msg.slice(0, 400) + '…' : msg;
    return `<div class="event-card" title="${esc(msg)}">
      <div class="event-time">${esc(fmtTime(e.timestamp))} · ${esc(e.logStreamName || '')}</div>
      <div class="event-msg">${esc(short)}</div>
    </div>`;
  }).join('');
}

function setStatus(el, msg, kind = '') {
  el.textContent = msg;
  el.className = `status-line ${kind}`;
}

function currentPattern() {
  return patternInput.value.trim();
}

async function refreshGroups(silent = false) {
  const s = await loadSettings();
  if (!s.accessKeyId || !s.secretAccessKey || !s.region) {
    if (!silent) setStatus(eventsStatus, 'Add your AWS credentials in Settings first.', 'error');
    return;
  }
  if (!silent) setStatus(eventsStatus, 'Loading log groups…');
  try {
    const names = await describeGroups(credsOf(s));
    groupSelect.innerHTML = names.length
      ? names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('')
      : '<option value="">(no log groups found)</option>';
    if (s.lastGroup && names.includes(s.lastGroup)) groupSelect.value = s.lastGroup;
    if (!silent) setStatus(eventsStatus, names.length ? '' : 'No log groups found in this region.', names.length ? '' : 'error');
  } catch (err) {
    if (!silent) setStatus(eventsStatus, err.message, 'error');
  }
}

/** Tail the selected group; cache results for the background ticker. */
async function refresh(silent = false) {
  const s = await loadSettings();
  if (!s.accessKeyId || !s.secretAccessKey || !s.region) {
    setStatus(eventsStatus, 'Add your AWS credentials in Settings to start.', '');
    return;
  }
  const group = groupSelect.value;
  if (!group) {
    setStatus(eventsStatus, 'Pick a log group first (reload the list if empty).', 'error');
    return;
  }
  const pattern = currentPattern();
  if (!silent) {
    tailBtn.disabled = true;
    setStatus(eventsStatus, 'Tailing…');
  }
  try {
    const events = await tailEvents(credsOf(s), group, pattern);
    renderEvents(events);
    setStatus(eventsStatus, '');
    const now = Date.now();
    lastCheckedEl.textContent = `Checked ${new Date(now).toLocaleTimeString()}`;
    await saveSettings({
      aws_last_events: events, aws_last_check: now,
      aws_last_group: group, aws_last_pattern: pattern,
    });
    await updateBadge(events.length);
  } catch (err) {
    setStatus(eventsStatus, err.message, 'error');
  } finally {
    tailBtn.disabled = false;
  }
}

/** Toolbar badge: event count from the latest tail, cleared when zero. */
async function updateBadge(count) {
  if (count > 0) {
    await chrome.action.setBadgeText({ text: String(count) });
    await chrome.action.setBadgeBackgroundColor({ color: '#ff9900' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

async function applyAutoRefreshSetting(enabled) {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (enabled && !existing) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 2 });
  } else if (!enabled && existing) {
    await chrome.alarms.clear(ALARM_NAME);
  }
}

// ---- Events ----
settingsToggle.addEventListener('click', () => settingsPanel.classList.toggle('hidden'));

secretVisibility.addEventListener('click', () => {
  secretKeyInput.type = secretKeyInput.type === 'password' ? 'text' : 'password';
});

chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    chips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    patternInput.value = chip.dataset.pattern;
    saveSettings({ aws_last_pattern: chip.dataset.pattern });
  });
});
patternInput.addEventListener('input', () => chips.forEach((c) => c.classList.remove('active')));

saveBtn.addEventListener('click', async () => {
  const accessKeyId = accessKeyInput.value.trim();
  const secretAccessKey = secretKeyInput.value.trim();
  const sessionToken = sessionTokenInput.value.trim();
  const region = regionInput.value.trim();
  const autoRefresh = autoRefreshInput.checked;
  if (!accessKeyId || !secretAccessKey || !region) {
    setStatus(settingsStatus, 'Access key ID, secret access key and region are required.', 'error');
    return;
  }
  if (!REGION_RE.test(region)) {
    setStatus(settingsStatus, 'Region looks invalid (expected like us-east-1).', 'error');
    return;
  }
  saveBtn.disabled = true;
  setStatus(settingsStatus, 'Testing credentials…');
  try {
    // Validate before persisting: a tiny signed call.
    await SigV4.callCloudWatch(
      { region, accessKeyId, secretAccessKey, sessionToken: sessionToken || undefined },
      DESCRIBE_TARGET, { limit: 1 }
    );
    await saveSettings({
      aws_access_key: accessKeyId,
      aws_secret_key: secretAccessKey,
      aws_session_token: sessionToken,
      aws_region: region,
      aws_auto_refresh: autoRefresh,
    });
    await applyAutoRefreshSetting(autoRefresh);
    setStatus(settingsStatus, 'Connected — keys saved on this device only.', 'ok');
    settingsPanel.classList.add('hidden');
    await refreshGroups(true);
    await refresh();
  } catch (err) {
    setStatus(settingsStatus, err.message, 'error');
  } finally {
    saveBtn.disabled = false;
  }
});

clearBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove([
    'aws_access_key', 'aws_secret_key', 'aws_session_token', 'aws_region',
    'aws_auto_refresh', 'aws_last_group', 'aws_last_pattern',
    'aws_last_events', 'aws_last_check',
  ]);
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.action.setBadgeText({ text: '' });
  accessKeyInput.value = ''; secretKeyInput.value = ''; sessionTokenInput.value = '';
  regionInput.value = ''; autoRefreshInput.checked = false;
  groupSelect.innerHTML = '';
  setStatus(settingsStatus, 'Keys forgotten — all credentials removed from this device.', 'ok');
  renderEvents([]);
});

autoRefreshInput.addEventListener('change', async () => {
  await saveSettings({ aws_auto_refresh: autoRefreshInput.checked });
  await applyAutoRefreshSetting(autoRefreshInput.checked);
});

refreshGroupsBtn.addEventListener('click', () => refreshGroups());
tailBtn.addEventListener('click', () => refresh());

// ---- Init ----
(async function init() {
  const s = await loadSettings();
  accessKeyInput.value = s.accessKeyId;
  secretKeyInput.value = s.secretAccessKey;
  sessionTokenInput.value = s.sessionToken;
  regionInput.value = s.region;
  autoRefreshInput.checked = s.autoRefresh;

  if (s.accessKeyId && s.secretAccessKey && s.region) {
    patternInput.value = s.lastPattern;
    // Mark the matching preset chip, if any.
    const match = chips.find((c) => c.dataset.pattern === s.lastPattern);
    if (match) { chips.forEach((c) => c.classList.remove('active')); match.classList.add('active'); }
    await refreshGroups(true);
    if (Array.isArray(s.lastEvents) && s.lastCheck && Date.now() - s.lastCheck < 2 * 60 * 1000) {
      renderEvents(s.lastEvents);
      lastCheckedEl.textContent = `Checked ${new Date(s.lastCheck).toLocaleTimeString()}`;
      refresh(true); // quiet background refresh
    } else {
      await refresh();
    }
  } else {
    settingsPanel.classList.remove('hidden');
  }
})();
