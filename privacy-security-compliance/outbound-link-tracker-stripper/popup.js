/* Outbound Link Tracker Stripper — popup logic.
 * Global toggle + per-site toggle + live session counters. All on-device. */

const enabledToggle = document.getElementById('enabledToggle');
const siteToggle = document.getElementById('siteToggle');
const siteHostEl = document.getElementById('siteHost');
const totalCountEl = document.getElementById('totalCount');
const siteListEl = document.getElementById('siteList');

let currentHost = null;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function getSettings() {
  return chrome.storage.local.get({ enabled: true, disabledSites: [] });
}

async function init() {
  const [{ enabled, disabledSites }, counts] = await Promise.all([
    getSettings(),
    chrome.runtime.sendMessage({ type: 'getCounts' }).catch(() => ({ total: 0, perSite: {} })),
  ]);

  enabledToggle.checked = enabled !== false;

  // Current site (best-effort via activeTab).
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      currentHost = new URL(tab.url).hostname;
      siteHostEl.textContent = currentHost;
      siteToggle.checked = !disabledSites.includes(currentHost);
    } else {
      siteHostEl.textContent = 'No site detected';
      siteToggle.disabled = true;
    }
  } catch {
    siteHostEl.textContent = 'No site detected';
    siteToggle.disabled = true;
  }

  renderCounts(counts);
}

function renderCounts(counts) {
  totalCountEl.textContent = counts.total || 0;
  const entries = Object.entries(counts.perSite || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  siteListEl.innerHTML = entries.length
    ? entries.map(([host, n]) =>
        `<div class="site-item"><span>${esc(host)}</span><span class="count">${n}</span></div>`).join('')
    : '<div class="empty-note">Nothing stripped yet — click some links.</div>';
}

enabledToggle.addEventListener('change', async () => {
  await chrome.storage.local.set({ enabled: enabledToggle.checked });
});

siteToggle.addEventListener('change', async () => {
  if (!currentHost) return;
  const { disabledSites = [] } = await getSettings();
  const next = siteToggle.checked
    ? disabledSites.filter((h) => h !== currentHost)
    : [...new Set([...disabledSites, currentHost])];
  await chrome.storage.local.set({ disabledSites: next });
});

document.getElementById('resetBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'resetCounts' }).catch(() => {});
  renderCounts({ total: 0, perSite: {} });
});

init();
