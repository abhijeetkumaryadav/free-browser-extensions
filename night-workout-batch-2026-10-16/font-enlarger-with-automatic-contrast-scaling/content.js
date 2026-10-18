/* Font Enlarger + Auto Contrast — content script.
 * - Enlarges page fonts by a user-chosen factor (per-element, originals preserved).
 * - Automatically boosts text contrast toward a target WCAG-ish ratio.
 * - Auto-applies on load only when the user enabled "Remember for this site".
 * 100% local. Fully reversible via reset(). */

(function () {
  'use strict';

  const MARK = 'data-feac-applied';   // marks processed elements
  const MAX_ELEMENTS = 3000;          // performance cap per pass

  /* ---------- colour helpers ---------- */

  function parseRGB(str) {
    const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/.exec(str || '');
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }

  function luminance({ r, g, b }) {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  function contrastRatio(fg, bg) {
    const l1 = luminance(fg), l2 = luminance(bg);
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h, s, l };
  }

  function hslToRgb({ h, s, l }) {
    const hue = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue(p, q, h + 1 / 3); g = hue(p, q, h); b = hue(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: 1 };
  }

  function css(c) {
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  }

  // Effective background: walk up until a non-transparent background is found.
  function effectiveBg(el) {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = parseRGB(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0.05) return { r: bg.r, g: bg.g, b: bg.b, a: 1 };
      node = node.parentElement;
    }
    const rootBg = parseRGB(getComputedStyle(document.documentElement).backgroundColor);
    if (rootBg && rootBg.a > 0.05) return { r: rootBg.r, g: rootBg.g, b: rootBg.b, a: 1 };
    return { r: 255, g: 255, b: 255, a: 1 }; // default: white page
  }

  // Nudge a foreground colour's lightness toward black or white until the
  // target contrast ratio is met (or we run out of steps). Preserves hue.
  function boostToTarget(fg, bg, target) {
    if (contrastRatio(fg, bg) >= target) return null;
    const hsl = rgbToHsl(fg);
    const bgLum = luminance(bg);
    // Move away from the background's lightness: darken on light bg, lighten on dark bg.
    const dir = bgLum > 0.35 ? -1 : 1;
    let best = null;
    for (let i = 1; i <= 20; i++) {
      const l = Math.min(1, Math.max(0, hsl.l + dir * (i / 20)));
      const cand = hslToRgb({ h: hsl.h, s: hsl.s, l });
      if (contrastRatio(cand, bg) >= target) { best = cand; break; }
      best = cand; // keep the strongest nudge even if target unreachable
    }
    return best;
  }

  /* ---------- element collection ---------- */

  function textElements() {
    const els = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      const el = node.parentElement;
      if (!el || seen.has(el)) continue;
      const tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
      seen.add(el);
      els.push(el);
      if (els.length >= MAX_ELEMENTS) break;
    }
    return els.filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden';
    });
  }

  /* ---------- apply / reset ---------- */

  function stash(el) {
    if (!el.hasAttribute(MARK)) {
      el.setAttribute(MARK, '1');
      el.dataset.feacFont = el.style.fontSize || '';
      el.dataset.feacLine = el.style.lineHeight || '';
      el.dataset.feacColor = el.style.color || '';
    }
  }

  function apply(settings) {
    reset(true); // start from a clean slate (silent)
    const factor = settings.scale / 100;
    const doContrast = settings.contrastOn !== false;
    const target = settings.target || 4.5;

    for (const el of textElements()) {
      stash(el);
      const cs = getComputedStyle(el);

      // 1. Font scaling (skip absurd sizes to avoid breaking icon fonts)
      const px = parseFloat(cs.fontSize);
      if (px && px >= 6 && px <= 96) {
        el.style.fontSize = (px * factor).toFixed(1) + 'px';
      }
      // Scale px-based line-heights proportionally; leave unitless alone
      if (cs.lineHeight && cs.lineHeight.endsWith('px')) {
        const lh = parseFloat(cs.lineHeight);
        if (lh) el.style.lineHeight = (lh * factor).toFixed(1) + 'px';
      }

      // 2. Automatic contrast boost
      if (doContrast) {
        const fg = parseRGB(cs.color);
        if (fg && fg.a > 0.05) {
          const bg = effectiveBg(el);
          const boosted = boostToTarget({ r: fg.r, g: fg.g, b: fg.b, a: 1 }, bg, target);
          if (boosted) el.style.color = css(boosted);
        }
      }
    }
    document.documentElement.setAttribute(MARK, 'applied');
  }

  function reset(silent) {
    const marked = document.querySelectorAll('[' + MARK + ']');
    marked.forEach((el) => {
      if (el.dataset.feacFont !== undefined) el.style.fontSize = el.dataset.feacFont;
      if (el.dataset.feacLine !== undefined) el.style.lineHeight = el.dataset.feacLine;
      if (el.dataset.feacColor !== undefined) el.style.color = el.dataset.feacColor;
      delete el.dataset.feacFont; delete el.dataset.feacLine; delete el.dataset.feacColor;
      el.removeAttribute(MARK);
    });
    document.documentElement.removeAttribute(MARK);
    if (!silent) { /* status re-queried by popup */ }
  }

  function status() {
    return { applied: document.documentElement.getAttribute(MARK) === 'applied' };
  }

  /* ---------- messaging ---------- */

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'feac') return;
    try {
      if (msg.action === 'apply') { apply(msg.settings); sendResponse({ ok: true, ...status() }); }
      else if (msg.action === 'reset') { reset(); sendResponse({ ok: true, ...status() }); }
      else if (msg.action === 'status') { sendResponse({ ok: true, ...status() }); }
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
    return true;
  });

  /* ---------- auto-apply for remembered sites ---------- */

  function hostOf(url) {
    try { return new URL(url).hostname; } catch { return ''; }
  }

  async function autoApply() {
    try {
      const { sites } = await chrome.storage.local.get(['sites']);
      const host = hostOf(location.href);
      if (host && sites && sites[host] && sites[host].enabled !== false) {
        apply(sites[host]);
      }
    } catch { /* storage unavailable — stay inert */ }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    autoApply();
  } else {
    document.addEventListener('DOMContentLoaded', autoApply, { once: true });
  }
})();
