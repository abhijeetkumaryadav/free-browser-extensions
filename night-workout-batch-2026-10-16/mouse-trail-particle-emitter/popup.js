/* Mouse Trail Particle Emitter — popup logic.
   Persists settings to chrome.storage.local and injects/removes the
   canvas-overlay content script on the active tab. Page DOM is untouched. */

const DEFAULTS = { style: 'sparkle', color: '#e879f9', intensity: 2, active: false };
const INTENSITY_NAMES = { 1: 'Gentle', 2: 'Medium', 3: 'Wild' };

// --- element refs ---
const toggleBtn = document.getElementById('toggle');
const styleSeg = document.getElementById('styleSeg');
const colorSwatches = document.getElementById('colorSwatches');
const intensityInput = document.getElementById('intensity');
const intensityVal = document.getElementById('intensityVal');

// --- state ---
let settings = { ...DEFAULTS };

// Apply settings object to the UI controls.
function render() {
  styleSeg.querySelectorAll('button').forEach(b =>
    b.classList.toggle('on', b.dataset.style === settings.style));
  colorSwatches.querySelectorAll('button').forEach(b =>
    b.classList.toggle('on', b.dataset.color === settings.color));
  intensityInput.value = settings.intensity;
  intensityVal.textContent = INTENSITY_NAMES[settings.intensity] || 'Medium';
  toggleBtn.textContent = settings.active ? 'Stop trail' : 'Start trail';
  toggleBtn.classList.toggle('stop', settings.active);
}

async function save() {
  await chrome.storage.local.set({ mtpe: settings });
}

// Send the current active tab id back to the caller.
async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab && tab.id;
}

// Start: inject content script (once) then send settings + start command.
async function start() {
  const tabId = await activeTabId();
  if (!tabId) return;
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  await chrome.tabs.sendMessage(tabId, { action: 'mtpe:start', settings });
  settings.active = true;
  await save();
  render();
}

// Stop: tell the content script to tear down its overlay.
async function stop() {
  const tabId = await activeTabId();
  if (tabId) {
    try { await chrome.tabs.sendMessage(tabId, { action: 'mtpe:stop' }); } catch (e) { /* tab gone */ }
  }
  settings.active = false;
  await save();
  render();
}

// --- wire up controls ---
styleSeg.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  settings.style = btn.dataset.style;
  await save(); render();
  if (settings.active) await start(); // live-update a running trail
});
colorSwatches.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  settings.color = btn.dataset.color;
  await save(); render();
  if (settings.active) await start();
});
intensityInput.addEventListener('change', async () => {
  settings.intensity = Number(intensityInput.value);
  await save(); render();
  if (settings.active) await start();
});
toggleBtn.addEventListener('click', () => (settings.active ? stop() : start()));

// --- init: sync UI with stored settings and real tab state ---
(async function init() {
  const stored = await chrome.storage.local.get('mtpe');
  if (stored.mtpe) settings = { ...DEFAULTS, ...stored.mtpe };
  // Reconcile: ask the active tab whether the overlay is actually alive.
  try {
    const tabId = await activeTabId();
    const alive = tabId && await chrome.tabs.sendMessage(tabId, { action: 'mtpe:ping' }).catch(() => false);
    if (!alive && settings.active) { settings.active = false; await save(); }
  } catch (e) { /* ignore */ }
  render();
})();
