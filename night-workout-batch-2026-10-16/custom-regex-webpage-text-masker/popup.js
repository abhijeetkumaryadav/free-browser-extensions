/* Custom Regex Webpage Text Masker — popup logic.
   Manages user-defined patterns in chrome.storage.local and drives the
   on-demand content script that applies/removes masking. */
'use strict';

const els = {};
['maskBtn','rememberSite','pName','pRegex','pMode','pReplace','pError',
 'addBtn','patternList','noPatterns','pCount','startersBtn'].forEach(id => els[id] = document.getElementById(id));

const DEFAULT_REPLACE = '█████';
let masked = false;
let siteHost = '';

const STARTERS = [
  { name: 'Email', pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.]+', mode: 'blur', replacement: DEFAULT_REPLACE, enabled: true },
  { name: 'Phone (int.)', pattern: '\\+?\\d[\\d\\s().-]{7,}\\d', mode: 'blur', replacement: DEFAULT_REPLACE, enabled: true },
  { name: 'Card number', pattern: '\\b\\d{4}[ -]?\\d{4}[ -]?\\d{4}[ -]?\\d{4}\\b', mode: 'replace', replacement: '•••• •••• •••• ••••', enabled: true },
];

async function load() {
  const d = await chrome.storage.local.get({ patterns: [], maskedSites: {} });
  return d;
}

function isValidRegex(s) {
  try { new RegExp(s, 'g'); return true; }
  catch (e) { return false; }
}

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureMasker(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

async function sendCmd(cmd, payload = {}) {
  const tab = await getTab();
  if (!tab) return null;
  await ensureMasker(tab.id);
  try { return await chrome.tabs.sendMessage(tab.id, { cmd, ...payload }); }
  catch (e) { return null; }
}

function renderPatterns(patterns) {
  els.patternList.innerHTML = '';
  els.pCount.textContent = patterns.length ? `(${patterns.length})` : '';
  els.noPatterns.style.display = patterns.length ? 'none' : 'block';
  patterns.forEach((p, i) => {
    const li = document.createElement('li');
    const head = document.createElement('div'); head.className = 'phead';
    const name = document.createElement('span'); name.className = 'pname'; name.textContent = p.name;
    const sw = document.createElement('label'); sw.className = 'switch';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!p.enabled;
    cb.addEventListener('change', async () => {
      const d = await load(); d.patterns[i].enabled = cb.checked;
      await chrome.storage.local.set({ patterns: d.patterns });
      if (masked) applyMask(); // refresh masking live
    });
    const slider = document.createElement('span'); slider.className = 'slider';
    sw.append(cb, slider);
    const del = document.createElement('button'); del.className = 'del'; del.textContent = '🗑'; del.title = 'Delete pattern';
    del.addEventListener('click', async () => {
      const d = await load(); d.patterns.splice(i, 1);
      await chrome.storage.local.set({ patterns: d.patterns });
      renderPatterns(d.patterns);
      if (masked) applyMask();
    });
    head.append(name, sw, del);
    const rx = document.createElement('div'); rx.className = 'pregex'; rx.textContent = '/' + p.pattern + '/ → ' + (p.mode === 'blur' ? 'blur' : p.replacement || DEFAULT_REPLACE);
    li.append(head, rx);
    els.patternList.appendChild(li);
  });
}

async function applyMask() {
  const d = await load();
  const active = d.patterns.filter(p => p.enabled);
  const res = await sendCmd('mask:apply', { patterns: active });
  if (res && res.ok) {
    masked = true;
    els.maskBtn.textContent = 'Unmask page';
    els.maskBtn.classList.add('active');
  }
}

async function clearMask() {
  await sendCmd('mask:clear');
  masked = false;
  els.maskBtn.textContent = 'Mask on this page';
  els.maskBtn.classList.remove('active');
}

els.maskBtn.addEventListener('click', async () => {
  const newState = !masked; // desired masking state after this click
  newState ? applyMask() : clearMask();
  if (els.rememberSite.checked && siteHost) {
    const d = await load();
    const ms = d.maskedSites; ms[siteHost] = newState;
    await chrome.storage.local.set({ maskedSites: ms });
  }
});

els.addBtn.addEventListener('click', async () => {
  const name = els.pName.value.trim() || 'Untitled';
  const pattern = els.pRegex.value.trim();
  const mode = els.pMode.value;
  const replacement = els.pReplace.value.trim() || DEFAULT_REPLACE;
  els.pError.classList.add('hidden');
  if (!pattern) { els.pError.textContent = 'Enter a regex pattern.'; els.pError.classList.remove('hidden'); return; }
  if (!isValidRegex(pattern)) { els.pError.textContent = 'Invalid regex — check the syntax.'; els.pError.classList.remove('hidden'); return; }
  const d = await load();
  d.patterns.push({ name, pattern, mode, replacement, enabled: true });
  await chrome.storage.local.set({ patterns: d.patterns });
  els.pName.value = ''; els.pRegex.value = ''; els.pReplace.value = '';
  renderPatterns(d.patterns);
  if (masked) applyMask();
});

els.startersBtn.addEventListener('click', async () => {
  const d = await load();
  const existing = new Set(d.patterns.map(p => p.name));
  STARTERS.forEach(s => { if (!existing.has(s.name)) d.patterns.push({ ...s }); });
  await chrome.storage.local.set({ patterns: d.patterns });
  renderPatterns(d.patterns);
});

/* Init: show patterns, restore per-site masking preference. */
(async () => {
  const d = await load();
  renderPatterns(d.patterns);
  const tab = await getTab();
  if (tab && tab.url) {
    try {
      siteHost = new URL(tab.url).hostname;
      if (d.maskedSites[siteHost]) {
        els.rememberSite.checked = true;
        applyMask(); // auto-apply remembered masking
      }
    } catch (e) { /* non-web URL */ }
  }
})();
