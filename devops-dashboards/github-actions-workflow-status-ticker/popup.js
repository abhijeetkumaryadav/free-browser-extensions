/* FlowWatch — popup logic.
 * Reads the user's own GitHub token/repo from chrome.storage.local and lists
 * recent workflow runs via the GitHub REST API. The token never leaves the
 * device except to api.github.com, which the user explicitly configured. */

'use strict';

const API_BASE = 'https://api.github.com';
const PER_PAGE = 12;
const ALARM_NAME = 'flowwatch-refresh';

// ---- DOM ----
const $ = (id) => document.getElementById(id);
const settingsPanel = $('settings-panel');
const settingsToggle = $('settings-toggle');
const tokenInput = $('token');
const ownerInput = $('owner');
const repoInput = $('repo');
const autoRefreshInput = $('auto-refresh');
const saveBtn = $('save-settings');
const clearBtn = $('clear-settings');
const settingsStatus = $('settings-status');
const tokenVisibility = $('token-visibility');
const repoLabel = $('repo-label');
const refreshBtn = $('refresh-now');
const runsList = $('runs-list');
const runsStatus = $('runs-status');
const lastCheckedEl = $('last-checked');

/** Stored settings shape: { token, owner, repo, autoRefresh } */
async function loadSettings() {
  const data = await chrome.storage.local.get(['gh_token', 'gh_owner', 'gh_repo', 'gh_auto_refresh']);
  return {
    token: data.gh_token || '',
    owner: (data.gh_owner || '').trim(),
    repo: (data.gh_repo || '').trim(),
    autoRefresh: !!data.gh_auto_refresh,
  };
}

async function saveSettings(patch) {
  await chrome.storage.local.set(patch);
}

/** Fetch recent workflow runs for owner/repo. Throws with a friendly message. */
async function fetchRuns({ token, owner, repo }) {
  const url = `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=${PER_PAGE}`;
  let res;
  try {
    res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch {
    throw new Error('Network error — could not reach api.github.com.');
  }
  if (res.status === 401) throw new Error('Unauthorized — check your personal access token.');
  if (res.status === 403) throw new Error('Forbidden — token may lack the "repo" scope or hit a rate limit.');
  if (res.status === 404) throw new Error('Repository not found — check owner/name and token access.');
  if (!res.ok) throw new Error(`GitHub API error ${res.status}.`);
  const data = await res.json();
  return data.workflow_runs || [];
}

/** Map (status, conclusion) to a badge class + label. */
function badgeFor(run) {
  if (run.status === 'in_progress') return { cls: 'running', label: 'Running', pulse: true };
  if (run.status === 'queued' || run.status === 'waiting' || run.status === 'requested')
    return { cls: 'queued', label: 'Queued' };
  if (run.status === 'pending') return { cls: 'queued', label: 'Pending' };
  switch (run.conclusion) {
    case 'success': return { cls: 'success', label: 'Passed' };
    case 'failure': return { cls: 'failure', label: 'Failed' };
    case 'cancelled': return { cls: 'queued', label: 'Cancelled' };
    case 'skipped': return { cls: 'queued', label: 'Skipped' };
    case 'timed_out':
    case 'startup_failure':
    case 'action_required':
    case 'stale': return { cls: 'warning', label: run.conclusion.replace(/_/g, ' ') };
    default: return { cls: 'queued', label: run.conclusion || run.status };
  }
}

/** Human-friendly relative time. */
function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1d ago' : `${days}d ago`;
}

/** Escape HTML for user-controlled strings (workflow names etc.). */
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function renderRuns(runs) {
  if (!runs.length) {
    runsList.innerHTML = '<div class="empty-state">No workflow runs found for this repository yet.</div>';
    return;
  }
  runsList.innerHTML = runs.map((run) => {
    const badge = badgeFor(run);
    const name = esc(run.name || run.display_title || 'Workflow run');
    return `
      <a class="run-card" href="${esc(run.html_url)}" target="_blank" rel="noopener">
        <div class="run-top">
          <span class="run-name">${name}</span>
          <span class="badge ${badge.cls}">${badge.pulse ? '<span class="pulse-dot"></span>' : ''}${esc(badge.label)}</span>
        </div>
        <div class="run-meta">
          <span class="mono">#${esc(run.run_number)}</span>
          <span class="mono">${esc(run.head_branch || '')}</span>
          <span>${esc(run.event || '')}</span>
          <span>${esc(relativeTime(run.created_at))}</span>
        </div>
      </a>`;
  }).join('');
}

function setStatus(el, msg, kind = '') {
  el.textContent = msg;
  el.className = `status-line ${kind}`;
}

/** Refresh the list from the API and cache the result for the background ticker. */
async function refresh(silent = false) {
  const settings = await loadSettings();
  if (!settings.token || !settings.owner || !settings.repo) {
    setStatus(runsStatus, 'Add your token and repository in Settings to start.', '');
    renderRuns([]);
    repoLabel.textContent = 'Not configured';
    return;
  }
  repoLabel.textContent = `${settings.owner}/${settings.repo}`;
  if (!silent) {
    refreshBtn.disabled = true;
    setStatus(runsStatus, 'Refreshing…');
  }
  try {
    const runs = await fetchRuns(settings);
    renderRuns(runs);
    setStatus(runsStatus, '');
    const now = Date.now();
    lastCheckedEl.textContent = `Checked ${new Date(now).toLocaleTimeString()}`;
    // Cache for the background alarm + badge logic.
    await saveSettings({ gh_last_runs: runs, gh_last_check: now });
    await updateBadge(runs);
  } catch (err) {
    setStatus(runsStatus, err.message, 'error');
  } finally {
    refreshBtn.disabled = false;
  }
}

/** Toolbar badge: red count of failed runs (latest page), cleared when zero. */
async function updateBadge(runs) {
  const failed = runs.filter((r) => r.conclusion === 'failure').length;
  if (failed > 0) {
    await chrome.action.setBadgeText({ text: String(failed) });
    await chrome.action.setBadgeBackgroundColor({ color: '#f85149' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

async function applyAutoRefreshSetting(enabled) {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (enabled && !existing) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 5 });
  } else if (!enabled && existing) {
    await chrome.alarms.clear(ALARM_NAME);
  }
}

// ---- Events ----
settingsToggle.addEventListener('click', () => settingsPanel.classList.toggle('hidden'));

tokenVisibility.addEventListener('click', () => {
  tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
});

saveBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  const owner = ownerInput.value.trim();
  const repo = repoInput.value.trim();
  const autoRefresh = autoRefreshInput.checked;
  if (!token || !owner || !repo) {
    setStatus(settingsStatus, 'Token, owner and repository are all required.', 'error');
    return;
  }
  saveBtn.disabled = true;
  setStatus(settingsStatus, 'Testing connection…');
  try {
    await fetchRuns({ token, owner, repo }); // validates before persisting
    await saveSettings({ gh_token: token, gh_owner: owner, gh_repo: repo, gh_auto_refresh: autoRefresh });
    await applyAutoRefreshSetting(autoRefresh);
    setStatus(settingsStatus, 'Connected — token saved on this device only.', 'ok');
    settingsPanel.classList.add('hidden');
    await refresh();
  } catch (err) {
    setStatus(settingsStatus, err.message, 'error');
  } finally {
    saveBtn.disabled = false;
  }
});

clearBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove(['gh_token', 'gh_owner', 'gh_repo', 'gh_auto_refresh', 'gh_last_runs', 'gh_last_check']);
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.action.setBadgeText({ text: '' });
  tokenInput.value = ''; ownerInput.value = ''; repoInput.value = ''; autoRefreshInput.checked = false;
  setStatus(settingsStatus, 'Token forgotten — all credentials removed from this device.', 'ok');
  repoLabel.textContent = 'Not configured';
  renderRuns([]);
});

autoRefreshInput.addEventListener('change', async () => {
  await saveSettings({ gh_auto_refresh: autoRefreshInput.checked });
  await applyAutoRefreshSetting(autoRefreshInput.checked);
});

refreshBtn.addEventListener('click', () => refresh());

// ---- Init ----
(async function init() {
  const settings = await loadSettings();
  tokenInput.value = settings.token;
  ownerInput.value = settings.owner;
  repoInput.value = settings.repo;
  autoRefreshInput.checked = settings.autoRefresh;

  const { gh_last_runs, gh_last_check } = await chrome.storage.local.get(['gh_last_runs', 'gh_last_check']);
  if (settings.token && settings.owner && settings.repo) {
    repoLabel.textContent = `${settings.owner}/${settings.repo}`;
    if (Array.isArray(gh_last_runs) && gh_last_check && Date.now() - gh_last_check < 5 * 60 * 1000) {
      // Fresh cache: render instantly, then refresh quietly in the background.
      renderRuns(gh_last_runs);
      lastCheckedEl.textContent = `Checked ${new Date(gh_last_check).toLocaleTimeString()}`;
      refresh(true);
    } else {
      await refresh();
    }
  } else {
    settingsPanel.classList.remove('hidden');
  }
})();
