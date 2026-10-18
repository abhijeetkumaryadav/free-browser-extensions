"use strict";
/* =====================================================================
 * Calm Mode — content script (declutter engine).
 *
 * Honest scope: heuristic declutter. Elements are matched against
 * common clutter selectors (ads, popups, sidebars, banners). Matched
 * nodes are hidden via an injected stylesheet class; non-text areas
 * can be dimmed. Toggle-off removes everything and restores the page.
 * The page DOM is never modified — only visibility styles change.
 * =================================================================== */
(function () {
  if (window.__calmModeActive) return;
  window.__calmModeActive = true;

  /* ---------- Heuristic clutter selectors ---------- */
  const CLUTTER = [
    /* ads */
    '[id*="ad-"],[id*="ads"],[class*="advert"],[class*="adsbygoogle"],iframe[src*="doubleclick"]',
    /* cookie banners / popups */
    '[id*="cookie"],[class*="cookie"],[id*="consent"],[class*="consent-banner"],[role="dialog"][aria-modal="true"]',
    /* newsletter / subscribe popups */
    '[class*="newsletter"],[id*="newsletter"],[class*="subscribe-popup"],[class*="modal-overlay"]',
    /* sidebars & rails (common clutter zones) */
    'aside,[class*="sidebar"],[id*="sidebar"],[class*="rail"],[id*="rail"]',
    /* sticky promo bars */
    '[class*="promo-bar"],[id*="promo"],[class*="announcement-bar"]',
    /* social share rails */
    '[class*="share-rail"],[class*="social-share"],[id*="share-buttons"]'
  ].join(",");

  const STYLE_ID = "__calmModeStyle";
  let styleEl = null;

  function buildCSS(dimLevel) {
    return `
      .__calm-hidden { display: none !important; }
      body.__calm-dim img, body.__calm-dim video, body.__calm-dim iframe,
      body.__calm-dim figure { opacity: ${(1 - dimLevel / 100 * 0.7).toFixed(2)} !important; }
      body.__calm-dim aside, body.__calm-dim nav { opacity: 0.35 !important; }
    `;
  }

  /* Hide clutter nodes (record them so we can unhide precisely). */
  function applyDeclutter() {
    removeDeclutter();
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    styleEl.textContent = buildCSS(0);
    document.documentElement.appendChild(styleEl);

    document.querySelectorAll(CLUTTER).forEach((el) => {
      /* Keep the main article / main landmark visible. */
      if (el.closest("main,article,[role='main']")) return;
      if (el.tagName === "ASIDE" && el.closest("article")) return;
      el.classList.add("__calm-hidden");
    });
    return document.querySelectorAll(".__calm-hidden").length;
  }

  function removeDeclutter() {
    document.querySelectorAll(".__calm-hidden").forEach((el) => el.classList.remove("__calm-hidden"));
    const old = document.getElementById(STYLE_ID);
    if (old) old.remove();
    document.body && document.body.classList.remove("__calm-dim");
  }

  function applyDim(level) {
    if (!styleEl) return;
    styleEl.textContent = buildCSS(level);
    document.body.classList.toggle("__calm-dim", level > 0);
  }

  /* ---------- Messaging ---------- */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "CALM_APPLY") {
      const n = applyDeclutter();
      applyDim(msg.dim || 0);
      sendResponse({ ok: true, hidden: n });
      return true;
    }
    if (msg.type === "CALM_DIM") {
      applyDim(msg.dim || 0);
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === "CALM_REMOVE") {
      removeDeclutter();
      window.__calmModeActive = false;
      sendResponse({ ok: true });
      return true;
    }
  });
})();
