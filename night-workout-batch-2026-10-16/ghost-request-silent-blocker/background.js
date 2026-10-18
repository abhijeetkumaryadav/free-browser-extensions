/* GhostBlock — background service worker.
 * Owns the dynamic DNR block rules built from the user's domain list,
 * and keeps block counters via onRuleMatchedDebug. Observe + count only;
 * declarativeNetRequest does the actual (silent) blocking. */
'use strict';

/* ------------------------------------------------------------------ */
/* Sample starter list — clearly SAMPLE data. The user can edit freely. */
/* ------------------------------------------------------------------ */
const SAMPLE_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.net',
  'hotjar.com',
  'criteo.com',
  'adsrvr.org',
  'moatads.com',
  'scorecardresearch.com'
];

// Resource types to block (everything except top-level navigations).
const BLOCK_RESOURCE_TYPES = [
  'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object',
  'xmlhttprequest', 'ping', 'media', 'websocket', 'webtransport', 'other'
];

const STORE_KEYS = { domains: 'ghostDomains', enabled: 'ghostEnabled', stats: 'ghostStats' };

/* ----------------------------- storage ---------------------------- */
async function getState() {
  const d = await chrome.storage.local.get([STORE_KEYS.domains, STORE_KEYS.enabled, STORE_KEYS.stats]);
  return {
    domains: Array.isArray(d[STORE_KEYS.domains]) ? d[STORE_KEYS.domains] : [...SAMPLE_DOMAINS],
    enabled: d[STORE_KEYS.enabled] !== false, // default ON
    stats: d[STORE_KEYS.stats] || { total: 0, day: todayKey(), dayCount: 0, byDomain: {} }
  };
}

/* --------------------------- rule building ------------------------ */
/** Build one block rule per domain. `||domain^` anchors to the domain + subdomains. */
function buildRules(domains) {
  return domains.map((domain, i) => ({
    id: i + 1, // stable ids: index+1, so the id->domain map below stays valid
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: BLOCK_RESOURCE_TYPES
    }
  }));
}

async function applyRules() {
  const { domains, enabled } = await getState();
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map((r) => r.id);
  const addRules = enabled ? buildRules(domains) : [];
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules });
  // Persist the id->domain map so the debug listener can attribute blocks.
  const idToDomain = {};
  domains.forEach((d, i) => { idToDomain[i + 1] = d; });
  await chrome.storage.local.set({ ghostIdMap: idToDomain });
}

/* ------------------------------ stats ----------------------------- */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function recordBlock(ruleId) {
  const d = await chrome.storage.local.get(['ghostIdMap', STORE_KEYS.stats]);
  const idMap = d.ghostIdMap || {};
  const domain = idMap[ruleId] || 'unknown';
  let stats = d[STORE_KEYS.stats] || { total: 0, day: todayKey(), dayCount: 0, byDomain: {} };
  if (stats.day !== todayKey()) {
    stats.day = todayKey();
    stats.dayCount = 0;
  }
  stats.total += 1;
  stats.dayCount += 1;
  stats.byDomain[domain] = (stats.byDomain[domain] || 0) + 1;
  await chrome.storage.local.set({ [STORE_KEYS.stats]: stats });
}

// Fired for every matched DNR rule (needs declarativeNetRequestFeedback).
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  if (info && info.rule && typeof info.rule.ruleId === 'number') {
    recordBlock(info.rule.ruleId).catch(() => {});
  }
});

/* ------------------------------ events ---------------------------- */
chrome.runtime.onInstalled.addListener(async () => {
  const d = await chrome.storage.local.get([STORE_KEYS.domains, STORE_KEYS.enabled]);
  if (!Array.isArray(d[STORE_KEYS.domains])) {
    await chrome.storage.local.set({ [STORE_KEYS.domains]: [...SAMPLE_DOMAINS] });
  }
  if (typeof d[STORE_KEYS.enabled] !== 'boolean') {
    await chrome.storage.local.set({ [STORE_KEYS.enabled]: true });
  }
  await applyRules();
});

chrome.runtime.onStartup.addListener(() => {
  applyRules().catch(() => {});
});

// Rebuild rules whenever the user edits the list or toggles the switch.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes[STORE_KEYS.domains] || changes[STORE_KEYS.enabled])) {
    applyRules().catch(() => {});
  }
});
