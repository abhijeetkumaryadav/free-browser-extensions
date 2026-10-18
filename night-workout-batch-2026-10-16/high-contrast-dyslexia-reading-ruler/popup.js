/* ReadRuler popup logic — settings live in chrome.storage.local, applied on demand. */
'use strict';

const DEFAULTS = {
  rulerEnabled: true,
  rulerHeight: 44,
  rulerOpacity: 35,
  rulerColor: '#22d3ee',
  dysEnabled: true,
  letterSpacing: 0.08,
  wordSpacing: 0.16,
  lineHeight: 1.8,
  fontStack: 'readable'
};

const $ = (id) => document.getElementById(id);
const els = {
  rulerToggle: $('rulerToggle'),
  dysToggle: $('dysToggle'),
  rulerHeight: $('rulerHeight'),
  rulerHeightVal: $('rulerHeightVal'),
  rulerOpacity: $('rulerOpacity'),
  rulerOpacityVal: $('rulerOpacityVal'),
  rulerColors: $('rulerColors'),
  letterSpacing: $('letterSpacing'),
  letterSpacingVal: $('letterSpacingVal'),
  wordSpacing: $('wordSpacing'),
  wordSpacingVal: $('wordSpacingVal'),
  lineHeight: $('lineHeight'),
  lineHeightVal: $('lineHeightVal'),
  fontStack: $('fontStack'),
  applyBtn: $('applyBtn'),
  removeBtn: $('removeBtn'),
  status: $('status')
};

let settings = { ...DEFAULTS };

/* ---------- ui helpers ---------- */
function setSwitch(el, on) { el.setAttribute('aria-checked', String(!!on)); }

function paint(settingsObj) {
  setSwitch(els.rulerToggle, settingsObj.rulerEnabled);
  setSwitch(els.dysToggle, settingsObj.dysEnabled);
  els.rulerHeight.value = settingsObj.rulerHeight;
  els.rulerHeightVal.textContent = settingsObj.rulerHeight + 'px';
  els.rulerOpacity.value = settingsObj.rulerOpacity;
  els.rulerOpacityVal.textContent = settingsObj.rulerOpacity + '%';
  els.letterSpacing.value = settingsObj.letterSpacing;
  els.letterSpacingVal.textContent = Number(settingsObj.letterSpacing).toFixed(2) + 'em';
  els.wordSpacing.value = settingsObj.wordSpacing;
  els.wordSpacingVal.textContent = Number(settingsObj.wordSpacing).toFixed(2) + 'em';
  els.lineHeight.value = settingsObj.lineHeight;
  els.lineHeightVal.textContent = Number(settingsObj.lineHeight).toFixed(1);
  els.fontStack.value = settingsObj.fontStack;
  els.rulerColors.querySelectorAll('.swatch').forEach((b) => {
    b.classList.toggle('selected', b.dataset.color === settingsObj.rulerColor);
  });
}

function flash(msg) {
  els.status.textContent = msg;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { els.status.textContent = ''; }, 2200);
}

async function save() {
  await chrome.storage.local.set({ readruler: settings });
}

/* ---------- events ---------- */
function bindToggle(el, key) {
  el.addEventListener('click', async () => {
    settings[key] = !settings[key];
    setSwitch(el, settings[key]);
    await save();
  });
}
bindToggle(els.rulerToggle, 'rulerEnabled');
bindToggle(els.dysToggle, 'dysEnabled');

function bindRange(input, valEl, key, fmt) {
  input.addEventListener('input', async () => {
    settings[key] = parseFloat(input.value);
    valEl.textContent = fmt(settings[key]);
    await save();
  });
}
bindRange(els.rulerHeight, els.rulerHeightVal, 'rulerHeight', (v) => v + 'px');
bindRange(els.rulerOpacity, els.rulerOpacityVal, 'rulerOpacity', (v) => v + '%');
bindRange(els.letterSpacing, els.letterSpacingVal, 'letterSpacing', (v) => v.toFixed(2) + 'em');
bindRange(els.wordSpacing, els.wordSpacingVal, 'wordSpacing', (v) => v.toFixed(2) + 'em');
bindRange(els.lineHeight, els.lineHeightVal, 'lineHeight', (v) => v.toFixed(1));

els.rulerColors.addEventListener('click', async (e) => {
  const btn = e.target.closest('.swatch');
  if (!btn) return;
  settings.rulerColor = btn.dataset.color;
  paint(settings);
  await save();
});

els.fontStack.addEventListener('change', async () => {
  settings.fontStack = els.fontStack.value;
  await save();
});

/* ---------- apply / remove ---------- */
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContent(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

els.applyBtn.addEventListener('click', async () => {
  try {
    const tab = await activeTab();
    if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) {
      flash('Open a normal web page first.');
      return;
    }
    await ensureContent(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: 'readruler-apply', settings });
    flash('Applied to this page.');
  } catch (err) {
    flash('Could not apply here.');
  }
});

els.removeBtn.addEventListener('click', async () => {
  try {
    const tab = await activeTab();
    if (!tab || !tab.id) { flash('No active tab.'); return; }
    await ensureContent(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: 'readruler-remove' });
    flash('Removed — page restored.');
  } catch (err) {
    flash('Nothing to remove.');
  }
});

/* ---------- init ---------- */
(async function init() {
  const stored = await chrome.storage.local.get('readruler');
  settings = { ...DEFAULTS, ...(stored.readruler || {}) };
  paint(settings);
})();
