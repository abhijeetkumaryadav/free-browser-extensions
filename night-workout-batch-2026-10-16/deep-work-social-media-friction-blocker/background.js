/* Deep Work Friction Blocker — background service worker.
   During an active focus session, navigations to listed friction sites are
   redirected to an internal friction page with a 10-second breathing pause.
   This is friction (a pause), never a hard block: the user can always
   proceed after the pause. */
'use strict';

const SITES_KEY = 'dwf_sites';
const SESSION_KEY = 'dwf_session';
const DEFAULT_SITES = [
  'x.com', 'twitter.com', 'instagram.com', 'facebook.com',
  'tiktok.com', 'reddit.com', 'youtube.com', 'linkedin.com'
];

/** Is a focus session currently active? */
async function sessionActive() {
  const { [SESSION_KEY]: session } = await chrome.storage.local.get(SESSION_KEY);
  if (!session || session.endsAt <= Date.now()) return false;
  return true;
}

/** Does the hostname match (or is a subdomain of) a listed friction site? */
function isFrictionSite(hostname, sites) {
  if (!hostname) return false;
  const h = hostname.toLowerCase().replace(/^www\./, '');
  return sites.some(s => h === s || h.endsWith('.' + s));
}

/** Safe hostname extraction — returns null for non-URLs. */
function hostOf(url) {
  try { return new URL(url).hostname; } catch { return null; }
}

// When the session timer fires, clear the stored session.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dwf_session_end') {
    await chrome.storage.local.set({ [SESSION_KEY]: null });
  }
});

// Intercept navigations during active sessions.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading' || !tab.url) return;
  const url = new URL(tab.url);

  // Never intercept the extension's own friction page or non-web URLs.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.hostname === chrome.runtime.id) return; // chrome-extension://<id>

  const active = await sessionActive();
  if (!active) return;

  const { [SITES_KEY]: sites = DEFAULT_SITES } = await chrome.storage.local.get(SITES_KEY);
  if (!isFrictionSite(hostOf(tab.url), sites)) return;

  // Redirect to the friction page, remembering the original destination.
  const frictionUrl = chrome.runtime.getURL('friction.html') +
    '?target=' + encodeURIComponent(tab.url);
  try {
    await chrome.tabs.update(tabId, { url: frictionUrl });
  } catch (e) {
    // Tab may have closed mid-navigation; safe to ignore.
  }
});
