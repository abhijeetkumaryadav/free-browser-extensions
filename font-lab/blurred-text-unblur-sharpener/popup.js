/* SharpView popup logic.
 * All page manipulation happens in a self-contained injected function
 * (no popup-scope references) via chrome.scripting.executeScript. */

'use strict';

/* ---- Injected page-side logic (must stay self-contained!) ---- */

/**
 * Removes CSS blur() from elements and applies contrast/brightness to <html>.
 * Runs in the page's isolated world; keeps its own state on window.__sharpView.
 */
function applySharpness(opts) {
  const state = (window.__sharpView = window.__sharpView || { applied: false, saved: [] });
  const stripBlur = (f) => f.replace(/blur\(\s*[^)]*\)/gi, '').replace(/\s{2,}/g, ' ').trim();

  if (!state.applied) {
    // First pass: find every element whose *computed* filter includes blur().
    const els = document.querySelectorAll('*');
    for (const el of els) {
      let computed = '';
      try { computed = getComputedStyle(el).filter || ''; } catch (e) { /* ignore */ }
      if (computed && computed !== 'none' && /blur\(/i.test(computed)) {
        state.saved.push([el, el.style.filter]); // remember inline original (may be '')
        const cleaned = stripBlur(computed);
        el.style.filter = cleaned || 'none';
      }
    }
    state.applied = true;
  }

  // Contrast/brightness layer on <html>, rebuilt from the saved original each time
  // so dragging sliders never compounds the effect.
  const html = document.documentElement;
  const htmlEntry = state.saved.find(([el]) => el === html);
  const base = htmlEntry ? stripBlur(String(htmlEntry[1] || '')) : '';
  const parts = [];
  if (base && base !== 'none') parts.push(base);
  if (opts.contrast !== 100) parts.push('contrast(' + opts.contrast + '%)');
  if (opts.brightness !== 100) parts.push('brightness(' + opts.brightness + '%)');
  html.style.filter = parts.length ? parts.join(' ') : (htmlEntry ? (String(htmlEntry[1] || '') || '') : '');

  return { sharpened: state.applied, count: state.saved.length };
}

/** Restores every inline filter to its saved original. Fully reversible. */
function restoreSharpness() {
  const state = window.__sharpView;
  if (!state || !state.applied) return { restored: false, count: 0 };
  for (const [el, original] of state.saved) {
    el.style.filter = original || '';
  }
  const count = state.saved.length;
  window.__sharpView = { applied: false, saved: [] };
  return { restored: true, count };
}

/* ---- Popup-side UI wiring ---- */

const els = {
  sharpenBtn: document.getElementById('sharpenBtn'),
  restoreBtn: document.getElementById('restoreBtn'),
  contrast: document.getElementById('contrast'),
  brightness: document.getElementById('brightness'),
  contrastVal: document.getElementById('contrastVal'),
  brightnessVal: document.getElementById('brightnessVal'),
  badge: document.getElementById('stateBadge'),
};

const settings = { contrast: 100, brightness: 100, sharpened: false };

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setBadge(active) {
  els.badge.textContent = active ? 'Active' : 'Idle';
  els.badge.classList.toggle('active', active);
}

function render() {
  els.contrast.value = settings.contrast;
  els.brightness.value = settings.brightness;
  els.contrastVal.textContent = settings.contrast + '%';
  els.brightnessVal.textContent = settings.brightness + '%';
  els.sharpenBtn.textContent = settings.sharpened ? 'Sharpening on — re-apply' : 'Sharpen this page';
  els.sharpenBtn.classList.toggle('off', settings.sharpened);
  els.restoreBtn.disabled = !settings.sharpened;
  setBadge(settings.sharpened);
}

async function runInTab(fn, args) {
  const tab = await activeTab();
  if (!tab || !tab.id || /^chrome:\/\//.test(tab.url || '')) {
    throw new Error('Cannot run on this page (browser pages are restricted).');
  }
  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fn,
    args: args || [],
  });
  return res && res.result;
}

async function apply() {
  try {
    const r = await runInTab(applySharpness, [{ contrast: settings.contrast, brightness: settings.brightness }]);
    settings.sharpened = true;
    els.sharpenBtn.title = (r && r.count) ? r.count + ' element(s) de-blurred' : '';
  } catch (e) {
    els.sharpenBtn.title = e.message;
  }
  render();
}

async function restore() {
  try {
    await runInTab(restoreSharpness, []);
  } catch (e) { /* best effort */ }
  settings.sharpened = false;
  render();
}

els.sharpenBtn.addEventListener('click', apply);
els.restoreBtn.addEventListener('click', restore);

let debounce = null;
function onSlider() {
  settings.contrast = Number(els.contrast.value);
  settings.brightness = Number(els.brightness.value);
  chrome.storage.local.set({ sharpview: { contrast: settings.contrast, brightness: settings.brightness } });
  render();
  if (settings.sharpened) {
    clearTimeout(debounce);
    debounce = setTimeout(apply, 120); // re-apply live while dragging
  }
}
els.contrast.addEventListener('input', onSlider);
els.brightness.addEventListener('input', onSlider);

// Restore remembered slider settings.
chrome.storage.local.get('sharpview').then((data) => {
  if (data.sharpview) {
    settings.contrast = data.sharpview.contrast || 100;
    settings.brightness = data.sharpview.brightness || 100;
  }
  render();
});
