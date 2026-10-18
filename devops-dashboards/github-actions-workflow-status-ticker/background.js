/* FlowWatch — background service worker.
 * Fires every 5 minutes (when the user enables auto-refresh) to re-fetch the
 * latest workflow runs and update the toolbar badge with the failed-run count.
 * Uses only the user's own stored token, sent exclusively to api.github.com. */

'use strict';

const API_BASE = 'https://api.github.com';
const ALARM_NAME = 'flowwatch-refresh';

async function fetchRuns(token, owner, repo) {
  const url = `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=12`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  return data.workflow_runs || [];
}

async function tick() {
  try {
    const { gh_token, gh_owner, gh_repo, gh_auto_refresh } = await chrome.storage.local.get(
      ['gh_token', 'gh_owner', 'gh_repo', 'gh_auto_refresh']
    );
    if (!gh_token || !gh_owner || !gh_repo || !gh_auto_refresh) return;

    const runs = await fetchRuns(gh_token, gh_owner, gh_repo);
    const now = Date.now();
    await chrome.storage.local.set({ gh_last_runs: runs, gh_last_check: now });

    const failed = runs.filter((r) => r.conclusion === 'failure').length;
    if (failed > 0) {
      await chrome.action.setBadgeText({ text: String(failed) });
      await chrome.action.setBadgeBackgroundColor({ color: '#f85149' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch {
    // Silent: transient network/API errors should not spam the user.
    // The popup shows errors on its next manual refresh.
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) tick();
});

// Keep the badge fresh shortly after install/update if already configured.
chrome.runtime.onInstalled.addListener(async () => {
  const { gh_auto_refresh } = await chrome.storage.local.get(['gh_auto_refresh']);
  if (gh_auto_refresh) {
    const existing = await chrome.alarms.get(ALARM_NAME);
    if (!existing) await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 5 });
  }
});
