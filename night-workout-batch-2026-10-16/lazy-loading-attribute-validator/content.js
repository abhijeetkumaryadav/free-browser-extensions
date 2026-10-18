/* LazyLoad Validator — content script (on-demand injected, click-only)
   Audits <img> and <iframe> elements for lazy-loading hygiene. Read-only: never modifies the page. */
(() => {
  'use strict';

  /** Short label for an element, for display in the report. */
  function label(el) {
    const src = (el.getAttribute('src') || el.currentSrc || '').trim();
    const short = src.length > 60 ? '…' + src.slice(-57) : src;
    const tag = el.tagName.toLowerCase();
    return tag + (short ? ' · ' + short : ' · no-src');
  }

  /** Roughly: is this element below the fold? */
  function isBelowFold(el) {
    const r = el.getBoundingClientRect();
    return r.top > window.innerHeight;
  }

  /** Estimate of "large" — flagged as warning when natural size is huge. */
  function isHuge(el) {
    const w = el.naturalWidth || el.width || 0;
    const h = el.naturalHeight || el.height || 0;
    return w * h > 2000000; // > ~2MP
  }

  const findings = [];
  const imgs = Array.from(document.querySelectorAll('img'));
  const frames = Array.from(document.querySelectorAll('iframe'));

  let ok = 0;

  imgs.forEach((el) => {
    const loading = (el.getAttribute('loading') || '').toLowerCase();
    const decoding = (el.getAttribute('decoding') || '').toLowerCase();
    const below = isBelowFold(el);
    const huge = isHuge(el);

    if (loading === 'lazy') {
      ok++;
      findings.push({ sev: 'ok', el: label(el), fix: 'Correctly lazy-loads.' });
    } else if (below && !loading) {
      findings.push({ sev: 'error', el: label(el),
        fix: 'Below the fold with no loading="lazy". Add loading="lazy" decoding="async" to defer it.' });
    } else if (huge && loading !== 'lazy') {
      findings.push({ sev: 'warning', el: label(el),
        fix: 'Large image (' + (el.naturalWidth || '?') + 'px) eager-loading. Consider loading="lazy" or a smaller/optimized file.' });
    } else if (!decoding && !below) {
      ok++;
      findings.push({ sev: 'ok', el: label(el), fix: 'Above the fold; eager is fine. decoding="async" still helps.' });
    } else {
      findings.push({ sev: 'warning', el: label(el),
        fix: 'No loading attribute. Add loading="lazy" if below the fold, or loading="eager" + fetchpriority="high" for the hero image.' });
    }
  });

  frames.forEach((el) => {
    const loading = (el.getAttribute('loading') || '').toLowerCase();
    if (loading === 'lazy' || !isBelowFold(el)) { ok++; }
    else findings.push({ sev: 'error', el: label(el),
      fix: 'Below-fold iframe without loading="lazy". Add loading="lazy" to defer it.' });
  });

  const errors = findings.filter(f => f.sev === 'error').length;
  const warns = findings.filter(f => f.sev === 'warning').length;
  const total = imgs.length + frames.length;
  const score = total === 0 ? 100 : Math.max(0, 100 - errors * 12 - warns * 4);

  return { score, total, images: imgs.length, iframes: frames.length, errors, warns, ok, findings: findings.slice(0, 120) };
})();
