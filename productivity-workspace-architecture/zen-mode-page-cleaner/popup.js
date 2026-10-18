/* Zen Mode Page Cleaner — popup logic.
 * Injects the content script on demand, toggles the reader view,
 * and pushes theme / font-size / width changes live. */

'use strict';

const $ = (id) => document.getElementById(id);

const noticeEl = $('notice');
const toggleBtn = $('toggle');
const toggleLabel = $('toggle-label');
const segBtns = [...document.querySelectorAll('.seg')];
const fontSizeInput = $('font-size');
const fontVal = $('font-val');
const lineWidthInput = $('line-width');
const widthVal = $('width-val');

const DEFAULTS = { theme: 'sepia', fontSize: 18, width: 680 };

let tabId = null;
let settings = { ...DEFAULTS };
let isActive = false;
let injectable = false;

function showNotice(text) {
  noticeEl.textContent = text;
  noticeEl.classList.remove('hidden');
}

function send(type) {
  return chrome.tabs.sendMessage(tabId, { type, settings });
}

function paintControls() {
  segBtns.forEach((b) => b.classList.toggle('active', b.dataset.theme === settings.theme));
  fontSizeInput.value = settings.fontSize;
  fontVal.textContent = settings.fontSize + 'px';
  lineWidthInput.value = settings.width;
  widthVal.textContent = settings.width + 'px';
}

function paintToggle() {
  toggleBtn.disabled = !injectable;
  toggleLabel.textContent = isActive ? 'Exit Zen Mode' : 'Enter Zen Mode';
  toggleBtn.classList.toggle('exit', isActive);
}

async function persist() {
  await chrome.storage.local.set({ zenSettings: settings });
}

async function init() {
  try {
    settings = { ...DEFAULTS, ...(await chrome.storage.local.get('zenSettings')).zenSettings };
  } catch (_) { /* storage unavailable — use defaults */ }
  paintControls();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/^https?:\/\//.test(tab.url)) {
    showNotice('Open a regular web page, then open this popup again. Zen Mode can\u2019t run on browser pages like chrome://.');
    paintToggle();
    return;
  }
  tabId = tab.id;

  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    injectable = true;
    const state = await chrome.tabs.sendMessage(tabId, { type: 'getState' });
    isActive = !!(state && state.active);
  } catch (e) {
    showNotice('Could not reach this page. Reload it and try again.');
  }
  paintToggle();
}

toggleBtn.addEventListener('click', async () => {
  if (!injectable) return;
  toggleBtn.disabled = true;
  try {
    const res = await send(isActive ? 'disable' : 'enable');
    if (res && res.ok) isActive = res.active;
  } catch (e) {
    showNotice('Could not reach this page. Reload it and try again.');
  }
  paintToggle();
});

segBtns.forEach((b) => {
  b.addEventListener('click', async () => {
    settings.theme = b.dataset.theme;
    paintControls();
    await persist();
    if (isActive) send('update').catch(() => {});
  });
});

fontSizeInput.addEventListener('input', async () => {
  settings.fontSize = Number(fontSizeInput.value);
  fontVal.textContent = settings.fontSize + 'px';
  await persist();
  if (isActive) send('update').catch(() => {});
});

lineWidthInput.addEventListener('input', async () => {
  settings.width = Number(lineWidthInput.value);
  widthVal.textContent = settings.width + 'px';
  await persist();
  if (isActive) send('update').catch(() => {});
});

document.addEventListener('DOMContentLoaded', init);
