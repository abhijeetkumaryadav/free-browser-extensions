/* =====================================================================
 * XHR Request Firewall — popup logic
 *
 * Shows the active tab's request log, aggregates by domain, and lets
 * the user block/unblock domains for the current site. Policy changes
 * are pushed live to the page (no reload needed).
 * ===================================================================== */
'use strict';

const STORE_KEY = 'xrhfw';

let tabId = null;
let origin = '';
let pageHost = '';
let settings = { globalEnabled: true, sites: {} };
let pollTimer = null;

/** Read settings from storage. */
async function loadSettings() {
  const data = await chrome.storage.local.get(STORE_KEY);
  settings = data[STORE_KEY] || { globalEnabled: true, sites: {} };
}

/** Persist settings and push the fresh policy into the active tab. */
async function saveSettings() {
  await chrome.storage.local.set({ [STORE_KEY]: settings });
  if (tabId !== null) {
    chrome.tabs.sendMessage(tabId, { kind: 'xrhfw-policy-updated' }).catch(() => {});
  }
}

function sitePolicy() {
  return settings.sites[origin] || { blocked: [] };
}

function setSitePolicy(policy) {
  settings.sites[origin] = policy;
}

/** Ask the background worker for this tab's in-memory log. */
async function fetchLog() {
  try {
    const res = await chrome.runtime.sendMessage({ kind: 'xrhfw-get-log', tabId });
    return Array.isArray(res.log) ? res.log : [];
  } catch (_) {
    return [];
  }
}

function fmtTime(t) {
  return new Date(t).toLocaleTimeString([], { hour12: false });
}

/** Render stats, domain list, and the live log. */
function render(log) {
  const total = log.length;
  const blocked = log.filter((e) => e.blocked).length;
  const byHost = new Map();
  for (const e of log) {
    if (!byHost.has(e.host)) byHost.set(e.host, { count: 0, blocked: 0 });
    const g = byHost.get(e.host);
    g.count += 1;
    if (e.blocked) g.blocked += 1;
  }

  document.getElementById('statRequests').textContent = total;
  document.getElementById('statBlocked').textContent = blocked;
  document.getElementById('statDomains').textContent = byHost.size;

  const policy = sitePolicy();
  const blockedSet = new Set(policy.blocked || []);

  // ---- domain list (most requests first) ----
  const list = document.getElementById('domainList');
  list.innerHTML = '';
  if (byHost.size === 0) {
    list.innerHTML = '<p class="empty">No requests observed yet on this tab.</p>';
  } else {
    const sorted = [...byHost.entries()].sort((a, b) => b[1].count - a[1].count);
    for (const [host, g] of sorted) {
      const isBlocked = blockedSet.has(host);
      const row = document.createElement('div');
      row.className = 'domain-row' + (isBlocked ? ' is-blocked' : '');

      const name = document.createElement('span');
      name.className = 'domain-name';
      name.textContent = host;
      name.title = host;
      row.appendChild(name);

      if (host === pageHost) {
        const b = document.createElement('span');
        b.className = 'badge first';
        b.textContent = '1st party';
        row.appendChild(b);
      }
      const count = document.createElement('span');
      count.className = 'badge' + (g.blocked > 0 ? ' blocked-n' : '');
      count.textContent = g.blocked > 0 ? `${g.blocked} blocked` : `${g.count} req`;
      row.appendChild(count);

      const btn = document.createElement('button');
      btn.className = 'block-btn' + (isBlocked ? ' unblock' : '');
      btn.textContent = isBlocked ? 'Unblock' : 'Block';
      btn.addEventListener('click', async () => {
        const p = sitePolicy();
        const arr = Array.isArray(p.blocked) ? [...p.blocked] : [];
        if (isBlocked) {
          setSitePolicy({ blocked: arr.filter((d) => d !== host) });
        } else {
          arr.push(host);
          setSitePolicy({ blocked: arr });
        }
        await saveSettings();
        render(await fetchLog());
      });
      row.appendChild(btn);
      list.appendChild(row);
    }
  }

  // ---- live log (newest first, last 12) ----
  const live = document.getElementById('liveLog');
  live.innerHTML = '';
  const recent = log.slice(-12).reverse();
  if (recent.length === 0) {
    live.innerHTML = '<p class="empty">Waiting for requests…</p>';
  } else {
    for (const e of recent) {
      const row = document.createElement('div');
      row.className = 'log-row' + (e.blocked ? ' was-blocked' : '');
      const type = document.createElement('span');
      type.className = 'log-type';
      type.textContent = e.type;
      const host = document.createElement('span');
      host.className = 'log-host';
      host.textContent = e.host;
      host.title = e.url;
      const time = document.createElement('span');
      time.className = 'log-time';
      time.textContent = fmtTime(e.t);
      row.append(type, host, time);
      live.appendChild(row);
    }
  }
}

async function refresh() {
  render(await fetchLog());
}

/** Initialise the popup against the active tab. */
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/^https?:/.test(tab.url)) {
    document.getElementById('originLabel').textContent = 'Not a web page';
    document.getElementById('domainList').innerHTML =
      '<p class="empty">Open a regular http(s) page to use the firewall.</p>';
    return;
  }
  tabId = tab.id;
  const u = new URL(tab.url);
  origin = u.origin;
  pageHost = u.hostname;
  document.getElementById('originLabel').textContent = origin;

  await loadSettings();
  const master = document.getElementById('masterToggle');
  master.checked = settings.globalEnabled !== false;
  master.addEventListener('change', async () => {
    settings.globalEnabled = master.checked;
    await saveSettings();
  });

  document.getElementById('clearLog').addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ kind: 'xrhfw-clear-log', tabId });
    } catch (_) { /* ignore */ }
    refresh();
  });

  await refresh();
  // Keep the live log fresh while the popup is open.
  pollTimer = setInterval(refresh, 1500);
}

window.addEventListener('unload', () => {
  if (pollTimer) clearInterval(pollTimer);
});

document.addEventListener('DOMContentLoaded', init);
