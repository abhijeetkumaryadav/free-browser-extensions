/* OrigamiFold content script — injected on demand into the MAIN world.
 * Exposes window.__origamiFold() and window.__origamiUnfold().
 *
 * Technique: each visible direct child of <body> gets a staggered
 * rotateX(-84deg) collapse with a top transform-origin, inside a
 * perspective'd body — a 3D "paper fold" effect. All styles are inline
 * and removed on unfold, so the page is left exactly as it was.
 * A small floating "Unfold" chip is added so the page can be restored
 * without reopening the popup. Nothing is destructive; no network.
 */
(() => {
  if (window.__origamiInstalled) return;
  window.__origamiInstalled = true;

  const state = { folded: false, els: [], chip: null };

  // Visible, foldable top-level elements (skip our own chip + non-rendered).
  function collect() {
    const out = [];
    for (const el of document.body.children) {
      if (el === state.chip) continue;
      const tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'NOSCRIPT') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      out.push(el);
    }
    return out;
  }

  function makeChip() {
    const chip = document.createElement('button');
    chip.textContent = 'Unfold page';
    chip.setAttribute('type', 'button');
    chip.style.cssText = [
      'position:fixed', 'bottom:20px', 'right:20px', 'z-index:2147483647',
      'padding:10px 16px', 'border-radius:999px', 'border:1px solid rgba(255,255,255,.15)',
      'background:rgba(16,185,129,.95)', 'color:#06231a',
      'font:700 13px/1 -apple-system,"Segoe UI",Roboto,sans-serif',
      'cursor:pointer', 'box-shadow:0 8px 24px rgba(0,0,0,.45)',
    ].join(';');
    chip.addEventListener('click', () => window.__origamiUnfold());
    return chip;
  }

  window.__origamiFold = function () {
    if (state.folded) return;
    if (!document.body) return;
    const els = collect();
    if (!els.length) return;

    // Give the body 3D perspective; remember prior inline values.
    const body = document.body;
    state.prevBodyPerspective = body.style.perspective;
    state.prevBodyTransformStyle = body.style.transformStyle;
    body.style.perspective = '1400px';
    body.style.transformStyle = 'preserve-3d';

    // Prep elements (styles applied, transform not yet — double rAF
    // guarantees the transition starts from the unfolded state).
    els.forEach((el) => {
      el.style.transition = 'transform .65s cubic-bezier(.45,0,.25,1)';
      el.style.transformOrigin = 'top center';
      el.style.willChange = 'transform';
      el.style.backfaceVisibility = 'hidden';
    });

    requestAnimationFrame(() => requestAnimationFrame(() => {
      els.forEach((el, i) => {
        el.style.transitionDelay = Math.min(i * 70, 1400) + 'ms';
        el.style.transform = 'rotateX(-84deg)';
      });
    }));

    state.chip = makeChip();
    body.appendChild(state.chip);
    state.folded = true;
    state.els = els;
    return els.length;
  };

  window.__origamiUnfold = function () {
    if (!state.folded) return;
    const body = document.body;
    state.els.forEach((el) => {
      el.style.transitionDelay = '0ms';
      el.style.transform = '';
    });
    // Clean up inline styles after the reverse animation finishes.
    const els = state.els.slice();
    setTimeout(() => {
      els.forEach((el) => {
        el.style.transition = '';
        el.style.transformOrigin = '';
        el.style.willChange = '';
        el.style.backfaceVisibility = '';
        el.style.transitionDelay = '';
      });
      body.style.perspective = state.prevBodyPerspective || '';
      body.style.transformStyle = state.prevBodyTransformStyle || '';
    }, 800);
    if (state.chip && state.chip.parentNode) state.chip.parentNode.removeChild(state.chip);
    state.chip = null;
    state.els = [];
    state.folded = false;
  };
})();
