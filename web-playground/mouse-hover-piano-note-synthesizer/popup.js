/* HoverPiano popup logic — per-tab enable state, settings live in chrome.storage.local */
const $ = (id) => document.getElementById(id);
const toggle = $('toggle'), volume = $('volume'), volumeVal = $('volumeVal'), err = $('err'), tabHint = $('tabHint');
const segBtns = [...document.querySelectorAll('.seg-btn')];

const DEFAULTS = { volume: 50, scale: 'penta', enabledTabs: {} };

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
function showErr(msg) { err.textContent = msg; err.hidden = false; }
function clearErr() { err.hidden = true; }

function paintVolume() {
  volumeVal.textContent = volume.value + '%';
  volume.style.setProperty('--fill', volume.value + '%');
}

// Inject the hover synth into the tab (idempotent) and arm it.
async function enableOn(tab, settings) {
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['hover.js'] });
  } catch (e) {
    throw new Error('Cannot play on this page (restricted pages like chrome:// are off-limits).');
  }
  await chrome.tabs.sendMessage(tab.id, {
    type: 'hp-enable', volume: settings.volume / 100, scale: settings.scale,
  }).catch(() => { throw new Error('Could not reach the page. Try reloading it.'); });
}

async function disableOn(tab) {
  await chrome.tabs.sendMessage(tab.id, { type: 'hp-disable' }).catch(() => {});
}

async function pushSettings(tab, settings) {
  await chrome.tabs.sendMessage(tab.id, {
    type: 'hp-settings', volume: settings.volume / 100, scale: settings.scale,
  }).catch(() => {});
}

function setToggle(on) {
  toggle.setAttribute('aria-checked', String(on));
  tabHint.textContent = on ? 'Playing — hover page elements' : 'Enable, then hover page elements';
}

async function init() {
  const store = { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) };
  volume.value = store.volume;
  paintVolume();
  segBtns.forEach((b) => {
    const on = b.dataset.scale === store.scale;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
  });

  const tab = await activeTab();
  setToggle(!!(tab && store.enabledTabs[tab.id]));

  toggle.addEventListener('click', async () => {
    clearErr();
    const t = await activeTab();
    if (!t || t.id == null) { showErr('No active tab found.'); return; }
    const s = { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) };
    const isOn = toggle.getAttribute('aria-checked') === 'true';
    try {
      if (isOn) {
        await disableOn(t);
        delete s.enabledTabs[t.id];
      } else {
        await enableOn(t, s);
        s.enabledTabs[t.id] = { volume: s.volume, scale: s.scale };
      }
      await chrome.storage.local.set({ enabledTabs: s.enabledTabs });
      setToggle(!isOn);
    } catch (e) { showErr(e.message); }
  });

  volume.addEventListener('input', async () => {
    paintVolume();
    const v = Number(volume.value);
    await chrome.storage.local.set({ volume: v });
    const t = await activeTab();
    if (t && toggle.getAttribute('aria-checked') === 'true') pushSettings(t, { volume: v, scale: currentScale() });
  });

  segBtns.forEach((b) => b.addEventListener('click', async () => {
    segBtns.forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-checked', String(x === b)); });
    await chrome.storage.local.set({ scale: b.dataset.scale });
    const t = await activeTab();
    if (t && toggle.getAttribute('aria-checked') === 'true') pushSettings(t, { volume: Number(volume.value), scale: b.dataset.scale });
  }));

  // Clean up state for tabs that no longer exist.
  try {
    const ids = new Set((await chrome.tabs.query({})).map((t) => t.id));
    const kept = Object.fromEntries(Object.entries(store.enabledTabs).filter(([id]) => ids.has(Number(id))));
    if (Object.keys(kept).length !== Object.keys(store.enabledTabs).length) {
      await chrome.storage.local.set({ enabledTabs: kept });
    }
  } catch { /* non-fatal */ }
}

function currentScale() {
  const b = document.querySelector('.seg-btn.active');
  return b ? b.dataset.scale : 'penta';
}

init();
