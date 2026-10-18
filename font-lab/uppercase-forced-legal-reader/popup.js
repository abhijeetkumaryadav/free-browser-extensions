// CapsRead popup: toggles the uppercase display layer on the active tab.
'use strict';

// ---- Self-contained injected page function (serialized into the tab) ----
function setCapsRead(enabled, skipForms) {
  const STYLE_ID = 'capsread-uppercase-style';
  const old = document.getElementById(STYLE_ID);
  if (old) old.remove();
  if (!enabled) return false;
  const skip = skipForms
    ? ':not(input):not(textarea):not(select):not(code):not(pre):not(kbd)'
    : '';
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `body *:not(#${STYLE_ID})${skip} { text-transform: uppercase !important; }`;
  document.documentElement.appendChild(style);
  return true;
}

// ---- Popup wiring ----
const toggleBtn = document.getElementById('toggleBtn');
const toggleLabel = document.getElementById('toggleLabel');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const skipForms = document.getElementById('skipForms');

const STORAGE_KEYS = ['capsReadOn', 'capsReadSkipForms'];

chrome.storage.local.get(STORAGE_KEYS, ({ capsReadSkipForms }) => {
  if (typeof capsReadSkipForms === 'boolean') skipForms.checked = capsReadSkipForms;
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Probe whether the uppercase layer is currently active on the tab.
async function probeTab(tab) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => !!document.getElementById('capsread-uppercase-style'),
    });
    return !!res?.result;
  } catch {
    return null; // restricted page (chrome://, Web Store, etc.)
  }
}

function renderState(isOn, restricted) {
  if (restricted) {
    statusDot.classList.remove('on');
    statusText.textContent = 'Not available on this page';
    toggleLabel.textContent = 'Make this page UPPERCASE';
    toggleBtn.disabled = false;
    return;
  }
  statusDot.classList.toggle('on', isOn);
  statusText.textContent = isOn ? 'UPPERCASE layer is ON' : 'Page is normal';
  toggleLabel.textContent = isOn ? 'Restore normal text' : 'Make this page UPPERCASE';
}

async function refresh() {
  const tab = await getActiveTab();
  if (!tab || tab.url == null) { renderState(false, true); return; }
  const state = await probeTab(tab);
  renderState(state === true, state === null);
}

toggleBtn.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab) return;
  const currentlyOn = statusDot.classList.contains('on');
  const enable = !currentlyOn;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: setCapsRead,
      args: [enable, skipForms.checked],
    });
    chrome.storage.local.set({ capsReadOn: enable });
    renderState(enable, false);
  } catch {
    renderState(false, true);
  }
});

skipForms.addEventListener('change', async () => {
  chrome.storage.local.set({ capsReadSkipForms: skipForms.checked });
  // Re-apply the layer live if it is currently on.
  if (statusDot.classList.contains('on')) {
    const tab = await getActiveTab();
    if (!tab) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: setCapsRead,
        args: [true, skipForms.checked],
      });
    } catch { /* restricted page */ }
  }
});

refresh();
