/* Paint Splatter — popup logic (no content yet) */
'use strict';

const COLORS = ['#f472b6', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#818cf8', '#e879f9', '#f8fafc'];
const DEFAULTS = { color: '#f472b6', size: 24, spread: 14 };

const palette = document.getElementById('palette');
const sizeInput = document.getElementById('size');
const spreadInput = document.getElementById('spread');
const startBtn = document.getElementById('start');
const clearBtn = document.getElementById('clear');

// Build the color palette.
let activeColor = DEFAULTS.color;
COLORS.forEach(c => {
  const b = document.createElement('button');
  b.className = 'swatch' + (c === activeColor ? ' active' : '');
  b.style.background = c;
  b.setAttribute('aria-label', 'Paint color ' + c);
  b.addEventListener('click', () => {
    activeColor = c;
    document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s === b));
    saveSettings();
  });
  palette.appendChild(b);
});

async function saveSettings() {
  await chrome.storage.local.set({
    paintSettings: { color: activeColor, size: +sizeInput.value, spread: +spreadInput.value }
  });
}

async function loadSettings() {
  const { paintSettings } = await chrome.storage.local.get('paintSettings');
  const s = paintSettings || DEFAULTS;
  activeColor = s.color || DEFAULTS.color;
  sizeInput.value = s.size || DEFAULTS.size;
  spreadInput.value = s.spread || DEFAULTS.spread;
  document.querySelectorAll('.swatch').forEach(sw => {
    sw.classList.toggle('active', sw.getAttribute('aria-label').endsWith(activeColor));
  });
}

sizeInput.addEventListener('input', saveSettings);
spreadInput.addEventListener('input', saveSettings);

// Inject (or ping) the content script in the active tab.
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
      await chrome.tabs.sendMessage(tabId, { type: 'PAINT_START' });
    });
    window.close();
  } catch (e) { startBtn.textContent = 'Cannot paint on this page'; }
});

clearBtn.addEventListener('click', async () => {
  try {
    await withTab(async (tabId) => {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tabId, { type: 'PAINT_CLEAR' });
    });
    window.close();
  } catch (e) { clearBtn.textContent = 'Nothing to clear'; }
});

loadSettings();
