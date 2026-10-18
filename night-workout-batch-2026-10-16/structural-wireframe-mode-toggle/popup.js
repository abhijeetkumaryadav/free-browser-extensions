/* Popup logic: toggle wireframe mode on the active tab, persist options. */
const toggle = document.getElementById('toggle');
const optLabels = document.getElementById('optLabels');
const optDims = document.getElementById('optDims');
const elCount = document.getElementById('elCount');

function setSwitch(on) { toggle.setAttribute('aria-checked', String(on)); }

// Inject the content script, then ask it to apply the current settings.
async function apply() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  const enabled = toggle.getAttribute('aria-checked') === 'true';
  const res = await chrome.tabs.sendMessage(tab.id, {
    type: 'SW_APPLY',
    enabled,
    showLabels: optLabels.checked,
    showDims: optDims.checked,
  }).catch(() => null);
  if (res && typeof res.count === 'number') elCount.textContent = res.count;
}

chrome.storage.local.get({ swLabels: true, swDims: true }, (d) => {
  optLabels.checked = d.swLabels;
  optDims.checked = d.swDims;
});

toggle.addEventListener('click', async () => {
  setSwitch(toggle.getAttribute('aria-checked') !== 'true');
  await apply();
});

[optLabels, optDims].forEach((box) => {
  box.addEventListener('change', () => {
    chrome.storage.local.set({ swLabels: optLabels.checked, swDims: optDims.checked });
    apply();
  });
});

// Reflect current page state when the popup opens.
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  const res = await chrome.tabs.sendMessage(tab.id, { type: 'SW_STATE' }).catch(() => null);
  if (res) {
    setSwitch(!!res.enabled);
    if (typeof res.count === 'number') elCount.textContent = res.count;
  }
})();
