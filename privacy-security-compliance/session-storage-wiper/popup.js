/* Session Storage Wiper — popup logic.
   Strictly user-initiated: nothing is wiped until the user arms + confirms.
   Uses chrome.browsingData.remove with an origins filter for per-site wipes. */

const els = {
  siteLine: document.getElementById('siteLine'),
  originLabel: document.getElementById('originLabel'),
  cookieCount: document.getElementById('cookieCount'),
  checks: [...document.querySelectorAll('.check input')],
  wipeSiteBtn: document.getElementById('wipeSiteBtn'),
  wipeAllBtn: document.getElementById('wipeAllBtn'),
  result: document.getElementById('result'),
};

let currentOrigin = null;
let currentTabUrl = null;

/** Build the browsingData removal options from checked boxes. */
function buildOptions() {
  const opts = {};
  els.checks.forEach(c => { if (c.checked) opts[c.dataset.type] = true; });
  return opts;
}

function showResult(text, ok = true) {
  els.result.hidden = false;
  els.result.className = 'result glass' + (ok ? ' ok' : '');
  els.result.textContent = text;
}

/** Two-step confirm arming: first click arms, second click (within 5s) fires. */
function armConfirm(button, armedLabel, onConfirm) {
  if (button.dataset.armed === '1') {
    clearTimeout(button._timer);
    delete button.dataset.armed;
    button.classList.remove('armed');
    button.textContent = button.dataset.label;
    onConfirm();
    return;
  }
  button.dataset.label = button.textContent;
  button.dataset.armed = '1';
  button.classList.add('armed');
  button.textContent = armedLabel;
  button._timer = setTimeout(() => {
    delete button.dataset.armed;
    button.classList.remove('armed');
    button.textContent = button.dataset.label;
  }, 5000);
}

// --- actions ----------------------------------------------------------------

async function wipeSite() {
  const opts = buildOptions();
  if (Object.keys(opts).length === 0) return showResult('Select at least one data type.', false);
  if (!currentOrigin) return showResult('No wipeable site origin (try a regular http/https page).', false);
  try {
    await chrome.browsingData.remove({ origins: [currentOrigin] }, opts);
    showResult(`Wiped ${Object.keys(opts).join(', ')} for ${currentOrigin}.`);
    refreshCookieCount();
  } catch (e) {
    showResult('Wipe failed: ' + e.message, false);
  }
}

async function wipeAll() {
  const opts = buildOptions();
  if (Object.keys(opts).length === 0) return showResult('Select at least one data type.', false);
  try {
    await chrome.browsingData.remove({}, opts); // empty options = all origins
    showResult(`Wiped ${Object.keys(opts).join(', ')} across all sites.`);
    refreshCookieCount();
  } catch (e) {
    showResult('Wipe failed: ' + e.message, false);
  }
}

els.wipeSiteBtn.addEventListener('click', () =>
  armConfirm(els.wipeSiteBtn, 'Click again to confirm', wipeSite));
els.wipeAllBtn.addEventListener('click', () =>
  armConfirm(els.wipeAllBtn, 'Really wipe ALL sites? Click again', wipeAll));

// --- init: current tab origin + cookie count ---------------------------------

async function refreshCookieCount() {
  if (!currentTabUrl) { els.cookieCount.textContent = ''; return; }
  try {
    const cookies = await chrome.cookies.getAll({ url: currentTabUrl });
    els.cookieCount.textContent = cookies.length ? `(${cookies.length})` : '(0)';
  } catch { els.cookieCount.textContent = ''; }
}

(async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      currentTabUrl = tab.url;
      const u = new URL(tab.url);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        currentOrigin = u.origin;
        els.siteLine.textContent = 'Current site: ' + u.hostname;
        els.originLabel.textContent = currentOrigin;
      } else {
        els.siteLine.textContent = 'Current site: browser-internal page';
        els.originLabel.textContent = 'not wipeable';
      }
    }
  } catch (e) {
    els.siteLine.textContent = 'Could not read current tab.';
  }
  refreshCookieCount();
})();
