/* ============================================================================
 * Speed Lock — popup logic
 * Reads/writes chrome.storage.local keys consumed by content.js:
 *   vpslEnabled, vpslRate, vpslOverrides {hostname: rate}
 * ========================================================================== */
'use strict';

const DEFAULTS = { vpslEnabled: true, vpslRate: 1, vpslOverrides: {} };
const MIN = 0.25, MAX = 4;

const enabledToggle = document.getElementById('enabledToggle');
const rateSlider = document.getElementById('rateSlider');
const rateReadout = document.getElementById('rateReadout');
const siteHost = document.getElementById('siteHost');
const siteMode = document.getElementById('siteMode');
const siteSlider = document.getElementById('siteSlider');
const siteReadout = document.getElementById('siteReadout');
const resetBtn = document.getElementById('resetBtn');
const chips = Array.from(document.querySelectorAll('.chip'));

let state = { ...DEFAULTS };
let hostname = null;

function fmt(rate) {
  return (Math.round(rate * 100) / 100) + '×';
}

// Paint the slider's filled portion (webkit gradient trick).
function paintSlider(el) {
  const pct = ((el.value - MIN) / (MAX - MIN)) * 100;
  el.style.setProperty('--fill', pct + '%');
}

function refreshChips() {
  chips.forEach(c => {
    c.classList.toggle('on', Math.abs(parseFloat(c.dataset.rate) - state.vpslRate) < 0.001);
  });
}

function refreshSiteUI() {
  const override = hostname && state.vpslOverrides
    ? state.vpslOverrides[hostname] : undefined;
  if (override != null) {
    siteMode.value = 'custom';
    siteSlider.value = override;
    siteSlider.classList.remove('hidden');
    siteReadout.classList.remove('hidden');
    siteReadout.textContent = fmt(override) + ' on this site';
  } else {
    siteMode.value = 'global';
    siteSlider.classList.add('hidden');
    siteReadout.classList.add('hidden');
  }
  paintSlider(siteSlider);
}

function refreshGlobalUI() {
  enabledToggle.checked = !!state.vpslEnabled;
  rateSlider.value = state.vpslRate;
  rateReadout.textContent = fmt(state.vpslRate);
  paintSlider(rateSlider);
  refreshChips();
  document.querySelector('.shell').style.opacity = state.vpslEnabled ? '1' : '.75';
}

async function save(patch) {
  state = { ...state, ...patch };
  await chrome.storage.local.set(patch);
  refreshGlobalUI();
  refreshSiteUI();
}

// ---- events -----------------------------------------------------------------
rateSlider.addEventListener('input', () => {
  rateReadout.textContent = fmt(parseFloat(rateSlider.value));
  paintSlider(rateSlider);
  refreshChipsPreview(parseFloat(rateSlider.value));
});
rateSlider.addEventListener('change', () => {
  save({ vpslRate: parseFloat(rateSlider.value) });
});

function refreshChipsPreview(rate) {
  chips.forEach(c => {
    c.classList.toggle('on', Math.abs(parseFloat(c.dataset.rate) - rate) < 0.001);
  });
}

chips.forEach(c => {
  c.addEventListener('click', () => save({ vpslRate: parseFloat(c.dataset.rate) }));
});

enabledToggle.addEventListener('change', () => {
  save({ vpslEnabled: enabledToggle.checked });
});

siteMode.addEventListener('change', async () => {
  if (!hostname) return;
  const overrides = { ...(state.vpslOverrides || {}) };
  if (siteMode.value === 'custom') {
    overrides[hostname] = parseFloat(siteSlider.value) || state.vpslRate;
  } else {
    delete overrides[hostname];
  }
  await save({ vpslOverrides: overrides });
});

siteSlider.addEventListener('input', () => {
  siteReadout.textContent = fmt(parseFloat(siteSlider.value)) + ' on this site';
  paintSlider(siteSlider);
});
siteSlider.addEventListener('change', async () => {
  if (!hostname) return;
  const overrides = { ...(state.vpslOverrides || {}) };
  overrides[hostname] = parseFloat(siteSlider.value);
  await save({ vpslOverrides: overrides });
});

resetBtn.addEventListener('click', async () => {
  await save({ vpslRate: 1, vpslOverrides: {}, vpslEnabled: true });
});

// ---- boot -------------------------------------------------------------------
(async function init() {
  try {
    const stored = await chrome.storage.local.get(DEFAULTS);
    state = { ...DEFAULTS, ...stored };
  } catch (e) { /* storage unavailable; use defaults */ }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && /^https?:/.test(tab.url)) {
      hostname = new URL(tab.url).hostname;
      siteHost.textContent = hostname;
      siteHost.title = hostname;
    } else {
      siteHost.textContent = 'not a web page';
      siteMode.disabled = true;
    }
  } catch (e) {
    siteHost.textContent = 'unavailable';
    siteMode.disabled = true;
  }

  refreshGlobalUI();
  refreshSiteUI();
})();
