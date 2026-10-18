/* Alt Text Gap Finder — content script.
 * Scans the page for images missing usable alt text and overlays styled
 * placeholder badges (filename + rendered dimensions). Drafts heuristic alt
 * suggestions from the filename ONLY — clearly labeled, never AI vision.
 * Everything runs locally; nothing leaves the page. */
(() => {
  'use strict';

  const BADGE_ATTR = 'data-altgap-badge';
  const OVERLAY_CLASS = '__altgap-overlay';
  const STYLE_ID = '__altgap-styles';

  /* ---------- heuristics ---------- */

  // Extract a display filename from a URL-ish src.
  function filenameFromSrc(src) {
    try {
      const u = new URL(src, location.href);
      const parts = u.pathname.split('/').filter(Boolean);
      return decodeURIComponent(parts[parts.length - 1] || 'image');
    } catch {
      return String(src).split('/').pop().split('?')[0] || 'image';
    }
  }

  // Draft a starting-point alt suggestion from the filename.
  // Purely textual munging — this is NOT image analysis.
  function suggestAlt(src) {
    const raw = filenameFromSrc(src).replace(/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i, '');
    const words = raw
      .split(/[-_.\s+()]+/)
      .map(w => w.trim())
      .filter(w => w.length > 0 && !/^\d{5,}$/.test(w) && !/^[0-9a-f]{16,}$/i.test(w));
    if (words.length === 0) return 'Image (rename-aware description needed)';
    const pretty = words
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return `Image: ${pretty}`;
  }

  // True if the element is effectively visible to a scanner.
  function isRendered(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  /* ---------- scanning ---------- */

  function collectImages() {
    const out = [];
    // <img>, <input type=image>, and ARIA image roles.
    const nodes = document.querySelectorAll('img, input[type="image"], [role="img"]');
    nodes.forEach((el, idx) => {
      const alt = el.getAttribute('alt');
      const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
      const hasAlt = alt !== null && alt.trim() !== '';
      if (hasAlt || ariaLabel) return; // usable alternative text present
      if (!isRendered(el)) return;
      const src = el.currentSrc || el.src || el.getAttribute('src') || '(inline / srcset)';
      const r = el.getBoundingClientRect();
      out.push({
        index: idx,
        filename: filenameFromSrc(src),
        src: src.length > 160 ? src.slice(0, 160) + '…' : src,
        width: Math.round(r.width),
        height: Math.round(r.height),
        empty: alt !== null, // alt="" present but empty
        suggestion: suggestAlt(src)
      });
    });
    return out;
  }

  function targetFor(issue) {
    // Re-resolve the element by document order among candidates.
    const nodes = document.querySelectorAll('img, input[type="image"], [role="img"]');
    return nodes[issue.index] || null;
  }

  /* ---------- overlay badges ---------- */

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      .${OVERLAY_CLASS} {
        position: absolute; z-index: 2147483647; pointer-events: auto;
        background: rgba(6, 20, 14, 0.92); border: 1px dashed #34d399;
        border-radius: 8px; color: #d1fae5; font: 11px/1.4 -apple-system, "Segoe UI", sans-serif;
        padding: 6px 8px; max-width: 240px; box-shadow: 0 4px 14px rgba(0,0,0,.5);
        cursor: default;
      }
      .${OVERLAY_CLASS} .__altgap-t { font-weight: 700; color: #34d399; font-size: 10px;
        text-transform: uppercase; letter-spacing: .05em; margin-bottom: 2px; }
      .${OVERLAY_CLASS} .__altgap-f { word-break: break-all; }
      .${OVERLAY_CLASS} .__altgap-d { color: #94a3b8; }
      .${OVERLAY_CLASS} button {
        margin-top: 4px; margin-right: 4px; font-size: 10px; padding: 3px 8px;
        border-radius: 5px; border: 1px solid #34d399; background: transparent;
        color: #34d399; cursor: pointer;
      }
      .${OVERLAY_CLASS} button:hover { background: rgba(52,211,153,.15); }
      .${OVERLAY_CLASS}.__altgap-dim { opacity: .35; }
      img[${BADGE_ATTR}], input[${BADGE_ATTR}] { outline: 2px dashed #34d399 !important; outline-offset: 2px; }
    `;
    document.documentElement.appendChild(s);
  }

  function placeBadge(el, issue) {
    clearBadge(el);
    ensureStyles();
    const badge = document.createElement('div');
    badge.className = OVERLAY_CLASS;
    badge.innerHTML = `
      <div class="__altgap-t">Missing alt text</div>
      <div class="__altgap-f"></div>
      <div class="__altgap-d"></div>
      <button type="button" data-act="suggest">Suggest alt</button>
      <button type="button" data-act="copy">Copy suggestion</button>
      <button type="button" data-act="dismiss">Dismiss</button>`;
    badge.querySelector('.__altgap-f').textContent = issue.filename;
    badge.querySelector('.__altgap-d').textContent = `${issue.width} × ${issue.height}px${issue.empty ? ' · alt="" empty' : ' · no alt attr'}`;
    badge.addEventListener('click', (e) => {
      const act = e.target.dataset.act;
      if (act === 'suggest') {
        alert(`Heuristic suggestion (from filename only — NOT image analysis):\n\n${issue.suggestion}\n\nReview and rewrite before using.`);
      } else if (act === 'copy') {
        navigator.clipboard.writeText(issue.suggestion).catch(() => {});
        e.target.textContent = 'Copied!';
        setTimeout(() => { e.target.textContent = 'Copy suggestion'; }, 1200);
      } else if (act === 'dismiss') {
        badge.classList.add('__altgap-dim');
      }
    });
    // Position over the image (page coordinates).
    const r = el.getBoundingClientRect();
    badge.style.left = `${window.scrollX + r.left}px`;
    badge.style.top = `${window.scrollY + Math.max(0, r.top - 4)}px`;
    badge.dataset.forIndex = issue.index;
    document.body.appendChild(badge);
    el.setAttribute(BADGE_ATTR, '1');
    return badge;
  }

  function clearBadge(el) {
    el.removeAttribute(BADGE_ATTR);
    document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach(b => {
      if (b.dataset.forIndex === String(el.getAttribute('data-altgap-idx'))) b.remove();
    });
  }

  function clearAll() {
    document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach(b => b.remove());
    document.querySelectorAll(`[${BADGE_ATTR}]`).forEach(el => el.removeAttribute(BADGE_ATTR));
    const s = document.getElementById(STYLE_ID);
    if (s) s.remove();
  }

  /* ---------- message API ---------- */

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'ping') { sendResponse({ ok: true }); return true; }
    if (msg.type === 'altgap-scan') {
      const issues = collectImages();
      ensureStyles();
      issues.forEach(issue => {
        const el = targetFor(issue);
        if (el) { el.setAttribute('data-altgap-idx', issue.index); placeBadge(el, issue); }
      });
      const total = document.querySelectorAll('img, input[type="image"]').length;
      sendResponse({
        ok: true,
        issues,
        total,
        empty: issues.filter(i => i.empty).length
      });
      return true;
    }
    if (msg.type === 'altgap-clear') {
      clearAll();
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });
})();
