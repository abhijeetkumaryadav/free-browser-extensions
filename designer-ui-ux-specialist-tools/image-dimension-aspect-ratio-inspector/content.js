// Image Dimension Inspector — content script.
// Injected only when the user clicks "Scan page images".
// Read-only: collects <img> data and can flash-highlight one on request.
// Nothing is sent anywhere; results go back to the popup.

'use strict';

(() => {
  if (window.__idiInjected) return;
  window.__idiInjected = true;

  const ACCENT = '#10b981';

  /* ---------- helpers ---------- */

  // Greatest common divisor — for reducing aspect ratios like 1920:1080 → 16:9.
  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { [a, b] = [b, a % b]; }
    return a || 1;
  }

  function ratioLabel(w, h) {
    if (!w || !h) return '—';
    const d = gcd(w, h);
    const rw = w / d, rh = h / d;
    // Don't show absurd reductions like 383:200 — cap at reasonable size.
    if (rw > 32 || rh > 32) return (w / h).toFixed(2) + ':1';
    return `${rw}:${rh}`;
  }

  function formatBytes(n) {
    if (n == null || n <= 0) return null;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  // Transfer size via the Resource Timing API (same data the DevTools show).
  // Returns null when unavailable (cross-origin without TAO, cached, etc.).
  function transferSize(url) {
    try {
      const entries = performance.getEntriesByType('resource');
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].name === url && entries[i].transferSize > 0) {
          return entries[i].transferSize;
        }
      }
    } catch { /* timing API unavailable */ }
    return null;
  }

  function shortSrc(img) {
    const src = img.currentSrc || img.src || '';
    if (src.startsWith('data:')) {
      const mime = src.slice(5, src.indexOf(';') > -1 ? src.indexOf(';') : 30);
      return `data:${mime};…`;
    }
    try {
      const u = new URL(src, location.href);
      const path = u.pathname + u.search;
      return u.host + (path.length > 42 ? path.slice(0, 42) + '…' : path);
    } catch {
      return src.length > 48 ? src.slice(0, 48) + '…' : src;
    }
  }

  /* ---------- scan ---------- */

  function scan() {
    const imgs = Array.from(document.querySelectorAll('img'));
    // Tag each with a stable index for highlight requests.
    imgs.forEach((img, i) => { img.dataset.idiIdx = String(i); });

    const items = imgs.map((img, i) => {
      const nw = img.naturalWidth || 0;
      const nh = img.naturalHeight || 0;
      const rect = img.getBoundingClientRect();
      const broken = img.complete && nw === 0 && !img.currentSrc.startsWith('data:') && img.src !== '';
      const lazy = img.loading === 'lazy' ||
        img.hasAttribute('data-src') || img.hasAttribute('data-lazy-src');
      const bytes = transferSize(img.currentSrc || img.src);
      return {
        idx: i,
        src: shortSrc(img),
        fullSrc: img.currentSrc || img.src || '',
        natural: nw && nh ? `${nw}×${nh}` : '—',
        displayed: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
        ratio: ratioLabel(nw, nh),
        lazy,
        broken,
        bytes,
        size: formatBytes(bytes),
      };
    });

    return {
      host: location.host,
      count: items.length,
      broken: items.filter((i) => i.broken).length,
      lazy: items.filter((i) => i.lazy).length,
      items,
    };
  }

  /* ---------- highlight ---------- */

  let flashTimer = null;

  function highlight(idx) {
    const img = document.querySelector(`img[data-idi-idx="${idx}"]`);
    if (!img) return false;
    img.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const prev = img.style.outline;
    const prevOffset = img.style.outlineOffset;
    img.style.outline = `3px solid ${ACCENT}`;
    img.style.outlineOffset = '3px';
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      img.style.outline = prev;
      img.style.outlineOffset = prevOffset;
    }, 1600);
    return true;
  }

  /* ---------- message bus ---------- */

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'idi-ping') { sendResponse({ ok: true }); return true; }
    if (msg.type === 'idi-scan') { sendResponse({ ok: true, data: scan() }); return true; }
    if (msg.type === 'idi-highlight') {
      sendResponse({ ok: highlight(msg.idx) });
      return true;
    }
    return false;
  });
})();
