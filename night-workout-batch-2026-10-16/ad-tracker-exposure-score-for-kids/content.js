/* KidTrack Shield — content script (runs on demand, observe-only).
 * Collects: third-party resource hosts, likely tracking pixels, tracker-list hits.
 * Never modifies the page, never transmits anything. */
/* global chrome */
(() => {
  'use strict';

  // Sample list of well-known tracker/ad-tech hostnames. Labeled SAMPLE in UI.
  const SAMPLE_TRACKERS = [
    'doubleclick.net', 'google-analytics.com', 'googletagmanager.com',
    'googlesyndication.com', 'facebook.net', 'connect.facebook.net',
    'analytics.twitter.com', 'ads-twitter.com', 'criteo.com', 'criteo.net',
    'outbrain.com', 'taboola.com', 'hotjar.com', 'fullstory.com',
    'mixpanel.com', 'segment.io', 'segment.com', 'amplitude.com',
    'newrelic.com', 'nr-data.net', 'quantserve.com', 'scorecardresearch.com',
    'moatads.com', 'adsrvr.org', 'ads.yahoo.com', 'bing.com/bat',
    'snap.licdn.com', 'px.ads.linkedin.com', 'tiktokv.com',
    'analytics.tiktok.com', 'pinterest.com/ct', 'snapchat.com'
  ];

  /** Hostname of a URL, or null on failure. */
  function hostOf(url) {
    try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
  }

  /** True if host is third-party relative to the page host. */
  function isThirdParty(host, pageHost) {
    if (!host || !pageHost) return false;
    if (host === pageHost) return false;
    const base = (h) => h.split('.').slice(-2).join('.');
    return base(host) !== base(pageHost);
  }

  /** Does host match an entry in the sample tracker list (suffix match)? */
  function trackerMatch(host) {
    for (const t of SAMPLE_TRACKERS) {
      if (host === t || host.endsWith('.' + t)) return t;
    }
    return null;
  }

  function scan() {
    const pageHost = location.hostname.toLowerCase();
    const thirdPartyHosts = new Map(); // host -> count
    const trackerHits = new Map();     // host -> matched sample entry

    // 1) Resource Timing entries: every subresource the page loaded.
    const entries = (performance.getEntriesByType('resource') || []);
    for (const e of entries) {
      const h = hostOf(e.name);
      if (!h || !isThirdParty(h, pageHost)) continue;
      thirdPartyHosts.set(h, (thirdPartyHosts.get(h) || 0) + 1);
      const m = trackerMatch(h);
      if (m) trackerHits.set(h, m);
    }

    // 2) Tracking pixels: tiny or hidden images + suspicious names.
    const pixels = [];
    const imgs = document.querySelectorAll('img');
    const suspicious = /track|pixel|beacon|1x1|spacer|analytics|impression|view\?|collect/i;
    for (const img of imgs) {
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      const style = getComputedStyle(img);
      const hidden = style.display === 'none' || style.visibility === 'hidden' ||
                     img.hasAttribute('hidden') || img.width <= 1 || img.height <= 1;
      const src = img.currentSrc || img.src || '';
      const tiny = (w > 0 && w <= 2 && h > 0 && h <= 2);
      if (tiny || hidden || suspicious.test(src)) {
        pixels.push({
          host: hostOf(src),
          src: src.slice(0, 140),
          reason: tiny ? 'tiny image (1–2px)' : hidden ? 'hidden image' : 'suspicious name'
        });
      }
    }

    // 3) Suspicious scripts/iframes from tracker-sounding hosts.
    const beacons = [];
    for (const el of document.querySelectorAll('script[src], iframe[src]')) {
      const h = hostOf(el.src);
      if (!h || !isThirdParty(h, pageHost)) continue;
      const m = trackerMatch(h);
      if (m && !trackerHits.has(h)) {
        trackerHits.set(h, m);
        beacons.push({ host: h, tag: el.tagName.toLowerCase() });
      }
    }

    const thirdPartyCount = [...thirdPartyHosts.values()].reduce((a, b) => a + b, 0);

    return {
      pageHost,
      thirdPartyRequests: thirdPartyCount,
      thirdPartyHosts: thirdPartyHosts.size,
      trackerHosts: [...trackerHits.keys()],
      pixels: pixels.slice(0, 12),
      pixelCount: pixels.length
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'kidtrack-scan') {
      try {
        sendResponse({ ok: true, result: scan() });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message || err) });
      }
    }
    return false;
  });
})();
