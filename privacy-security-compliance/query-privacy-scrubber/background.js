/* Query Privacy Scrubber — service worker.
   Builds declarativeNetRequest redirect rules that strip known tracking
   query parameters from navigations. Rules are rebuilt whenever the user
   edits the parameter list or toggles the master switch. All on-device. */
"use strict";

const DEFAULT_PARAMS = [
  "utm_*", "gclid", "gbraid", "wbraid", "fbclid", "msclkid", "dclid",
  "igshid", "ttclid", "mc_cid", "mc_eid", "_ga", "srsltid",
  "vero_conv", "vero_id", "yclid", "pk_campaign", "piwik_campaign"
];

const STORE_KEYS = { params: "params", enabled: "enabled", stripped: "stripped" };

/* Escape a literal for RE2 */
function reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* Convert a param entry ("gclid" or "utm_*") to a regex fragment matching the name */
function namePattern(entry) {
  if (entry.endsWith("*")) return reEscape(entry.slice(0, -1)) + "[^&#=]*";
  return reEscape(entry);
}

/* Build one redirect rule object */
function redirectRule(id, filter, substitution) {
  return {
    id,
    priority: 1,
    action: { type: "redirect", redirect: { regexSubstitution: substitution } },
    condition: { regexFilter: filter, resourceTypes: ["main_frame", "sub_frame"] }
  };
}

/* Rules per param: middle occurrence, only occurrence, trailing occurrence.
   Redirects are re-evaluated, so repeated occurrences converge. */
function rulesForParam(entry, baseId) {
  const N = namePattern(entry);
  return [
    redirectRule(baseId,     `^([^#]*[?&])${N}=[^&#]*&([^#]*)(#.*)?$`, "\\1\\2\\3"),
    redirectRule(baseId + 1, `^([^#]*\\?)${N}=[^&#]*(#.*)?$`,          "\\1\\2"),
    redirectRule(baseId + 2, `^([^#]*\\?[^#]*)&${N}=[^&#]*(#.*)?$`,    "\\1\\2")
  ];
}

/* Cleanup rules: drop a dangling trailing "?" or "&" left after stripping. */
function cleanupRules(baseId) {
  return [
    { id: baseId, priority: 2,
      action: { type: "redirect", redirect: { regexSubstitution: "\\1\\2" } },
      condition: { regexFilter: "^([^?#]*)\\?(#.*)?$", resourceTypes: ["main_frame", "sub_frame"] } },
    { id: baseId + 1, priority: 2,
      action: { type: "redirect", redirect: { regexSubstitution: "\\1\\2" } },
      condition: { regexFilter: "^([^?#]*\\?[^#]+)&(#.*)?$", resourceTypes: ["main_frame", "sub_frame"] } }
  ];
}

async function rebuildRules() {
  const { params = DEFAULT_PARAMS, enabled = true } =
    await chrome.storage.local.get(["params", "enabled"]);
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = old.map(r => r.id);
  const addRules = [];
  if (enabled) {
    let id = 1;
    for (const entry of params) {
      if (!entry || !entry.trim()) continue;
      addRules.push(...rulesForParam(entry.trim(), id));
      id += 10;
    }
    addRules.push(...cleanupRules(id));
  }
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules });
  return { ruleCount: addRules.length, paramCount: params.length };
}

/* Count stripped params (works for unpacked installs via the debug event). */
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async () => {
    const { stripped = 0 } = await chrome.storage.local.get("stripped");
    await chrome.storage.local.set({ stripped: stripped + 1 });
  });
}

/* Popup -> background messages */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "rebuild") {
    rebuildRules().then(sendResponse);
    return true;
  }
  if (msg.type === "getState") {
    (async () => {
      const s = await chrome.storage.local.get(["params", "enabled", "stripped"]);
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      sendResponse({
        params: s.params ?? DEFAULT_PARAMS,
        enabled: s.enabled ?? true,
        stripped: s.stripped ?? 0,
        ruleCount: rules.length
      });
    })();
    return true;
  }
});

chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason === "install") {
    await chrome.storage.local.set({ params: DEFAULT_PARAMS, enabled: true, stripped: 0 });
  }
  await rebuildRules();
});

chrome.runtime.onStartup.addListener(rebuildRules);
