/* StyleForge background worker — applies the user's CSS rules on navigation.
   A rule applies when: rule.enabled AND (rule.scope === 'global' OR host endsWith rule.domain).
   CSS is injected as a <style> node via the content script; the page DOM is never read. */

async function getRules() {
  const { rules = [] } = await chrome.storage.local.get('rules');
  return rules;
}

function matches(rule, host) {
  if (!rule.enabled) return false;
  if (rule.scope === 'global') return true;
  const d = (rule.domain || '').trim().toLowerCase();
  if (!d) return false;
  return host === d || host.endsWith('.' + d);
}

async function applyToTab(tabId, url) {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { return; }
  if (!/^https?:/.test(url)) return;
  const css = (await getRules()).filter((r) => matches(r, host)).map((r) => r.css).join('\n');
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, { type: css ? 'styleforge:apply' : 'styleforge:remove', css });
  } catch {
    /* Tab not scriptable (chrome://, store, etc.) — skip silently. */
  }
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.url) applyToTab(tabId, tab.url);
});
