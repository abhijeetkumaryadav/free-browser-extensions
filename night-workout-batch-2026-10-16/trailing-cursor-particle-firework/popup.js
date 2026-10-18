// Cursor Fireworks — popup controller.
// Sends start/stop + style commands to the active tab; persists prefs in storage.

const DEFAULTS = { style: 'sparkle', density: 5 };

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToTab(msg) {
  const tab = await activeTab();
  if (!tab || tab.id == null) return false;
  try {
    await chrome.tabs.sendMessage(tab.id, msg);
    return true;
  } catch (e) {
    // content script not injected yet — inject on demand, then retry
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tab.id, msg);
      return true;
    } catch (e2) { return false; }
  }
}

async function getPrefs() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return { style: s.style, density: s.density };
}

const toggleBtn = document.getElementById('toggle');
const toggleLabel = document.getElementById('toggleLabel');
let running = false;

async function setRunning(on) {
  running = on;
  toggleBtn.setAttribute('aria-pressed', String(on));
  toggleLabel.textContent = on ? 'Running — click to stop' : 'Start on this page';
}

toggleBtn.addEventListener('click', async () => {
  if (!running) {
    const prefs = await getPrefs();
    const ok = await sendToTab({ type: 'fw-start', style: prefs.style, density: prefs.density });
    if (ok) setRunning(true);
    else toggleLabel.textContent = 'Cannot run here (try another page)';
  } else {
    await sendToTab({ type: 'fw-stop' });
    setRunning(false);
  }
});

document.querySelectorAll('.style').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.style').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-checked', 'true');
    const style = btn.dataset.style;
    await chrome.storage.local.set({ style });
    if (running) sendToTab({ type: 'fw-style', style });
  });
});

const density = document.getElementById('density');
const densityVal = document.getElementById('densityVal');
density.addEventListener('input', async () => {
  densityVal.textContent = density.value;
  await chrome.storage.local.set({ density: Number(density.value) });
  if (running) sendToTab({ type: 'fw-density', density: Number(density.value) });
});

// restore prefs + live state
(async () => {
  const prefs = await getPrefs();
  document.querySelectorAll('.style').forEach(b => {
    const on = b.dataset.style === prefs.style;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
  });
  density.value = prefs.density;
  densityVal.textContent = prefs.density;
  const tab = await activeTab();
  if (tab && tab.id != null) {
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'fw-ping' });
      if (res && res.running) setRunning(true);
    } catch (e) { /* not injected yet */ }
  }
})();
