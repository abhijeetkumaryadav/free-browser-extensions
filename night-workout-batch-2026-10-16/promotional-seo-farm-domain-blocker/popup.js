// SEO Farm Domain Blocker — popup logic.
// Manages the user's own domain blacklist (persisted in chrome.storage.local),
// injects content.js on explicit click only, and reports blocked results.

'use strict';

const domainInput = document.getElementById('domainInput');
const addBtn = document.getElementById('addBtn');
const domainList = document.getElementById('domainList');
const domainCount = document.getElementById('domainCount');
const scanBtn = document.getElementById('scanBtn');
const restoreBtn = document.getElementById('restoreBtn');
const statusEl = document.getElementById('status');
const blockList = document.getElementById('blockList');
const lifetimeEl = document.getElementById('lifetime');

// Normalize: lowercase, strip scheme/www/path/port.
function normalizeDomain(entry) {
  let d = entry.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/^www\./, '');
  d = d.split('/')[0].split(':')[0].trim();
  return d;
}

async function getBlacklist() {
  const { blacklist = [] } = await chrome.storage.local.get('blacklist');
  return blacklist;
}

async function setBlacklist(list) {
  await chrome.storage.local.set({ blacklist: list });
}

// Render the blacklist chips with per-domain remove buttons.
async function renderBlacklist() {
  const list = await getBlacklist();
  domainCount.textContent = list.length;
  domainList.innerHTML = '';
  for (const domain of list) {
    const li = document.createElement('li');
    li.textContent = domain;
    const remove = document.createElement('button');
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Remove ' + domain);
    remove.addEventListener('click', async () => {
      await setBlacklist((await getBlacklist()).filter((d) => d !== domain));
      renderBlacklist();
    });
    li.appendChild(remove);
    domainList.appendChild(li);
  }
}

async function addDomain() {
  const domain = normalizeDomain(domainInput.value);
  if (!domain || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    statusEl.textContent = 'Enter a valid domain, e.g. example.com';
    return;
  }
  const list = await getBlacklist();
  if (list.includes(domain)) {
    statusEl.textContent = `"${domain}" is already on your list.`;
    return;
  }
  list.push(domain);
  await setBlacklist(list);
  domainInput.value = '';
  statusEl.textContent = `Added "${domain}".`;
  renderBlacklist();
}

addBtn.addEventListener('click', addDomain);
domainInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addDomain();
});

// Pages the extension cannot touch.
function isRestricted(url) {
  return !url || /^(chrome|chrome-extension|edge|about|view-source|devtools):\/\//i.test(url);
}

async function withContentScript(type) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || isRestricted(tab.url)) {
    statusEl.textContent = 'Cannot run on this page (browser or internal page).';
    return null;
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const blacklist = await getBlacklist();
  return chrome.tabs.sendMessage(tab.id, { type, blacklist, mode });
}

function renderBlocked(blocked) {
  blockList.innerHTML = '';
  if (!blocked.length) {
    blockList.hidden = true;
    return;
  }
  blockList.hidden = false;
  for (const item of blocked) {
    const li = document.createElement('li');
    const title = document.createElement('div');
    title.className = 'flag-title';
    title.textContent = item.title;
    const reason = document.createElement('div');
    reason.className = 'flag-reason';
    reason.textContent = 'blocked domain: ' + item.domain;
    li.append(title, reason);
    blockList.appendChild(li);
  }
}

scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  statusEl.textContent = 'Blocking…';
  try {
    const blacklist = await getBlacklist();
    if (!blacklist.length) {
      statusEl.textContent = 'Your blacklist is empty — add a domain first.';
      return;
    }
    const res = await withContentScript('SEOFARM_SCAN');
    if (!res) return;
    renderBlocked(res.blocked);
    statusEl.textContent = res.blocked.length
      ? `Blocked ${res.blocked.length} result${res.blocked.length === 1 ? '' : 's'} from your domains.`
      : 'No results from your blacklisted domains on this page.';
    const { lifetime = 0 } = await chrome.storage.local.get('lifetime');
    await chrome.storage.local.set({ lifetime: lifetime + res.blocked.length });
    loadLifetime();
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
  } finally {
    scanBtn.disabled = false;
  }
});

restoreBtn.addEventListener('click', async () => {
  restoreBtn.disabled = true;
  statusEl.textContent = 'Restoring…';
  try {
    const res = await withContentScript('SEOFARM_RESTORE');
    if (!res) return;
    renderBlocked([]);
    statusEl.textContent = res.restored
      ? `Restored ${res.restored} result${res.restored === 1 ? '' : 's'} exactly.`
      : 'Nothing to restore.';
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
  } finally {
    restoreBtn.disabled = false;
  }
});

async function loadLifetime() {
  const { lifetime = 0 } = await chrome.storage.local.get('lifetime');
  lifetimeEl.textContent = lifetime;
}

// Restore the saved dim/collapse mode.
async function loadMode() {
  const { mode = 'dim' } = await chrome.storage.local.get('mode');
  const radio = document.querySelector(`input[name="mode"][value="${mode}"]`);
  if (radio) radio.checked = true;
}
document.querySelectorAll('input[name="mode"]').forEach((r) =>
  r.addEventListener('change', () => chrome.storage.local.set({ mode: r.value }))
);

renderBlacklist();
loadLifetime();
loadMode();
