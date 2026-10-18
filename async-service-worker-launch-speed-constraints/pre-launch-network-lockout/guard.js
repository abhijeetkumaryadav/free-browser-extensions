/* NetLock guard — runs in the page's MAIN world at document_start.
 * Freezes this tab's network APIs so the page cannot make new network
 * requests while locked. Injected only into tabs the user explicitly locks.
 * Everything is restored on unlock (the script is simply not present anymore).
 */
(function () {
  'use strict';

  // Avoid double-injection (e.g. registered script + immediate executeScript).
  if (window.__netlockActive) return;
  Object.defineProperty(window, '__netlockActive', { value: true, configurable: false });

  var LOCK_ERR = function () {
    return Promise.reject(new DOMException('Network locked by NetLock', 'AbortError'));
  };

  /* ---- 1. Neuter network APIs ------------------------------------------- */
  try { window.fetch = function () { return LOCK_ERR(); }; } catch (e) {}
  try {
    var XHR = window.XMLHttpRequest;
    XHR.prototype.open = function () { this.__netlockBlocked = true; };
    XHR.prototype.send = function () { throw new DOMException('Network locked by NetLock', 'AbortError'); };
  } catch (e) {}
  try {
    window.WebSocket = function () { throw new DOMException('Network locked by NetLock', 'SecurityError'); };
  } catch (e) {}
  try {
    window.EventSource = function () { throw new DOMException('Network locked by NetLock', 'SecurityError'); };
  } catch (e) {}
  try { navigator.sendBeacon = function () { return false; }; } catch (e) {}
  try { window.open = function () { return null; }; } catch (e) {}

  /* ---- 2. Block dynamic subresource loading via src setters -------------- */
  function neuterSrc(proto, prop) {
    try {
      var desc = Object.getOwnPropertyDescriptor(proto, prop);
      if (!desc || !desc.set) return;
      Object.defineProperty(proto, prop, {
        configurable: true,
        enumerable: desc.enumerable,
        get: desc.get,
        set: function (v) {
          // Allow data: and blob: (page-local), block remote URLs.
          if (typeof v === 'string' && /^(data|blob):/i.test(v)) return desc.set.call(this, v);
          return; // swallow remote loads
        }
      });
    } catch (e) {}
  }
  ['HTMLImageElement', 'HTMLVideoElement', 'HTMLAudioElement', 'HTMLSourceElement',
   'HTMLScriptElement', 'HTMLIFrameElement', 'HTMLLinkElement', 'HTMLEmbedElement',
   'HTMLObjectElement', 'HTMLTrackElement'].forEach(function (name) {
    var ctor = window[name];
    if (ctor && ctor.prototype) neuterSrc(ctor.prototype, 'src');
  });
  try {
    var srcsetDesc = Object.getOwnPropertyDescriptor(window.HTMLImageElement.prototype, 'srcset');
    if (srcsetDesc && srcsetDesc.set) {
      Object.defineProperty(window.HTMLImageElement.prototype, 'srcset', {
        configurable: true, enumerable: srcsetDesc.enumerable, get: srcsetDesc.get, set: function () { return; }
      });
    }
  } catch (e) {}

  /* ---- 3. Block in-page navigation attempts ------------------------------ */
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (a) { ev.preventDefault(); ev.stopPropagation(); }
  }, true);
  document.addEventListener('submit', function (ev) { ev.preventDefault(); ev.stopPropagation(); }, true);
  try {
    history.pushState = function () {};
    history.replaceState = function () {};
  } catch (e) {}

  /* ---- 4. Pretend to be offline so the page shows its offline state ------ */
  try {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  } catch (e) {}
  window.dispatchEvent(new Event('offline'));

  /* ---- 5. Locked banner --------------------------------------------------- */
  function showBanner() {
    if (!document.body || document.getElementById('__netlock-banner')) return;
    var bar = document.createElement('div');
    bar.id = '__netlock-banner';
    bar.textContent = '\uD83D\uDD12 Network locked by NetLock — open the extension popup to unlock';
    bar.setAttribute('style',
      'position:fixed;top:0;left:0;right:0;z-index:2147483647;' +
      'background:#7f1d1d;color:#fecaca;font:600 13px/1.4 system-ui,sans-serif;' +
      'text-align:center;padding:8px 12px;letter-spacing:.02em;pointer-events:none;');
    document.body.prepend(bar);
  }
  if (document.body) showBanner();
  else new MutationObserver(function (m, obs) {
    if (document.body) { showBanner(); obs.disconnect(); }
  }).observe(document.documentElement, { childList: true });
})();
