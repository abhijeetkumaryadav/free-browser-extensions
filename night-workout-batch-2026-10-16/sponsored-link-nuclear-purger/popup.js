/* Sponsored Link Nuclear Purger — popup logic.
 *
 * Flow: inject content.js into the active tab on first use (guarded against
 * chrome:// pages), then talk to it with one-shot messages. All choices are
 * explicit: purge only runs when clicked, restore puts everything back.
 */

const $ = id => document.getElementById(id);
const purgeBtn = $('purgeBtn');
const restoreBtn = $('restoreBtn');
const statusEl = $('status');
const hitsEl = $('hits');
const modeDim = $('modeDim');
const modeCollapse = $('modeCollapse');

let mode = 'dim'; // persisted user preference

/** Load saved mode preference. */
chrome.storage.local.get({ purgerMode: 'dim' }).then(({ purgerMode }) => {
  mode = purgerMode === 'collapse' ? 'collapse' : 'dim';
  syncModeButtons();
});

function syncModeButtons() {
  modeDim.classList.toggle('active', mode === 'dim');
  modeCollapse.classList.toggle('active', mode === 'collapse');
}

modeDim.addEventListener('click', () => setMode('dim'));
modeCollapse.addEventListener('click', () => setMode('collapse'));
async function setMode(m) {
  mode = m;
  syncModeButtons();
  await chrome.storage.local.set({ purgerMode: m });
}

/** True when the tab is a browser-internal page we cannot touch. */
function isRestrictedTab(tab) {
  return !tab || !tab.url || /^(chrome|edge|about|chrome-extension|moz-extension):/.test(tab.url);
}

/** Inject the engine on demand; no-op if already injected (guarded there). */
async function ensureEngine(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

function showStatus(html) {
  statusEl.innerHTML = html;
  statusEl.classList.remove('hidden');
}

function renderHits(labels) {
  hitsEl.innerHTML = '';
  for (const label of labels) {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = '▸ ';
    li.appendChild(b);
    li.appendChild(document.createTextNode(label || '(unlabelled unit)'));
    hitsEl.appendChild(li);
  }
}

purgeBtn.addEventListener('click', async () => {
  purgeBtn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (isRestrictedTab(tab)) {
      showStatus('⚠️ Cannot run on browser-internal pages. Try a normal website tab.');
      return;
    }
    await ensureEngine(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, { cmd: 'purge', mode });
    if (!res || !res.ok) throw new Error(res && res.error || 'No response from page engine.');
    if (res.newly === 0) {
      showStatus(`<span class="big">0</span> sponsored cards found — page looks clean (heuristic scan).`);
    } else {
      showStatus(`<span class="big">${res.newly}</span> sponsored card${res.newly === 1 ? '' : 's'} ${mode === 'collapse' ? 'collapsed' : 'dimmed'} (${res.total} total hidden). Hit <b>Restore</b> to bring them back.`);
      renderHits(res.labels || []);
    }
  } catch (e) {
    showStatus(`⚠️ ${e.message}`);
  } finally {
    purgeBtn.disabled = false;
  }
});

restoreBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (isRestrictedTab(tab)) {
      showStatus('⚠️ Cannot touch browser-internal pages.');
      return;
    }
    await ensureEngine(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, { cmd: 'restore' });
    if (!res || !res.ok) throw new Error(res && res.error || 'No response from page engine.');
    showStatus(res.restored > 0
      ? `✅ Restored <b>${res.restored}</b> card${res.restored === 1 ? '' : 's'} — page is back to normal.`
      : 'Nothing to restore — no cards are currently hidden.');
    renderHits([]);
  } catch (e) {
    showStatus(`⚠️ ${e.message}`);
  }
});
