/* NetLock background service worker.
 * Owns lock state (chrome.storage.session), the per-origin guard content
 * scripts, the optional declarativeNetRequest deep-block rules, badges,
 * and the auto-lock domain list.
 *
 * Honest scope: the lock freezes network APIs inside the locked tab
 * (guard.js, MAIN world, document_start) and can optionally block the
 * locked site's own resources at the network layer via a session
 * declarativeNetRequest rule. It is tab/site-scoped — never system-wide —
 * and locks do not survive a browser restart.
 */

var LOCK_KEY = 'netlock:locks';      // session storage: { tabId: lockInfo }
var SETTINGS_KEY = 'netlock:settings'; // local storage: { deepBlock, autoDomains[] }

function ruleIdFor(tabId) { return 200000 + (tabId % 100000); }
function scriptIdFor(tabId) { return 'netlock-guard-' + tabId; }

/* ---------- storage helpers ---------- */
async function getLocks() {
  var o = await chrome.storage.session.get(LOCK_KEY);
  return o[LOCK_KEY] || {};
}
async function setLocks(locks) {
  await chrome.storage.session.set({ [LOCK_KEY]: locks });
}
async function getSettings() {
  var o = await chrome.storage.local.get(SETTINGS_KEY);
  return Object.assign({ deepBlock: false, autoDomains: [] }, o[SETTINGS_KEY] || {});
}
async function setSettings(s) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: s });
}

function domainOf(url) {
  try { return new URL(url).hostname; } catch (e) { return ''; }
}
function originOf(url) {
  try { return new URL(url).origin; } catch (e) { return ''; }
}
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ---------- core: lock / unlock ---------- */

/* Lock the given tab. Returns { ok, reason? }. */
async function lockTab(tabId) {
  var tab;
  try { tab = await chrome.tabs.get(tabId); } catch (e) { return { ok: false, reason: 'Tab not found.' }; }
  var url = tab.url || '';
  if (!/^https?:\/\//.test(url)) {
    return { ok: false, reason: 'Can only lock http(s) pages — not chrome:// or store pages.' };
  }
  var domain = domainOf(url);
  var origin = originOf(url);
  var locks = await getLocks();
  if (locks[tabId]) return { ok: true, already: true };

  var settings = await getSettings();
  var scriptId = scriptIdFor(tabId);

  // 1. Register a MAIN-world document_start guard for this origin so the
  //    lock also applies to any navigation inside the tab while locked.
  try { await chrome.scripting.unregisterContentScripts({ ids: [scriptId] }); } catch (e) {}
  await chrome.scripting.registerContentScripts([{
    id: scriptId,
    matches: [origin + '/*'],
    js: ['guard.js'],
    runAt: 'document_start',
    world: 'MAIN',
    allFrames: true,
    persistAcrossSessions: false
  }]);

  // 2. Inject the guard into the already-loaded tab right now.
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId, allFrames: true },
      files: ['guard.js'],
      world: 'MAIN'
    });
  } catch (e) { /* page may restrict injection; registered script still covers navigations */ }

  // 3. Optional network-layer deep block for the site's own resources.
  var ruleId = null;
  if (settings.deepBlock) {
    var granted = await chrome.permissions.request({
      origins: ['*://' + domain + '/*', '*://*.' + domain + '/*']
    });
    if (granted) {
      ruleId = ruleIdFor(tabId);
      try { await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] }); } catch (e) {}
      await chrome.declarativeNetRequest.updateSessionRules({
        addRules: [{
          id: ruleId,
          priority: 1,
          action: { type: 'block' },
          condition: {
            regexFilter: '^https?://([^/]*\\.)?' + escapeRegex(domain) + '/',
            excludedResourceTypes: ['main_frame']
          }
        }]
      });
    }
  }

  locks[tabId] = { domain: domain, origin: origin, scriptId: scriptId, ruleId: ruleId, lockedAt: Date.now() };
  await setLocks(locks);
  await chrome.action.setBadgeText({ tabId: tabId, text: '🔒' });
  await chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#dc2626' });
  await chrome.action.setTitle({ tabId: tabId, title: 'NetLock: network locked for ' + domain + ' — click to unlock' });
  return { ok: true };
}

/* Unlock the given tab. Returns { ok }. */
async function unlockTab(tabId, silent) {
  var locks = await getLocks();
  var info = locks[tabId];
  if (!info) return { ok: true, already: true };
  try { await chrome.scripting.unregisterContentScripts({ ids: [info.scriptId] }); } catch (e) {}
  if (info.ruleId) {
    try { await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [info.ruleId] }); } catch (e) {}
    // Release the optional host permission granted for the deep block.
    try {
      await chrome.permissions.remove({
        origins: ['*://' + info.domain + '/*', '*://*.' + info.domain + '/*']
      });
    } catch (e) {}
  }
  delete locks[tabId];
  await setLocks(locks);
  try {
    await chrome.action.setBadgeText({ tabId: tabId, text: '' });
    await chrome.action.setTitle({ tabId: tabId, title: 'NetLock — Tab Network Lockout' });
  } catch (e) {}
  if (!silent) {
    // Reload so the page picks up a live network stack again.
    try { await chrome.tabs.reload(tabId); } catch (e) {}
  }
  return { ok: true };
}

/* ---------- auto-lock on navigation ---------- */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== 'loading') return;
  var locks = await getLocks();
  var url = changeInfo.url || tab.url || '';
  var domain = domainOf(url);

  // If a locked tab navigates away to a different site, release the lock.
  if (locks[tabId] && domain && domain !== locks[tabId].domain) {
    await unlockTab(tabId, true);
    return;
  }
  // Auto-lock listed domains.
  if (!locks[tabId] && domain && /^https?:\/\//.test(url)) {
    var settings = await getSettings();
    if (settings.autoDomains.includes(domain)) {
      await lockTab(tabId);
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  var locks = await getLocks();
  if (locks[tabId]) {
    var info = locks[tabId];
    try { await chrome.scripting.unregisterContentScripts({ ids: [info.scriptId] }); } catch (e) {}
    if (info.ruleId) {
      try { await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [info.ruleId] }); } catch (e) {}
    }
    delete locks[tabId];
    await setLocks(locks);
  }
});

/* ---------- popup messaging ---------- */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'getState') {
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      var tab = tabs[0];
      var locks = await getLocks();
      var settings = await getSettings();
      var domain = tab ? domainOf(tab.url || '') : '';
      sendResponse({
        tabId: tab ? tab.id : null,
        domain: domain,
        lockable: !!(tab && /^https?:\/\//.test(tab.url || '')),
        locked: !!(tab && locks[tab.id]),
        lockedCount: Object.keys(locks).length,
        settings: settings
      });
    } else if (msg.type === 'lock') {
      sendResponse(await lockTab(msg.tabId));
    } else if (msg.type === 'unlock') {
      sendResponse(await unlockTab(msg.tabId));
    } else if (msg.type === 'toggleDeepBlock') {
      var s = await getSettings();
      s.deepBlock = !!msg.value;
      await setSettings(s);
      sendResponse({ ok: true, deepBlock: s.deepBlock });
    } else if (msg.type === 'addAutoDomain') {
      var st = await getSettings();
      var d = (msg.domain || '').trim().toLowerCase();
      if (d && !st.autoDomains.includes(d)) { st.autoDomains.push(d); await setSettings(st); }
      sendResponse({ ok: true, autoDomains: st.autoDomains });
    } else if (msg.type === 'removeAutoDomain') {
      var st2 = await getSettings();
      st2.autoDomains = st2.autoDomains.filter(function (d) { return d !== msg.domain; });
      await setSettings(st2);
      sendResponse({ ok: true, autoDomains: st2.autoDomains });
    }
  })();
  return true; // async response
});
