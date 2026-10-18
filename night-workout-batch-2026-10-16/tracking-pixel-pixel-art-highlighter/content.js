/* PixelHunt — content script (injected on demand via chrome.scripting).
 * Detects likely tracking pixels with simple heuristics and swaps them
 * for generated pixel-art placeholders. Fully reversible.
 * Note: functions exposed under window.__pixelHunt are invoked remotely,
 * so they must stay self-contained (no closures over popup state). */
(() => {
  'use strict';

  // Guard against double-injection on the same page.
  if (window.__pixelHunt) return;

  /* ---------- deterministic PRNG (mulberry-ish) for stable pixel art --- */
  function seededRandom(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* ---------- pixel-art placeholder (16x16 canvas -> data URL) ---------- */
  const PALETTE = ['#fb7185', '#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa'];

  function makePixelArt(seed) {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d');
    const rnd = seededRandom(seed * 2654435761 + 11);
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        ctx.fillStyle = PALETTE[Math.floor(rnd() * PALETTE.length)];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return c.toDataURL('image/png');
  }

  /* ---------- heuristic detection -------------------------------------- */
  // Matches suspicious tokens in an image URL (track, pixel, beacon, 1x1…)
  const SUSPICIOUS = /(\b|_|-|\.)(track|pixel|beacon|impression|analytics?|spacer|clear-?gif|1x1)(\b|_|-|\.)/i;

  function isCssHidden(el) {
    const cs = getComputedStyle(el);
    return cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0';
  }

  function analyze() {
    const results = [];
    const imgs = document.querySelectorAll('img');
    imgs.forEach((img, idx) => {
      const reasons = [];
      const rect = img.getBoundingClientRect();

      // 1) Physically tiny (the classic 1x1 / 2x2 tracker)
      if (rect.width <= 2 && rect.height <= 2) reasons.push('tiny (≤2px rendered)');

      // 2) Tiny natural size (e.g. scaled-up 1x1 gif)
      const nw = img.naturalWidth || 0;
      const nh = img.naturalHeight || 0;
      if (nw > 0 && nw <= 2 && nh <= 2) reasons.push('1–2px natural size');

      // 3) Hidden from view
      if (img.hasAttribute('hidden')) reasons.push('hidden attribute');
      if (isCssHidden(img)) reasons.push('hidden by CSS');

      // 4) Suspicious URL tokens
      const src = img.currentSrc || img.src || '';
      if (src && SUSPICIOUS.test(src)) reasons.push('suspicious URL');

      if (reasons.length === 0) return;

      let host = '';
      try {
        host = new URL(src, location.href).hostname;
      } catch (e) {
        host = '(unparseable)';
      }
      results.push({
        idx,
        src,
        host,
        rendered: Math.round(rect.width) + '×' + Math.round(rect.height),
        reasons
      });
    });
    return results;
  }

  /* ---------- highlight / restore -------------------------------------- */
  function highlight(items) {
    restore(); // start clean
    const imgs = document.querySelectorAll('img');
    items.forEach((item, k) => {
      const img = imgs[item.idx];
      if (!img) return;
      // Stash originals once so restore() is lossless.
      if (!img.hasAttribute('data-ph-orig')) {
        img.setAttribute('data-ph-orig', img.src);
        img.setAttribute('data-ph-title', img.title || '');
      }
      img.src = makePixelArt(k + 7);
      img.style.width = '30px';
      img.style.height = '30px';
      img.style.outline = '2px dashed #fb7185';
      img.style.outlineOffset = '2px';
      img.title = 'Possible tracking pixel — ' + item.reasons.join(', ');
    });
  }

  function restore() {
    document.querySelectorAll('img[data-ph-orig]').forEach((img) => {
      img.src = img.getAttribute('data-ph-orig');
      img.title = img.getAttribute('data-ph-title') || '';
      img.removeAttribute('data-ph-orig');
      img.removeAttribute('data-ph-title');
      img.style.width = '';
      img.style.height = '';
      img.style.outline = '';
      img.style.outlineOffset = '';
    });
  }

  /* ---------- remote-callable API --------------------------------------- */
  window.__pixelHunt = {
    scan() {
      const items = analyze();
      highlight(items);
      return items;
    },
    clear() {
      restore();
      return [];
    }
  };
})();
