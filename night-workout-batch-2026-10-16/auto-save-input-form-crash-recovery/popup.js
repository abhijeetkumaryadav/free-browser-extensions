// Form Saver popup logic.
//
// - Toggles Form Saver for the current origin (stored in local storage).
// - Injects content.js on explicit toggle so newly-enabled pages start
//   snapshotting immediately.
// - Reads the current page's snapshot and offers one-click restore / discard.
// - "Clear all" wipes every snapshot from session storage.

const $ = (id) => document.getElementById(id);
const els = {
  toggle: $('enabledToggle'),
  card: $('snapshotCard'),
  empty: $('emptyCard'),
  info: $('snapInfo'),
  count: $('countInfo'),
  restore: $('restoreBtn'),
  clearSnap: $('clearSnapBtn'),
  clearAll: $('clearAllBtn'),
  status: $('status'),
};

let activeTab = null;
let currentSnapshot = null;

function flash(msg, ok = true) {
  els.status.textContent = msg;
  els.status.className = 'status' + (ok ? ' ok' : '');
  setTimeout(() => { els.status.textContent = ''; els.status.className = 'status'; }, 3000);
}

// Guard: content scripts can't run on internal pages.
function injectable(url = '') {
  return /^https?:\/\//.test(url);
}

// Ensure content.js is present in the tab (boot-once via a page flag).
async function ensureContent(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__formsaverLoaded === true,
  });
  if (!result) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  }
}

// Ask the content script for this page's snapshot.
async function fetchSnapshot(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'FORMSAVER_GET_SNAPSHOT' });
    return res && res.snapshot ? res.snapshot : null;
  } catch {
    return null;
  }
}

function renderSnapshot() {
  const has = !!currentSnapshot;
  els.card.classList.toggle('hidden', !has);
  els.empty.classList.toggle('hidden', has);
  if (has) {
    const n = Object.keys(currentSnapshot.fields).length;
    const when = new Date(currentSnapshot.savedAt).toLocaleTimeString();
    els.info.textContent = `${n} field${n === 1 ? '' : 's'} · saved ${when}`;
  }
}

async function refreshCount() {
  const all = await chrome.storage.session.get(null);
  const n = Object.keys(all).filter((k) => k.startsWith('formsaver:')).length;
  els.count.textContent = n === 0 ? 'No snapshots stored' : `${n} page${n === 1 ? '' : 's'}`;
}

async function refresh() {
  if (!activeTab || !injectable(activeTab.url)) {
    currentSnapshot = null;
    renderSnapshot();
    await refreshCount();
    return;
  }
  const { enabledOrigins = [] } = await chrome.storage.local.get('enabledOrigins');
  const origin = new URL(activeTab.url).origin;
  els.toggle.checked = enabledOrigins.includes(origin);
  if (els.toggle.checked) {
    try {
      await ensureContent(activeTab.id);
      currentSnapshot = await fetchSnapshot(activeTab.id);
    } catch {
      currentSnapshot = null;
    }
  } else {
    currentSnapshot = null;
  }
  renderSnapshot();
  await refreshCount();
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab || null;

  els.toggle.addEventListener('change', async () => {
    if (!activeTab || !injectable(activeTab.url)) {
      els.toggle.checked = false;
      flash('Form Saver only works on regular web pages.', false);
      return;
    }
    const origin = new URL(activeTab.url).origin;
    const { enabledOrigins = [] } = await chrome.storage.local.get('enabledOrigins');
    const next = els.toggle.checked
      ? [...new Set([...enabledOrigins, origin])]
      : enabledOrigins.filter((o) => o !== origin);
    await chrome.storage.local.set({ enabledOrigins: next });
    if (els.toggle.checked) {
      await ensureContent(activeTab.id).catch(() => {});
      flash('Enabled — typing on this site is now snapshotted.');
    } else {
      flash('Disabled for this site. Existing snapshots kept until cleared.');
    }
    await refresh();
  });

  els.restore.addEventListener('click', async () => {
    if (!currentSnapshot) return;
    try {
      const res = await chrome.tabs.sendMessage(activeTab.id, {
        type: 'FORMSAVER_RESTORE',
        snapshot: currentSnapshot,
      });
      flash(`Restored ${res.restored} field${res.restored === 1 ? '' : 's'}.`);
    } catch {
      flash('Could not reach the page — reload it and try again.', false);
    }
  });

  els.clearSnap.addEventListener('click', async () => {
    try {
      await chrome.tabs.sendMessage(activeTab.id, { type: 'FORMSAVER_CLEAR' });
    } catch { /* page may be gone */ }
    currentSnapshot = null;
    renderSnapshot();
    await refreshCount();
    flash('Snapshot discarded.');
  });

  els.clearAll.addEventListener('click', async () => {
    const all = await chrome.storage.session.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith('formsaver:'));
    if (keys.length > 0) await chrome.storage.session.remove(keys);
    currentSnapshot = null;
    renderSnapshot();
    await refreshCount();
    flash('All snapshots cleared.');
  });

  await refresh();
}

main().catch((e) => flash('Error: ' + e.message, false));
