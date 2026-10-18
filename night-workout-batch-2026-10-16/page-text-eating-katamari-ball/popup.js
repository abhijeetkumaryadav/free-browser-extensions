/* Katamari Text Muncher — popup logic */
'use strict';

const COLORS = ['#4ade80', '#f472b6', '#fb923c', '#22d3ee', '#a78bfa', '#facc15'];
const palette = document.getElementById('palette');
const sizeInput = document.getElementById('size');
const startBtn = document.getElementById('start');
const clearBtn = document.getElementById('clear');

let activeColor = COLORS[0];
COLORS.forEach(c => {
  const b = document.createElement('button');
  b.className = 'swatch' + (c === activeColor ? ' active' : '');
  b.style.background = c;
  b.setAttribute('aria-label', 'Ball color ' + c);
  b.addEventListener('click', () => {
    activeColor = c;
    document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s === b));
    saveSettings();
  });
  palette.appendChild(b);
});

async function saveSettings() {
  await chrome.storage.local.set({ katamariSettings: { color: activeColor, size: +sizeInput.value } });
}

async function loadSettings() {
  const { katamariSettings } = await chrome.storage.local.get('katamariSettings');
  const s = katamariSettings || {};
  activeColor = s.color || COLORS[0];
  sizeInput.value = s.size || 44;
  document.querySelectorAll('.swatch').forEach(sw =>
    sw.classList.toggle('active', sw.getAttribute('aria-label').endsWith(activeColor)));
}
sizeInput.addEventListener('input', saveSettings);

async function withTab(fn) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error('No active tab.');
  return fn(tab.id);
}

startBtn.addEventListener('click', async () => {
  try {
    await saveSettings();
    await withTab(async (tabId) => {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tabId, { type: 'KATAMARI_START' });
    });
    window.close();
  } catch (e) { startBtn.textContent = 'Cannot roll on this page'; }
});

clearBtn.addEventListener('click', async () => {
  try {
    await withTab(async (tabId) => {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tabId, { type: 'KATAMARI_RESET' });
    });
    window.close();
  } catch (e) { clearBtn.textContent = 'Nothing to reset'; }
});

loadSettings();
