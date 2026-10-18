/* =====================================================================
 * XHR Request Firewall — isolated-world bridge content script
 *
 * Runs at document_start. Loads the per-site policy from storage,
 * injects content-main.js into the page (MAIN world) with the policy,
 * relays request logs to the background worker, and pushes live policy
 * updates into the page when the user changes settings in the popup.
 * ===================================================================== */
(() => {
  'use strict';

  const STORE_KEY = 'xrhfw';

  /** Load the firewall settings object from storage. */
  async function loadSettings() {
    const data = await chrome.storage.local.get(STORE_KEY);
    return data[STORE_KEY] || { globalEnabled: true, sites: {} };
  }

  /** Policy for the current page's origin. */
  async function policyForPage(settings) {
    const site = settings.sites[location.origin];
    return {
      enabled: settings.globalEnabled !== false,
      blocked: (site && Array.isArray(site.blocked)) ? site.blocked : [],
    };
  }

  /** Inject a script tag carrying code into the page's MAIN world. */
  function injectIntoPage(code) {
    const script = document.createElement('script');
    script.textContent = code;
    const mount = () => {
      const parent = document.documentElement || document.head;
      if (parent) {
        parent.appendChild(script);
        script.remove();
        return true;
      }
      return false;
    };
    if (!mount()) {
      // document_start can run before <html> exists — wait for it.
      const obs = new MutationObserver(() => {
        if (mount()) obs.disconnect();
      });
      obs.observe(document, { childList: true });
    }
  }

  /** Fetch content-main.js and inject it with the current policy. */
  async function injectWrapper() {
    try {
      const settings = await loadSettings();
      const policy = await policyForPage(settings);
      const url = chrome.runtime.getURL('content-main.js');
      const src = await (await fetch(url)).text();
      const code =
        'window.__XRHFW_POLICY__ = ' + JSON.stringify(policy) + ';\n' + src;
      injectIntoPage(code);
    } catch (_) {
      // Storage or injection failure: page keeps working unprotected.
    }
  }

  // Relay logs from the page wrapper to the background worker.
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (d && d.__xrhfw === true) {
      chrome.runtime.sendMessage({
        kind: 'xrhfw-log',
        type: d.type,
        host: d.host,
        url: d.url,
        blocked: !!d.blocked,
      }).catch(() => { /* background asleep — ignore */ });
    }
  });

  // Popup changes → refresh the in-page policy without a reload.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.kind === 'xrhfw-policy-updated') {
      loadSettings()
        .then(policyForPage)
        .then((policy) => {
          window.postMessage({ __xrhfw_policy: policy }, '*');
        })
        .catch(() => {});
    }
  });

  injectWrapper();
})();
