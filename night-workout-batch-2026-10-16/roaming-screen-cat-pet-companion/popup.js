/* =========================================================================
 * Screen Cat — popup logic
 * Summons / dismisses the cat on the active tab via chrome.scripting.
 * Preferences persist in chrome.storage.local. Everything is local.
 * ========================================================================= */

const DEFAULTS = { color: '#f59e0b', size: 1, chase: true };

const $ = (id) => document.getElementById(id);
const statusEl = $('status');

/** Show a short-lived status message. */
function setStatus(msg) {
  statusEl.textContent = msg;
  clearTimeout(setStatus._t);
  setStatus._t = setTimeout(() => { statusEl.textContent = ''; }, 3200);
}

/** Active tab in the current window. */
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Load prefs into the controls. */
async function loadPrefs() {
  const p = await chrome.storage.local.get(DEFAULTS);
  document.querySelectorAll('.sw').forEach((b) => {
    b.classList.toggle('active', b.dataset.color === p.color);
  });
  $('size').value = p.size;
  $('chase').checked = p.chase;
  return p;
}

/** Read prefs from the controls and persist them. */
async function savePrefs() {
  const active = document.querySelector('.sw.active');
  const p = {
    color: active ? active.dataset.color : DEFAULTS.color,
    size: parseFloat($('size').value),
    chase: $('chase').checked,
  };
  await chrome.storage.local.set(p);
  return p;
}

$('swatches').addEventListener('click', async (e) => {
  const b = e.target.closest('.sw');
  if (!b) return;
  document.querySelectorAll('.sw').forEach((x) => x.classList.remove('active'));
  b.classList.add('active');
  await savePrefs();
});
$('size').addEventListener('change', savePrefs);
$('chase').addEventListener('change', savePrefs);

$('summon').addEventListener('click', async () => {
  const tab = await activeTab();
  if (!tab || !tab.id) { setStatus('No active tab found.'); return; }
  const prefs = await savePrefs();
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['cat.js'] });
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (p) => window.summonScreenCat(p),
      args: [prefs],
    });
    setStatus(result === 'already-present' ? 'Cat is already roaming here.' : 'Cat summoned! Enjoy.');
  } catch (err) {
    setStatus('Cannot run here (e.g. chrome:// or store pages).');
  }
});

$('dismiss').addEventListener('click', async () => {
  const tab = await activeTab();
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.dismissScreenCat(),
    });
    setStatus('Cat dismissed. It will miss you.');
  } catch (err) {
    setStatus('Nothing to dismiss on this tab.');
  }
});

loadPrefs();
