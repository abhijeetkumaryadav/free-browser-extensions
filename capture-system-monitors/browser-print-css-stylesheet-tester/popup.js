/* PrintPeek — popup.js
 * Toggles a print-simulation stylesheet on the ACTIVE TAB via
 * chrome.scripting (user gesture only). All injected functions are fully
 * self-contained: they receive (styleId, options) as arguments and touch
 * nothing from the popup scope.
 */

'use strict';

const STYLE_ID = 'printpeek-sim-style';
const STORE_KEY = 'printpeek-options';

// ---------- Injected functions (must stay self-contained) ----------

// Applies the print-simulation <style> to the page. Options:
// { hideNav, showUrls, hideOverlays }
function applyPrintSim(styleId, opts) {
  // Remove any previous layer first (idempotent).
  const old = document.getElementById(styleId);
  if (old) old.remove();

  const rules = [];
  // Base print look: white page, dark ink, no shadows.
  rules.push(
    'html#printpeek-sim { background: #fff !important; }',
    'html#printpeek-sim body { background: #fff !important; color: #111 !important; }',
    'html#printpeek-sim * { box-shadow: none !important; text-shadow: none !important; }',
    'html#printpeek-sim body, html#printpeek-sim p, html#printpeek-sim li, ' +
      'html#printpeek-sim h1, html#printpeek-sim h2, html#printpeek-sim h3, ' +
      'html#printpeek-sim h4, html#printpeek-sim h5, html#printpeek-sim h6, ' +
      'html#printpeek-sim td, html#printpeek-sim th, html#printpeek-sim blockquote ' +
      '{ color: #111 !important; }',
    'html#printpeek-sim a { color: #111 !important; text-decoration: underline !important; }'
  );
  if (opts.hideNav) {
    rules.push(
      'html#printpeek-sim nav, html#printpeek-sim aside, ' +
        'html#printpeek-sim .sidebar, html#printpeek-sim [role="complementary"], ' +
        'html#printpeek-sim .site-nav, html#printpeek-sim .main-nav ' +
        '{ display: none !important; }'
    );
  }
  if (opts.hideOverlays) {
    rules.push(
      'html#printpeek-sim .ads, html#printpeek-sim .ad, html#printpeek-sim .advertisement, ' +
        'html#printpeek-sim [id*="cookie"], html#printpeek-sim [class*="cookie-banner"], ' +
        'html#printpeek-sim .modal-backdrop, html#printpeek-sim .popup-overlay ' +
        '{ display: none !important; }'
    );
  }
  if (opts.showUrls) {
    rules.push(
      'html#printpeek-sim a[href^="http"]:after { content: " (" attr(href) ")"; ' +
        'font-size: 0.85em; color: #444 !important; word-break: break-all; }'
    );
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = rules.join('\n');
  document.documentElement.appendChild(style);
  document.documentElement.id = 'printpeek-sim';
  return true;
}

// Removes the simulation layer exactly.
function removePrintSim(styleId) {
  const el = document.getElementById(styleId);
  if (el) el.remove();
  if (document.documentElement.id === 'printpeek-sim') {
    document.documentElement.removeAttribute('id');
  }
  return true;
}

// Returns true when the simulation layer is present on the page.
function probePrintSim(styleId) {
  return !!document.getElementById(styleId);
}

// Opens the browser's real print dialog in the tab.
function openRealPrint() {
  window.print();
  return true;
}

// ---------- Popup logic ----------
const $ = (id) => document.getElementById(id);
const btnToggle = $('btnToggle'), btnToggleLabel = $('btnToggleLabel');
const btnPrint = $('btnPrint'), statePill = $('statePill'), errorMsg = $('errorMsg');

const optButtons = {
  hideNav: $('optHideNav'),
  showUrls: $('optShowUrls'),
  hideOverlays: $('optHideOverlays'),
};
let options = { hideNav: true, showUrls: true, hideOverlays: true };
let simActive = false;

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
}
function clearError() {
  errorMsg.textContent = '';
  errorMsg.classList.add('hidden');
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('No active tab found.');
  if (/^(chrome|edge|about|chrome-extension):/.test(tab.url || '')) {
    throw new Error('This page is restricted — switch to a regular website tab.');
  }
  return tab;
}

async function runInTab(func, args) {
  const tab = await getActiveTab();
  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func,
    args,
  });
  return res && res.result;
}

function render() {
  btnToggleLabel.textContent = simActive ? 'Remove print simulation' : 'Apply print simulation';
  statePill.textContent = simActive ? 'Simulating' : 'Idle';
  statePill.classList.toggle('active', simActive);
  for (const [key, btn] of Object.entries(optButtons)) {
    btn.classList.toggle('on', !!options[key]);
    btn.setAttribute('aria-checked', String(!!options[key]));
  }
}

async function refreshState() {
  try {
    simActive = !!(await runInTab(probePrintSim, [STYLE_ID]));
  } catch {
    simActive = false; // restricted tab etc.
  }
  render();
}

async function applyOptions() {
  const stored = await chrome.storage.local.get(STORE_KEY);
  if (stored[STORE_KEY]) options = { ...options, ...stored[STORE_KEY] };
}

async function saveOptions() {
  await chrome.storage.local.set({ [STORE_KEY]: options });
}

// ---------- Events ----------
btnToggle.addEventListener('click', async () => {
  clearError();
  try {
    if (simActive) {
      await runInTab(removePrintSim, [STYLE_ID]);
    } else {
      await runInTab(applyPrintSim, [STYLE_ID, options]);
    }
    simActive = !simActive;
    render();
  } catch (err) {
    showError(err.message || String(err));
  }
});

btnPrint.addEventListener('click', async () => {
  clearError();
  try {
    await runInTab(openRealPrint, []);
    window.close();
  } catch (err) {
    showError(err.message || String(err));
  }
});

for (const [key, btn] of Object.entries(optButtons)) {
  btn.addEventListener('click', async () => {
    options[key] = !options[key];
    await saveOptions();
    render();
    // Re-apply live if the simulation is currently on.
    if (simActive) {
      try { await runInTab(applyPrintSim, [STYLE_ID, options]); }
      catch (err) { showError(err.message || String(err)); }
    }
  });
}

// ---------- Init ----------
(async () => {
  await applyOptions();
  await refreshState();
})();
