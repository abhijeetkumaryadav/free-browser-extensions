/* MonoFocus — popup logic.
 * Persists settings in chrome.storage.local, injects content.js into the
 * active tab on demand and applies/clears the contrast treatment.
 */
'use strict';

const powerToggle = document.getElementById('powerToggle');
const presetsEl = document.getElementById('presets');
const outlineRange = document.getElementById('outlineRange');
const outlineVal = document.getElementById('outlineVal');
const statusEl = document.getElementById('status');

const DEFAULTS = { enabled: false, preset: 'mono', outline: 2 };
let settings = { ...DEFAULTS };

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureInjected(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

async function applyToTab() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) throw new Error('No active tab.');
  if (!/^https?:|^file:/.test(tab.url || ''))
    throw new Error('Cannot modify this page (chrome:// pages are off-limits).');
  try {
    await ensureInjected(tab.id);
  } catch (e) {
    throw new Error('Could not inject into this page.');
  }
  const res = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (on, s) => {
      if (on && window.__hcApply) return window.__hcApply(s);
      if (!on && window.__hcClear) return window.__hcClear();
      return false;
    },
    args: [settings.enabled, { preset: settings.preset, outline: settings.outline }]
  });
  if (!res || !res[0] || res[0].result !== true)
    throw new Error('Page did not accept the treatment.');
}

async function persist() {
  await chrome.storage.local.set({ monofocus: settings });
}

function render() {
  powerToggle.setAttribute('aria-checked', String(settings.enabled));
  presetsEl.querySelectorAll('.preset').forEach(b =>
    b.classList.toggle('active', b.dataset.p === settings.preset));
  outlineRange.value = settings.outline;
  outlineVal.textContent = settings.outline + 'px';
  statusEl.classList.toggle('on', settings.enabled);
  statusEl.textContent = settings.enabled
    ? `Enforcing "${presetName(settings.preset)}" on this tab. Flip the switch to revert.`
    : 'Pick a preset, then flip the switch. Applies to this tab only.';
}

function presetName(p) {
  return { mono: 'Mono Boost', night: 'Night Contrast', focus: 'Focus Rings' }[p] || p;
}

async function handleError(e) {
  statusEl.classList.remove('on');
  statusEl.textContent = 'Note: ' + (e.message || e) + ' Settings are saved for next time.';
}

powerToggle.addEventListener('click', async () => {
  settings.enabled = !settings.enabled;
  await persist();
  render();
  try { await applyToTab(); render(); }
  catch (e) { handleError(e); }
});

presetsEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('.preset');
  if (!btn) return;
  settings.preset = btn.dataset.p;
  await persist();
  render();
  if (settings.enabled) {
    try { await applyToTab(); } catch (err) { handleError(err); }
  }
});

outlineRange.addEventListener('change', async () => {
  settings.outline = Number(outlineRange.value);
  await persist();
  render();
  if (settings.enabled) {
    try { await applyToTab(); } catch (err) { handleError(err); }
  }
});
outlineRange.addEventListener('input', () => {
  outlineVal.textContent = outlineRange.value + 'px';
});

// init
(async () => {
  try {
    const stored = await chrome.storage.local.get('monofocus');
    if (stored.monofocus) settings = { ...DEFAULTS, ...stored.monofocus };
  } catch { /* storage unavailable — use defaults */ }
  render();
})();
