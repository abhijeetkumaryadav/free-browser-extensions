/* FaceBlur popup — drives the on-demand content script. */
const $ = id => document.getElementById(id);
const pickBtn = $('pickBtn'), pickHint = $('pickHint'), blurAllBtn = $('blurAllBtn'),
      restoreBtn = $('restoreBtn'), intensity = $('intensity'), intVal = $('intVal'),
      modeBlur = $('modeBlur'), modePixel = $('modePixel'),
      dot = $('dot'), statusText = $('statusText');

const DEFAULTS = { effect: 'blur', intensity: 12 };

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Ensure content.js is present in the tab, then send a message to it.
async function withContent(fn) {
  const tab = await activeTab();
  if (!tab || !tab.id || /^chrome:|^edge:|^about:|^moz-/.test(tab.url || '')) {
    setStatus('Cannot run on this page (browser internal page).');
    return null;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { cmd: 'ping' });
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    } catch (e) {
      setStatus('Could not access this page.');
      return null;
    }
  }
  try {
    return await fn(tab.id);
  } catch {
    setStatus('Lost connection to the page — reload and try again.');
    return null;
  }
}

function setStatus(text, on = false) {
  statusText.textContent = text;
  dot.classList.toggle('on', on);
}

async function refreshStatus() {
  const res = await withContent(tabId => chrome.tabs.sendMessage(tabId, { cmd: 'status' }));
  if (!res) return;
  updatePickUI(res.pickMode);
  setStatus(res.count ? `${res.count} image${res.count > 1 ? 's' : ''} blurred on this page` : 'Ready', res.count > 0);
}

function updatePickUI(on) {
  pickBtn.classList.toggle('armed', on);
  pickBtn.lastChild.textContent = on ? ' Stop picking' : ' Pick images on page';
  pickHint.classList.toggle('show', on);
}

// Pick-mode toggle
pickBtn.addEventListener('click', async () => {
  const turningOn = !pickBtn.classList.contains('armed');
  const res = await withContent(tabId => chrome.tabs.sendMessage(tabId, { cmd: 'pick', on: turningOn }));
  if (res) { updatePickUI(res.pickMode); setStatus(res.pickMode ? 'Pick mode: click images to toggle blur (Esc to stop)' : 'Ready', res.pickMode); }
});

// Listen for Esc-driven pick-off from the content script
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === '__faceblur-pick-off') { updatePickUI(false); setStatus('Ready'); }
});

// Effect segmented control
async function setEffect(effect) {
  modeBlur.classList.toggle('active', effect === 'blur');
  modePixel.classList.toggle('active', effect === 'pixelate');
  await chrome.storage.local.set({ fb_effect: effect });
  await withContent(tabId => chrome.tabs.sendMessage(tabId, { cmd: 'set-effect', effect }));
}
modeBlur.addEventListener('click', () => setEffect('blur'));
modePixel.addEventListener('click', () => setEffect('pixelate'));

// Intensity slider
intensity.addEventListener('input', () => {
  intVal.textContent = `${intensity.value}px`;
});
intensity.addEventListener('change', async () => {
  await chrome.storage.local.set({ fb_intensity: +intensity.value });
  await withContent(tabId => chrome.tabs.sendMessage(tabId, { cmd: 'set-intensity', value: +intensity.value }));
});

// Blur all / restore all
blurAllBtn.addEventListener('click', async () => {
  const res = await withContent(tabId => chrome.tabs.sendMessage(tabId, { cmd: 'blur-all' }));
  if (res) setStatus(`${res.count} image${res.count === 1 ? '' : 's'} blurred`, res.count > 0);
});
restoreBtn.addEventListener('click', async () => {
  await withContent(tabId => chrome.tabs.sendMessage(tabId, { cmd: 'restore-all' }));
  updatePickUI(false);
  setStatus('All images restored');
});

// Init: restore saved prefs, push to content script if already injected
(async () => {
  const prefs = await chrome.storage.local.get(DEFAULTS);
  const effect = prefs.fb_effect || DEFAULTS.effect;
  const val = prefs.fb_intensity || DEFAULTS.intensity;
  modeBlur.classList.toggle('active', effect === 'blur');
  modePixel.classList.toggle('active', effect === 'pixelate');
  intensity.value = val;
  intVal.textContent = `${val}px`;
  await withContent(async tabId => {
    try {
      await chrome.tabs.sendMessage(tabId, { cmd: 'set-effect', effect });
      await chrome.tabs.sendMessage(tabId, { cmd: 'set-intensity', value: val });
      const s = await chrome.tabs.sendMessage(tabId, { cmd: 'status' });
      updatePickUI(s.pickMode);
      setStatus(s.count ? `${s.count} image${s.count > 1 ? 's' : ''} blurred on this page` : 'Ready', s.count > 0);
    } catch { setStatus('Ready'); }
  });
})();
