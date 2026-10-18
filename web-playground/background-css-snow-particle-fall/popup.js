/* SnowFall popup logic.
 * The snow overlay is driven by injecting snow.js into the active tab, then
 * calling window.__snowfall.start/stop/isActive in the tab's isolated world.
 * No content script runs unless the user toggles snow on.
 */
(function () {
  'use strict';

  var DEFAULTS = { enabled: false, density: 120, size: 1.2, speed: 1.0, wind: 0 };
  var opts = Object.assign({}, DEFAULTS);

  var els = {
    toggle: document.getElementById('toggle'),
    blocked: document.getElementById('blocked'),
    controls: document.getElementById('controls')
  };
  var sliders = ['density', 'size', 'speed', 'wind'];

  // ---- tab helpers ---------------------------------------------------------

  // Returns the active tab, or null if the page can't be scripted.
  async function activeTab() {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var tab = tabs && tabs[0];
    if (!tab || !tab.id) return null;
    // Browser-protected pages (chrome://, Web Store, about:, etc.)
    if (/^(chrome|chrome-extension|about|edge|opera|vivaldi|brave):/.test(tab.url || '')) return null;
    return tab;
  }

  async function injectSnow(tab) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['snow.js'] });
  }

  // Calls fn(opts) as window.__snowfall.<name> inside the tab.
  async function callSnow(tab, name, arg) {
    await injectSnow(tab);
    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function (fname, farg) {
        var api = window.__snowfall;
        if (!api || typeof api[fname] !== 'function') return null;
        return api[fname](farg);
      },
      args: [name, arg || null]
    });
    return results && results[0] ? results[0].result : null;
  }

  // ---- state ----------------------------------------------------------------

  function render() {
    els.toggle.classList.toggle('on', opts.enabled);
    els.controls.classList.toggle('disabled', !opts.enabled);
    sliders.forEach(function (key) {
      var s = document.getElementById('s-' + key);
      var v = document.getElementById('v-' + key);
      if (s) s.value = opts[key];
      if (v) v.textContent = formatVal(key, opts[key]);
    });
  }

  function formatVal(key, val) {
    if (key === 'density') return String(Math.round(val));
    if (key === 'wind') return (val > 0 ? '+' : '') + String(Math.round(val));
    return Number(val).toFixed(1);
  }

  function persist() {
    chrome.storage.local.set({ snowfall: opts });
  }

  async function applyToTab() {
    var tab = await activeTab();
    if (!tab) {
      // Page can't be scripted — show notice, keep enabled=false.
      opts.enabled = false;
      render();
      els.blocked.classList.remove('hidden');
      persist();
      return;
    }
    els.blocked.classList.add('hidden');
    if (opts.enabled) {
      await callSnow(tab, 'start', snowArgs());
    } else {
      await callSnow(tab, 'stop');
    }
  }

  function snowArgs() {
    return {
      density: Number(opts.density),
      size: Number(opts.size),
      speed: Number(opts.speed),
      wind: Number(opts.wind)
    };
  }

  // ---- events ---------------------------------------------------------------

  els.toggle.addEventListener('click', function () {
    opts.enabled = !opts.enabled;
    persist();
    render();
    applyToTab().catch(function () {
      els.blocked.classList.remove('hidden');
    });
  });

  sliders.forEach(function (key) {
    var s = document.getElementById('s-' + key);
    s.addEventListener('input', function () {
      opts[key] = Number(s.value);
      document.getElementById('v-' + key).textContent = formatVal(key, opts[key]);
      persist();
      // Live-update a running overlay (debounced lightly).
      clearTimeout(s._t);
      s._t = setTimeout(function () {
        if (opts.enabled) {
          activeTab().then(function (tab) {
            if (tab) callSnow(tab, 'start', snowArgs()).catch(function () {});
          });
        }
      }, 120);
    });
  });

  // ---- init -----------------------------------------------------------------

  chrome.storage.local.get(['snowfall'], function (data) {
    if (data.snowfall) Object.assign(opts, data.snowfall);
    // Popup never auto-enables: the overlay is per-page and user-triggered.
    opts.enabled = false;
    render();
  });
})();
