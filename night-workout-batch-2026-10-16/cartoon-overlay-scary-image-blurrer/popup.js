/* BlurBuddy — popup logic.
   Sends commands to the content script in the active tab; persists settings locally. */

'use strict';

const clickModeEl = document.getElementById('clickMode');
const intensityEl = document.getElementById('intensity');
const intensityVal = document.getElementById('intensityVal');
const blurAllBtn = document.getElementById('blurAllBtn');
const unblurAllBtn = document.getElementById('unblurAllBtn');
const statusEl = document.getElementById('status');

const DEFAULTS = { clickMode: false, intensity: 12 };

function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', Boolean(isError));
}

/** Ensure the content script is present, then send it a command. */
async function sendCommand(action, payload) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/^https?:\/\//i.test(tab.url)) {
    throw new Error('Only regular http/https pages can be modified.');
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  const res = await chrome.tabs.sendMessage(tab.id, { type: 'blurBuddy', action, ...(payload || {}) });
  return res;
}

async function applyStateToPage() {
  const { clickMode, intensity } = await chrome.storage.local.get(DEFAULTS);
  try {
    await sendCommand('setState', { clickMode: Boolean(clickMode), intensity: Number(intensity) || 12 });
  } catch (err) {
    // Page may not accept messages (e.g. navigated away); surface quietly.
    setStatus(err.message || String(err), true);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const state = await chrome.storage.local.get(DEFAULTS);
  clickModeEl.checked = Boolean(state.clickMode);
  intensityEl.value = Number(state.intensity) || 12;
  intensityVal.textContent = `${intensityEl.value}px`;

  clickModeEl.addEventListener('change', async () => {
    await chrome.storage.local.set({ clickMode: clickModeEl.checked });
    setStatus(clickModeEl.checked ? 'Click-to-blur ON — click any image to blur it.' : 'Click-to-blur OFF.', false);
    await applyStateToPage();
  });

  intensityEl.addEventListener('input', () => {
    intensityVal.textContent = `${intensityEl.value}px`;
  });
  intensityEl.addEventListener('change', async () => {
    await chrome.storage.local.set({ intensity: Number(intensityEl.value) });
    await applyStateToPage();
  });

  blurAllBtn.addEventListener('click', async () => {
    try {
      const res = await sendCommand('blurAll', {});
      setStatus(`Blurred ${res && res.count !== undefined ? res.count : 'all'} images. Click any to reveal.`, false);
    } catch (err) {
      setStatus(err.message || String(err), true);
    }
  });

  unblurAllBtn.addEventListener('click', async () => {
    try {
      await sendCommand('unblurAll', {});
      setStatus('All images revealed.', false);
    } catch (err) {
      setStatus(err.message || String(err), true);
    }
  });

  // Push saved state to the page on open so the toggle reflects reality.
  await applyStateToPage();
  if (!statusEl.textContent) setStatus('Ready.', false);
});
