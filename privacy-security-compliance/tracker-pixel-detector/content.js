/* Tracker Pixel Detector — content script.
 * Scans the DOM for tracking pixels/beacons. Read-only: never modifies the
 * page except when the user explicitly enables "hide pixels" (reversible). */
'use strict';

/* Curated list of well-known analytics / ad / tracking hosts. Heuristic only. */
const TRACKER_DOMAINS = [
  'google-analytics.com', 'googletagmanager.com', 'analytics.google.com',
  'facebook.net', 'fbcdn.net', 'connect.facebook.net',
  'doubleclick.net', 'googlesyndication.com', 'adservice.google.com',
  'hotjar.com', 'mixpanel.com', 'cdn.mxpnl.com',
  'segment.io', 'cdn.segment.com', 'fullstory.com', 'fssta.com',
  'criteo.com', 'taboola.com', 'outbrain.com', 'adsrvr.org', 'adnxs.com',
  'quantserve.com', 'scorecardresearch.com', 'newrelic.com', 'nr-data.net',
  'intercom.io', 'drift.com', 'hubspot.com', 'hs-scripts.com',
  'marketo.net', 'pardot.com', 'klaviyo.com', 'bat.bing.com',
  'analytics.tiktok.com', 'px.ads.linkedin.com', 'ads.linkedin.com',
  'ct.pinterest.com', 'static.ads-twitter.com', 'analytics.twitter.com',
  'cdn.mouseflow.com', 'luckyorange.com', 'inspectlet.com', 'crazyegg.com'
];

function domainOf(url) {
  try { return new URL(url, location.href).hostname.replace(/^www\./, '').toLowerCase(); }
  catch (e) { return ''; }
}

function matchesTracker(host) {
  if (!host) return false;
  return TRACKER_DOMAINS.some(d => host === d || host.endsWith('.' + d));
}

function isHidden(el) {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return cs.display === 'none' || cs.visibility === 'hidden' ||
         parseFloat(cs.opacity) === 0 || r.width === 0 || r.height === 0;
}

function isTiny(el) {
  const r = el.getBoundingClientRect();
  return r.width <= 1 && r.height <= 1;
}

/* Scan the page. Returns [{src, domain, types[]}]. Tags flagged nodes so the
 * hide-toggle can target them without re-scanning. */
function scan() {
  const seen = new Map();
  const push = (el, src, types) => {
    if (!src || src.startsWith('data:')) return;
    el.setAttribute('data-tpd-flag', '1');
    if (seen.has(src)) {
      const e = seen.get(src);
      types.forEach(t => { if (!e.types.includes(t)) e.types.push(t); });
    } else {
      seen.set(src, { src, domain: domainOf(src), types: [...types] });
    }
  };

  document.querySelectorAll('img').forEach(img => {
    const src = img.currentSrc || img.src;
    const t = [];
    if (isTiny(img)) t.push('1×1 pixel');
    else if (isHidden(img)) t.push('Hidden image');
    if (matchesTracker(domainOf(src))) t.push('Tracker domain');
    if (t.length) push(img, src, t);
  });

  document.querySelectorAll('script[src], iframe[src], link[rel="preload"][as="image"]').forEach(n => {
    const src = n.src || n.href;
    if (matchesTracker(domainOf(src))) push(n, src, ['Tracker domain']);
  });

  return [...seen.values()];
}

let hideStyle = null;
function setHidden(on) {
  if (on) {
    if (!hideStyle) {
      hideStyle = document.createElement('style');
      hideStyle.id = 'tpd-hide-style';
      hideStyle.textContent = '[data-tpd-flag]{display:none !important;}';
      document.documentElement.appendChild(hideStyle);
    }
  } else if (hideStyle) {
    hideStyle.remove();
    hideStyle = null;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'tpd-scan') sendResponse({ items: scan() });
  else if (msg.action === 'tpd-hide') { setHidden(!!msg.enable); sendResponse({ ok: true }); }
  return true;
});
