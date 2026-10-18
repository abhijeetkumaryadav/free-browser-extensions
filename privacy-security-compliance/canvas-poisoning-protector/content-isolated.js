/* Canvas Poisoning Protector — isolated-world companion.
 * Has access to chrome.storage; hands the settings to the MAIN-world
 * injector via a DOM event handshake, and answers popup status queries.
 */
(function () {
  'use strict';

  var settings = { enabled: true, allowlist: [] };

  // True when the current host (or a parent domain) is allowlisted.
  function isAllowlisted(host) {
    return settings.allowlist.some(function (d) {
      return host === d || host.endsWith('.' + d);
    });
  }

  function protectionActive() {
    return settings.enabled && !isAllowlisted(location.hostname);
  }

  function sendConfig() {
    window.dispatchEvent(new CustomEvent('cpp-config', {
      detail: { enabled: protectionActive() }
    }));
  }

  // MAIN-world injector asks for the config.
  window.addEventListener('cpp-request-config', sendConfig);

  // Popup asks whether protection is active on this tab.
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === 'cpp-status') {
      sendResponse({
        installed: true,
        active: protectionActive(),
        host: location.hostname,
        allowlisted: isAllowlisted(location.hostname)
      });
      return true;
    }
  });

  // Load settings, then tell the MAIN-world injector what to do.
  chrome.storage.sync.get({ enabled: true, allowlist: [] }, function (res) {
    settings = res;
    sendConfig();
  });

  // React to setting changes without a reload.
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'sync') return;
    if (changes.enabled) settings.enabled = changes.enabled.newValue;
    if (changes.allowlist) settings.allowlist = changes.allowlist.newValue;
    sendConfig();
  });
})();
