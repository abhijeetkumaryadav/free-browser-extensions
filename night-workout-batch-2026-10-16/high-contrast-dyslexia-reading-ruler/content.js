/* ReadRuler content script — injected on demand. Renders a follow-the-mouse
   reading ruler and applies dyslexia-friendly text adjustments. Fully
   reversible: 'readruler-remove' tears everything down. */
'use strict';

(function () {
  // Guard against double-injection.
  if (window.__readrulerLoaded) return;
  window.__readrulerLoaded = true;

  const RULER_ID = 'readruler-band';
  const STYLE_ID = 'readruler-styles';
  let rulerEl = null;
  let rafPending = false;
  let mouseY = window.innerHeight / 2;

  const FONT_STACKS = {
    readable: "Verdana, Geneva, Tahoma, 'Segoe UI', sans-serif",
    verdana: "Verdana, Geneva, sans-serif",
    none: null
  };

  /* Build the <style> block for dyslexia adjustments. */
  function buildCss(s) {
    const rules = [];
    if (s.dysEnabled) {
      const stack = FONT_STACKS[s.fontStack] || FONT_STACKS.readable;
      let body = '';
      if (stack) body += `font-family: ${stack} !important;`;
      body += `letter-spacing: ${s.letterSpacing}em !important;`;
      body += `word-spacing: ${s.wordSpacing}em !important;`;
      body += `line-height: ${s.lineHeight} !important;`;
      // Apply to text-bearing elements only, never inputs/buttons.
      rules.push(
        `.readruler-dys p, .readruler-dys li, .readruler-dys h1, .readruler-dys h2, ` +
        `.readruler-dys h3, .readruler-dys h4, .readruler-dys blockquote, ` +
        `.readruler-dys article, .readruler-dys section, .readruler-dys td, ` +
        `.readruler-dys dd, .readruler-dys figcaption { ${body} }`
      );
    }
    return rules.join('\n');
  }

  /* Create / update the ruler band. */
  function ensureRuler(s) {
    if (!s.rulerEnabled) { removeRuler(); return; }
    if (!rulerEl) {
      rulerEl = document.createElement('div');
      rulerEl.id = RULER_ID;
      rulerEl.setAttribute('aria-hidden', 'true');
      document.documentElement.appendChild(rulerEl);
      document.addEventListener('mousemove', onMouseMove, { passive: true });
    }
    const opacity = s.rulerOpacity / 100;
    rulerEl.style.cssText =
      'position: fixed !important; left: 0 !important; right: 0 !important; ' +
      'top: ' + (mouseY - s.rulerHeight / 2) + 'px !important; ' +
      'height: ' + s.rulerHeight + 'px !important; ' +
      'background: ' + s.rulerColor + ' !important; ' +
      'opacity: ' + opacity + ' !important; ' +
      'border-top: 2px solid ' + s.rulerColor + ' !important; ' +
      'border-bottom: 2px solid ' + s.rulerColor + ' !important; ' +
      'pointer-events: none !important; z-index: 2147483647 !important;';
  }

  function removeRuler() {
    if (rulerEl) { rulerEl.remove(); rulerEl = null; }
    document.removeEventListener('mousemove', onMouseMove);
  }

  function onMouseMove(e) {
    mouseY = e.clientY;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      if (rulerEl) {
        const h = parseFloat(rulerEl.style.height) || 44;
        rulerEl.style.top = (mouseY - h / 2) + 'px';
      }
    });
  }

  /* Apply dyslexia adjustments via a <style> tag + marker class. */
  function ensureDysStyles(s) {
    removeDysStyles();
    const css = buildCss(s);
    if (!css) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.documentElement.appendChild(style);
    document.documentElement.classList.add('readruler-dys');
  }

  function removeDysStyles() {
    const old = document.getElementById(STYLE_ID);
    if (old) old.remove();
    document.documentElement.classList.remove('readruler-dys');
  }

  /* Message API from the popup. */
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'readruler-apply') {
      ensureRuler(msg.settings);
      ensureDysStyles(msg.settings);
    } else if (msg.type === 'readruler-remove') {
      removeRuler();
      removeDysStyles();
    }
  });
})();
