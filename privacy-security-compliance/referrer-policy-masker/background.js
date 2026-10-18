/* Referrer Policy Masker — background service worker.
   Enforces a strict Referrer-Policy on every page via declarativeNetRequest,
   and passively counts outgoing requests while masking is on.
   All settings and counts stay on-device (chrome.storage.local). */

const RULE_ID_POLICY = 1;   // Referrer-Policy response header
const RULE_ID_STRIP = 2;    // Referer request header removal (strict mode only)

const DEFAULTS = { enabled: true, mode: 'strict', sessionCount: 0 };

let sessionCount = 0;
let saveTimer = null;

/** Load persisted settings, seeding defaults on first run. */
async function loadSettings() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  sessionCount = stored.sessionCount || 0;
  return { enabled: stored.enabled, mode: stored.mode };
}

/** Persist settings (counter writes are throttled). */
async function saveSettings(patch, immediate = false) {
  const apply = () => chrome.storage.local.set({ ...patch, sessionCount });
  if (immediate) {
    clearTimeout(saveTimer);
    await apply();
  } else {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(apply, 2000);
  }
}

/** (Re)build the dynamic DNR rules from current settings. */
async function applyRules(enabled, mode) {
  // Remove our rules first so re-application is idempotent.
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID_POLICY, RULE_ID_STRIP],
  });

  if (!enabled) return;

  const rules = [
    {
      // Force a strict Referrer-Policy on every document (and sub-frame).
      id: RULE_ID_POLICY,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          {
            header: 'Referrer-Policy',
            operation: 'set',
            value: mode === 'strict' ? 'no-referrer' : 'origin',
          },
        ],
      },
      condition: { resourceTypes: ['main_frame', 'sub_frame'] },
    },
  ];

  if (mode === 'strict') {
    // Belt-and-braces: strip any Referer header the page or browser would send.
    rules.push({
      id: RULE_ID_STRIP,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'referer', operation: 'remove' }],
      },
      condition: {}, // matches all requests (host permissions grant scope)
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
}

/** Passive, non-blocking counter of outgoing requests while enabled. */
let maskingOn = true;
chrome.webRequest.onBeforeSendHeaders.addListener(
  () => {
    if (!maskingOn) return;
    sessionCount += 1;
    saveSettings({}, false); // throttled persist
  },
  { urls: ['<all_urls>'] }
);

/** Popup messaging API. */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    const settings = await loadSettings();
    switch (msg.type) {
      case 'getState':
        sendResponse({ ...settings, sessionCount });
        break;
      case 'setEnabled':
        maskingOn = !!msg.enabled;
        await applyRules(maskingOn, settings.mode);
        await saveSettings({ enabled: maskingOn }, true);
        sendResponse({ enabled: maskingOn, mode: settings.mode, sessionCount });
        break;
      case 'setMode':
        if (msg.mode !== 'strict' && msg.mode !== 'origin') break;
        await applyRules(settings.enabled, msg.mode);
        await saveSettings({ mode: msg.mode }, true);
        sendResponse({ enabled: settings.enabled, mode: msg.mode, sessionCount });
        break;
      case 'resetCounter':
        sessionCount = 0;
        await saveSettings({}, true);
        sendResponse({ enabled: settings.enabled, mode: settings.mode, sessionCount });
        break;
    }
  })();
  return true; // async response
});

// Apply rules on install / browser startup.
chrome.runtime.onInstalled.addListener(async () => {
  const s = await loadSettings();
  maskingOn = s.enabled;
  await applyRules(s.enabled, s.mode);
});
chrome.runtime.onStartup.addListener(async () => {
  const s = await loadSettings();
  maskingOn = s.enabled;
  await applyRules(s.enabled, s.mode);
});
