/* HTML Element Magnetic Repeller — popup logic.
   Persists strength/radius to chrome.storage.local and injects/removes the
   clone-overlay content script on the active tab. Page DOM is untouched. */

const DEFAULTS = { strength: 60, radius: 220, active: false };

// --- element refs ---
const toggleBtn = document.getElementById('toggle');
const strengthInput = document.getElementById('strength');
const radiusInput = document.getElementById('radius');
const strengthVal = document.getElementById('strengthVal');
const radiusVal = document.getElementById('radiusVal');

// --- state ---
let settings = { ...DEFAULTS };

// Apply settings object to the UI controls.
function render() {
  strengthInput.value = settings.strength;
  radiusInput.value = settings.radius;
  strengthVal.textContent = settings.strength;
  radiusVal.textContent = settings.radius + 'px';
  toggleBtn.textContent = settings.active ? 'Restore page' : 'Start repelling';
  toggleBtn.classList.toggle('stop', settings.active);
}

async function save() {
  await chrome.storage.local.set({ hemr: settings });
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
  await chrome.tabs.sendMessage(tabId, { action: 'hemr:start', settings });
  settings.active = true;
  await save();
  render();
}

// Stop: tell the content script to remove its overlay clones.
async function stop() {
  const tabId = await activeTabId();
  if (tabId) {
    try { await chrome.tabs.sendMessage(tabId, { action: 'hemr:stop' }); } catch (e) { /* tab gone */ }
  }
  settings.active = false;
  await save();
  render();
}

// --- wire up controls ---
strengthInput.addEventListener('change', async () => {
  settings.strength = Number(strengthInput.value);
  await save(); render();
  if (settings.active) await start(); // live-update a running repeller
});
radiusInput.addEventListener('change', async () => {
  settings.radius = Number(radiusInput.value);
  await save(); render();
  if (settings.active) await start();
});
toggleBtn.addEventListener('click', () => (settings.active ? stop() : start()));

// --- init: sync UI with stored settings and real tab state ---
(async function init() {
  const stored = await chrome.storage.local.get('hemr');
  if (stored.hemr) settings = { ...DEFAULTS, ...stored.hemr };
  // Reconcile: ask the active tab whether the overlay is actually alive.
  try {
    const tabId = await activeTabId();
    const alive = tabId && await chrome.tabs.sendMessage(tabId, { action: 'hemr:ping' }).catch(() => false);
    if (!alive && settings.active) { settings.active = false; await save(); }
  } catch (e) { /* ignore */ }
  render();
})();
