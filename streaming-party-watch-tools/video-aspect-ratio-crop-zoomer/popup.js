/* CropZoom popup logic.
 * - Injects cropper.js on demand (activeTab, user gesture only).
 * - Reads/writes per-site prefs in chrome.storage.local (keyed by hostname).
 * - Live-applies slider changes with a short debounce.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var statusEl = $('status');
  var siteKey = null;   // hostname of the active tab
  var tabId = null;
  var applyTimer = null;

  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function settings() {
    var active = document.querySelector('.preset.active');
    return {
      mode: active ? active.dataset.mode : 'fit',
      zoom: parseInt($('zoom').value, 10),
      panX: parseInt($('panX').value, 10),
      panY: parseInt($('panY').value, 10)
    };
  }

  /* Ensure cropper.js is present, then run fnName with args in the page. */
  function callCropper(fnName, args) {
    return chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['cropper.js']
    }).then(function () {
      return chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function (name, a) { return window.__VACZ[name](a); },
        args: [fnName, args || null]
      });
    }).then(function (results) {
      return results && results[0] ? results[0].result : null;
    });
  }

  function applyNow() {
    var s = settings();
    setStatus('Applying…');
    callCropper('apply', s).then(function (res) {
      if (res && res.ok) {
        setStatus(res.message, 'ok');
        if ($('remember').checked && siteKey) {
          var data = {};
          data['vacz:' + siteKey] = s;
          chrome.storage.local.set(data);
        }
      } else {
        setStatus((res && res.message) || 'Could not apply.', 'err');
      }
    }).catch(function () {
      setStatus('Cannot run here (e.g. chrome:// pages).', 'err');
    });
  }

  function applyDebounced() {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(applyNow, 180);
  }

  function paintUI(s) {
    document.querySelectorAll('.preset').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === s.mode);
    });
    $('zoom').value = s.zoom;   $('zoomVal').textContent = s.zoom + '%';
    $('panX').value = s.panX;   $('panXVal').textContent = s.panX + '%';
    $('panY').value = s.panY;   $('panYVal').textContent = s.panY + '%';
  }

  function init() {
    chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
      var tab = tabs[0];
      if (!tab || !tab.id) { setStatus('No active tab.', 'err'); return; }
      tabId = tab.id;
      try { siteKey = new URL(tab.url).hostname; } catch (e) { siteKey = null; }
      if (siteKey) $('siteName').textContent = siteKey;

      // Load saved per-site settings, if any.
      var done = Promise.resolve();
      if (siteKey) {
        done = chrome.storage.local.get('vacz:' + siteKey).then(function (items) {
          var saved = items['vacz:' + siteKey];
          if (saved) { paintUI(saved); setStatus('Loaded saved settings for ' + siteKey + '.'); }
        });
      }
      return done;
    }).catch(function () { setStatus('Could not read the active tab.', 'err'); });

    document.querySelectorAll('.preset').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.preset').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        applyNow();
      });
    });

    [['zoom', 'zoomVal', '%'], ['panX', 'panXVal', '%'], ['panY', 'panYVal', '%']]
      .forEach(function (cfg) {
        $(cfg[0]).addEventListener('input', function () {
          $(cfg[1]).textContent = $(cfg[0]).value + cfg[2];
          applyDebounced();
        });
      });

    $('reset').addEventListener('click', function () {
      if (tabId == null) return;
      callCropper('reset').then(function (res) {
        setStatus((res && res.message) || 'Video restored.', 'ok');
        paintUI({ mode: 'fit', zoom: 100, panX: 0, panY: 0 });
        if (siteKey && !$('remember').checked) {
          chrome.storage.local.remove('vacz:' + siteKey);
        }
      }).catch(function () {
        setStatus('Cannot run here (e.g. chrome:// pages).', 'err');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
