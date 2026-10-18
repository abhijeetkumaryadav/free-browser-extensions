/* Canvas Pixel Locator — on-demand content scanner (runs in MAIN world so it can
 * observe canvas pixel-read calls). Defensive, read-only: observes only. */
(() => {
  if (window.__cplScanned) return window.__cplScanned;
  const findings = [];

  const push = (severity, title, description) =>
    findings.push({ severity, title, description });

  const pageHost = location.hostname;

  /* ------------------------------------------------------------------
   * 1. Canvas fingerprinting detection
   * ------------------------------------------------------------------ */
  // 1a. Live hooks: fingerprinting often draws text/shapes to a small canvas
  //     then reads pixels via getImageData / toDataURL / toBlob. We hook these
  //     for the scan window and record fingerprint-shaped calls.
  const fpReads = [];
  try {
    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    CanvasRenderingContext2D.prototype.getImageData = function (sx, sy, sw, sh) {
      try {
        const c = this.canvas;
        if (c && (c.width <= 64 || c.height <= 64)) {
          fpReads.push({ type: 'getImageData', size: c.width + 'x' + c.height });
        }
      } catch (e) { /* ignore */ }
      return origGetImageData.apply(this, arguments);
    };
    HTMLCanvasElement.prototype.toDataURL = function () {
      try {
        if (this.width <= 64 || this.height <= 64) {
          fpReads.push({ type: 'toDataURL', size: this.width + 'x' + this.height });
        }
      } catch (e) { /* ignore */ }
      return origToDataURL.apply(this, arguments);
    };
  } catch (e) { /* prototype patching blocked — skip live hooks */ }

  // 1b. Static scan: hidden / tiny / offscreen canvases are a classic
  //     fingerprinting or tracking vehicle.
  const canvases = Array.from(document.querySelectorAll('canvas'));
  let suspiciousCanvas = 0;
  canvases.forEach((c) => {
    const r = c.getBoundingClientRect();
    const style = getComputedStyle(c);
    const hidden =
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      (r.width === 0 && r.height === 0) ||
      r.left < -1000 || r.top < -1000;
    const tiny = (c.width > 0 && c.width <= 32) || (c.height > 0 && c.height <= 32);
    if (hidden || tiny) suspiciousCanvas++;
  });
  if (suspiciousCanvas > 0) {
    push('medium', 'Suspicious hidden/tiny canvas',
      suspiciousCanvas + ' canvas element(s) are hidden, off-screen, or unusually tiny ' +
      '(≤32px). Fingerprinting scripts commonly use invisible canvases to render text ' +
      'and read the pixels. Legitimate uses exist (thumbnails, offscreen rendering), ' +
      'so this is an indicator, not proof.');
  }
  if (fpReads.length > 0) {
    push('high', 'Live canvas pixel reads detected',
      fpReads.length + ' pixel-read call(s) on small canvases (' +
      fpReads.slice(0, 3).map((f) => f.type + ' ' + f.size).join(', ') +
      ') during the scan window. Reading pixels from a small canvas after drawing ' +
      'is the core mechanism of canvas fingerprinting.');
  }

  /* ------------------------------------------------------------------
   * 2. Hidden 1px tracking images
   * ------------------------------------------------------------------ */
  const imgs = Array.from(document.querySelectorAll('img'));
  const pxNames = /(pixel|beacon|track|1x1|spacer|clear\.gif|dot\.gif)/i;
  let pxCount = 0;
  const pxHosts = new Set();
  imgs.forEach((img) => {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const src = img.currentSrc || img.src || '';
    const tiny = (w === 1 && h === 1) || (w <= 2 && h <= 2);
    const hiddenImg = getComputedStyle(img).display === 'none';
    if ((tiny || hiddenImg) && src) {
      pxCount++;
      try { pxHosts.add(new URL(src, location.href).hostname); } catch (e) { /* ignore */ }
    } else if (pxNames.test(src) && src) {
      pxCount++;
      try { pxHosts.add(new URL(src, location.href).hostname); } catch (e) { /* ignore */ }
    }
  });
  if (pxCount > 0) {
    push('medium', 'Hidden tracking pixels',
      pxCount + ' tiny or hidden image(s) found' +
      (pxHosts.size ? ' served by: ' + Array.from(pxHosts).slice(0, 5).join(', ') : '') +
      '. Single-pixel and hidden images are a classic tracking vehicle ' +
      '(load the image → server logs the request).');
  }

  /* ------------------------------------------------------------------
   * 3. Third-party requests to known tracker domains
   * ------------------------------------------------------------------ */
  // Sample list only — the full tracking ecosystem is far larger.
  const TRACKER_SAMPLE = [
    'google-analytics.com', 'googletagmanager.com', 'doubleclick.net',
    'facebook.net', 'connect.facebook.net', 'hotjar.com', 'fullstory.com',
    'mixpanel.com', 'segment.io', 'amplitude.com', 'matomo.cloud',
    'crazyegg.com', 'mouseflow.com', 'luckyorange.com', 'clarity.ms',
    'newrelic.com', 'datadoghq.com', 'scorecardresearch.com', 'quantserve.com',
    'outbrain.com', 'taboola.com', 'criteo.com', 'adsrvr.org', 'adnxs.com',
    'pubmatic.com', 'rubiconproject.com', 'openx.net', 'moatads.com',
    'demdex.net', 'bluekai.com', 'crwdcntrl.net', 'agkn.com', 'mathtag.com'
  ];
  const hitHosts = {};
  try {
    performance.getEntriesByType('resource').forEach((r) => {
      try {
        const u = new URL(r.name);
        if (u.hostname && u.hostname !== pageHost) {
          const match = TRACKER_SAMPLE.find((t) => u.hostname.includes(t));
          if (match) hitHosts[u.hostname] = (hitHosts[u.hostname] || 0) + 1;
        }
      } catch (e) { /* ignore */ }
    });
  } catch (e) { /* performance API unavailable */ }
  const trackerHosts = Object.keys(hitHosts);
  if (trackerHosts.length > 0) {
    const total = trackerHosts.reduce((s, h) => s + hitHosts[h], 0);
    push('high', 'Known tracker endpoints contacted',
      total + ' request(s) to ' + trackerHosts.length + ' known tracking domain(s): ' +
      trackerHosts.slice(0, 8).join(', ') +
      '. Matched against a sample list of well-known trackers — the real list is larger.');
  }

  /* ------------------------------------------------------------------
   * Score: 100 = clean, lower = more indicators
   * ------------------------------------------------------------------ */
  let score = 100;
  findings.forEach((f) => {
    score -= f.severity === 'high' ? 25 : f.severity === 'medium' ? 12 : 5;
  });
  score = Math.max(0, score);

  const result = {
    score,
    canvasCount: canvases.length,
    imageCount: imgs.length,
    thirdPartyTrackers: trackerHosts.length,
    findings
  };
  window.__cplScanned = result;
  return result;
})();
