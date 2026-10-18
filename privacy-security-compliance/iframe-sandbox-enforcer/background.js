/* Iframe Sandbox Enforcer — background service worker.
 * Applies the user's remembered per-site policy automatically when a page
 * finishes loading. Only runs for origins the user explicitly enabled
 * (optional host permission granted at save time). */

// Self-contained enforcement routine injected into the tab.
function enforcePolicy(mode) {
  const pageHost = location.hostname;
  const isThirdParty = (f) => {
    let host = '';
    try { host = new URL(f.src || '', location.href).hostname; } catch (e) {}
    return Boolean(host) && host !== pageHost;
  };
  if (mode === 'sandbox-all') {
    document.querySelectorAll('iframe').forEach((f) => f.setAttribute('sandbox', ''));
  } else if (mode === 'sandbox-third') {
    document.querySelectorAll('iframe').forEach((f) => {
      if (isThirdParty(f)) f.setAttribute('sandbox', '');
    });
  } else if (mode === 'block-third') {
    document.querySelectorAll('iframe').forEach((f) => {
      if (isThirdParty(f)) f.remove();
    });
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Run once per committed navigation.
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || !/^https?:/.test(tab.url)) return;

  let origin;
  try {
    origin = new URL(tab.url).origin;
  } catch (e) {
    return;
  }

  const { policies = {} } = await chrome.storage.local.get('policies');
  const mode = policies[origin];
  if (!mode || mode === 'off') return;

  // Never enforce without the optional host permission the user granted.
  const allowed = await chrome.permissions.contains({ origins: [origin + '/*'] });
  if (!allowed) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: enforcePolicy,
      args: [mode]
    });
  } catch (e) {
    // Page may restrict scripting (e.g. web store); fail silently.
  }
});
