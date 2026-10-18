/* =====================================================================
 * XHR Request Firewall — page-world wrapper (runs in the MAIN world)
 *
 * Wraps window.fetch and window.XMLHttpRequest to (a) log every outgoing
 * request by domain and (b) block requests to domains the user blocked.
 * Policy is delivered via window.__XRHFW_POLICY__ and can be refreshed
 * live through window.postMessage from the isolated-world bridge.
 * ===================================================================== */
(() => {
  'use strict';

  // Current policy: { enabled: bool, blocked: [domain, ...] }
  let policy = window.__XRHFW_POLICY__ || { enabled: true, blocked: [] };

  const pageHost = location.hostname;

  /** Suffix-match a hostname against the user's block list. */
  function isBlockedHost(host) {
    if (!policy.enabled || !host) return false;
    const list = Array.isArray(policy.blocked) ? policy.blocked : [];
    return list.some((d) => host === d || host.endsWith('.' + d));
  }

  /** Report a request to the isolated-world bridge (which relays it). */
  function log(entry) {
    try {
      window.postMessage({ __xrhfw: true, ...entry }, '*');
    } catch (_) { /* page gone — ignore */ }
  }

  /** Resolve any fetch/XHR target (string, URL, Request) to a hostname. */
  function toHost(input) {
    try {
      const raw = typeof input === 'string' ? input : (input && input.url);
      if (!raw) return null;
      return new URL(raw, location.href).hostname;
    } catch (_) {
      return null;
    }
  }

  function shortUrl(input) {
    try {
      const raw = typeof input === 'string' ? input : (input && input.url);
      return String(raw || '').slice(0, 220);
    } catch (_) {
      return '';
    }
  }

  /* ------------------------- fetch wrapper ------------------------- */
  const origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const host = toHost(input);
    const url = shortUrl(input);
    if (host && isBlockedHost(host)) {
      log({ type: 'fetch', host, url, blocked: true });
      return Promise.reject(
        new DOMException('Blocked by XHR Request Firewall', 'AbortError')
      );
    }
    if (host) log({ type: 'fetch', host, url, blocked: false });
    return origFetch(input, init);
  };

  /* --------------------------- XHR wrapper -------------------------- */
  const OrigXHR = window.XMLHttpRequest;

  function WrappedXHR() {
    const xhr = new OrigXHR();
    const origOpen = xhr.open;
    const origSend = xhr.send;

    // Wrap open(): decide allow/block up-front from the URL.
    xhr.open = function (method, url, ...rest) {
      const host = toHost(url);
      if (host && isBlockedHost(host)) {
        // Mark as blocked; never actually open the connection.
        xhr.__xrhfwBlocked = { host, url: shortUrl(url) };
        return undefined;
      }
      if (host) log({ type: 'xhr', host, url: shortUrl(url), blocked: false });
      return origOpen.call(xhr, method, url, ...rest);
    };

    // Wrap send(): blocked requests fail fast with an 'error' event.
    xhr.send = function (...args) {
      if (xhr.__xrhfwBlocked) {
        const b = xhr.__xrhfwBlocked;
        log({ type: 'xhr', host: b.host, url: b.url, blocked: true });
        setTimeout(() => {
          try {
            xhr.dispatchEvent(new Event('error'));
            if (typeof xhr.onerror === 'function') xhr.onerror(new Event('error'));
          } catch (_) { /* ignore */ }
        }, 0);
        return undefined;
      }
      return origSend.apply(xhr, args);
    };

    return xhr; // returning an object overrides `this` for `new`
  }
  WrappedXHR.prototype = OrigXHR.prototype;
  // Copy static constants (DONE, HEADERS_RECEIVED, …).
  Object.getOwnPropertyNames(OrigXHR).forEach((k) => {
    try { WrappedXHR[k] = OrigXHR[k]; } catch (_) { /* read-only — skip */ }
  });
  window.XMLHttpRequest = WrappedXHR;

  /* -------------------- live policy refresh channel ------------------ */
  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (d && d.__xrhfw_policy) {
      policy = d.__xrhfw_policy;
    }
  });
})();
