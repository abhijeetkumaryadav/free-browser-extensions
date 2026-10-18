/* Outbound Link Tracker Stripper — content script.
 *
 * Privacy-first link cleaner: when the user clicks a link, strip known
 * tracking parameters from the destination URL before navigation. The page's
 * DOM is never rewritten — only the navigation target is cleaned, and only
 * when the user actually clicks.
 *
 * Non-destructive & reversible: disable globally or per-site from the popup.
 * All settings stay on-device.
 */

/** Tracking query params removed from clicked URLs. */
const TRACKING_PARAMS = new Set([
  // Google / ads
  'gclid', 'gclsrc', 'dclid', 'wbraid', 'gbraid', 'gad_source',
  // Meta / social
  'fbclid', 'igshid',
  // Microsoft / Yahoo / Yandex
  'msclkid', 'yclid', '_openstat',
  // Email marketing
  'mc_cid', 'mc_eid', '_hsenc', '_hsmi', 'mkt_tok',
  // Misc affiliate/campaign
  'vero_id', 'vero_conv', 'sc_campaign', 'sc_channel', 'sc_content',
  'sc_medium', 'sc_outcome', 'sc_regionid', 'sc_trk',
  's_cid', 'ef_id', 's_kwcid', 'pk_campaign', 'pk_kwd', 'piwik_campaign',
  'piwik_kwd', 'matomo_campaign', 'matomo_kwd',
]);

/** True for params like utm_source, utm_medium, ... */
function isUtm(name) {
  return name.toLowerCase().startsWith('utm_');
}

let enabled = true;
let siteDisabled = false;

/** Load settings (global toggle + per-site list). */
async function loadSettings() {
  try {
    const { enabled: e = true, disabledSites = [] } = await chrome.storage.local.get(['enabled', 'disabledSites']);
    enabled = e !== false;
    siteDisabled = disabledSites.includes(location.hostname);
  } catch {
    // storage unavailable — fail open with stripping enabled
  }
}

loadSettings();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled) enabled = changes.enabled.newValue !== false;
  if (changes.disabledSites) siteDisabled = (changes.disabledSites.newValue || []).includes(location.hostname);
});

/**
 * Return a cleaned URL string, or null if nothing was stripped.
 * Only http(s) URLs are touched; mailto:, javascript:, data:, etc. are left alone.
 */
function stripTrackers(rawHref) {
  let url;
  try {
    url = new URL(rawHref, location.href);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  let stripped = 0;
  for (const name of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(name.toLowerCase()) || isUtm(name)) {
      url.searchParams.delete(name);
      stripped++;
    }
  }
  return stripped > 0 ? { url: url.toString(), stripped } : null;
}

/** Intercept clicks on links in the capture phase, before navigation. */
document.addEventListener('click', (event) => {
  if (!enabled || siteDisabled) return;
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; // let modified clicks (new tab etc.) pass through untouched

  const anchor = event.target.closest('a[href]');
  if (!anchor) return;

  const cleaned = stripTrackers(anchor.getAttribute('href'));
  if (!cleaned) return;

  // Report to the popup counter (best-effort; content scripts can't reach the popup directly).
  chrome.runtime.sendMessage({
    type: 'stripped',
    count: cleaned.stripped,
    from: anchor.getAttribute('href'),
    to: cleaned.url,
    host: location.hostname,
  }).catch(() => {});

  // Navigate to the cleaned URL instead of the tracked one.
  event.preventDefault();
  event.stopPropagation();
  location.assign(cleaned.url);
}, true);
