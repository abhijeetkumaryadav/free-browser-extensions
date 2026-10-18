/* Readability Font Scaler — popup logic.
   Per-site settings + global fallback, live preview via content-script
   messaging. All data stays on-device in chrome.storage.local.
   Permissions: "storage" (settings), "activeTab" (current site host). */

const DEFAULTS = { enabled: true, fontSize: 16, lineHeight: 1.6, fontFamily: 'sans' };

const els = {
  enabled: document.getElementById('enabled'),
  siteLabel: document.getElementById('siteLabel'),
  controls: document.getElementById('controls'),
  fontSize: document.getElementById('fontSize'),
  fontSizeVal: document.getElementById('fontSizeVal'),
  lineHeight: document.getElementById('lineHeight'),
  lineHeightVal: document.getElementById('lineHeightVal'),
  fontSeg: document.getElementById('fontSeg'),
  scopeSeg: document.getElementById('scopeSeg'),
  resetSite: document.getElementById('resetSite'),
  resetAll: document.getElementById('resetAll')
};

let host = '';
let tabId = null;
let scope = 'site';          // 'site' | 'global'
let settings = { ...DEFAULTS };

/* ---------- storage helpers ---------- */
async function readStore() {
  const data = await chrome.storage.local.get(['sites', 'global']);
  return { sites: data.sites || {}, global: data.global || null };
}

/* Effective settings = per-site entry, else global, else defaults. */
async function currentSettings() {
  const { sites, global } = await readStore();
  if (scope === 'site') return { ...(sites[host] || global || DEFAULTS) };
  return { ...(global || DEFAULTS) };
}

async function persist() {
  const { sites, global } = await readStore();
  if (scope === 'site') {
    sites[host] = { ...settings };
  } else {
    // save as the new global fallback
    await chrome.storage.local.set({ sites, global: { ...settings } });
    pushToPage();
    return;
  }
  await chrome.storage.local.set({ sites });
  pushToPage();
}

/* ---------- live preview: talk to the content script ---------- */
async function pushToPage() {
  if (tabId == null) return;
  try {
    if (settings.enabled) {
      await chrome.tabs.sendMessage(tabId, { type: 'rfs-apply', settings });
    } else {
      await chrome.tabs.sendMessage(tabId, { type: 'rfs-remove' });
    }
  } catch (e) {
    // content script not present (chrome:// pages, etc.) — nothing to update
  }
}

/* ---------- render ---------- */
function render() {
  els.enabled.checked = settings.enabled;
  els.controls.classList.toggle('disabled', !settings.enabled);
  els.fontSize.value = settings.fontSize;
  els.fontSizeVal.textContent = settings.fontSize + 'px';
  els.lineHeight.value = settings.lineHeight;
  els.lineHeightVal.textContent = Number(settings.lineHeight).toFixed(1);
  [...els.fontSeg.children].forEach(b =>
    b.classList.toggle('active', b.dataset.font === settings.fontFamily));
  [...els.scopeSeg.children].forEach(b =>
    b.classList.toggle('active', b.dataset.scope === scope));
}

/* ---------- events ---------- */
els.enabled.addEventListener('change', () => {
  settings.enabled = els.enabled.checked;
  persist().then(render);
});

els.fontSize.addEventListener('input', () => {
  settings.fontSize = Number(els.fontSize.value);
  els.fontSizeVal.textContent = settings.fontSize + 'px';
  debouncePersist();
});

els.lineHeight.addEventListener('input', () => {
  settings.lineHeight = Number(els.lineHeight.value);
  els.lineHeightVal.textContent = Number(settings.lineHeight).toFixed(1);
  debouncePersist();
});

els.fontSeg.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  settings.fontFamily = btn.dataset.font;
  persist().then(render);
});

els.scopeSeg.addEventListener('click', async e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  scope = btn.dataset.scope;
  settings = await currentSettings();
  render();
  pushToPage();
});

els.resetSite.addEventListener('click', async () => {
  const { sites, global } = await readStore();
  delete sites[host];
  await chrome.storage.local.set({ sites });
  settings = { ...(global || DEFAULTS) };
  render();
  pushToPage();
});

els.resetAll.addEventListener('click', async () => {
  await chrome.storage.local.set({ sites: {}, global: null });
  settings = { ...DEFAULTS };
  render();
  pushToPage();
});

/* debounce slider drags: preview instantly, persist on settle */
let debounceTimer = null;
function debouncePersist() {
  pushToPage();
  render();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(persist, 400);
}

/* ---------- init ---------- */
(async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      tabId = tab.id;
      host = new URL(tab.url).hostname;
      els.siteLabel.textContent = host;
    }
  } catch (e) {
    els.siteLabel.textContent = 'current site';
  }
  settings = await currentSettings();
  render();
})();
