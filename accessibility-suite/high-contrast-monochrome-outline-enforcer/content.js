/* MonoFocus — content-side contrast engine.
 * Injected on demand. Exposes:
 *   window.__hcApply(settings)  -> apply a preset
 *   window.__hcClear()           -> remove all treatment
 * settings = { preset: 'mono'|'night'|'focus', outline: <px number> }
 * Pure CSS injection. Nothing leaves the page.
 */
(() => {
  'use strict';

  const STYLE_ID = '__monofocus-style';
  const ON_CLASS = '__monofocus-on';

  // Interactive selectors that always get visible outlines.
  const INTERACTIVE =
    'a[href], button, input, select, textarea, [tabindex], [role="button"], ' +
    '[role="link"], [role="checkbox"], [role="radio"], [role="switch"], ' +
    '[role="tab"], [role="menuitem"], summary, video[controls], audio[controls]';

  function cssFor(settings) {
    const w = Math.max(1, Math.min(8, Number(settings.outline) || 2));
    const focusW = w + 1;
    // Double-ring trick: white ring + black halo = visible on any background.
    const ring = (px) =>
      `outline: ${px}px solid #ffffff !important; ` +
      `box-shadow: 0 0 0 ${px + 2}px #000000 !important; outline-offset: 1px !important;`;

    let css = `html.${ON_CLASS} ${INTERACTIVE} { ${ring(w)} }\n`;
    css += `html.${ON_CLASS} :focus { ${ring(focusW)} }\n`;
    css += `html.${ON_CLASS} :focus-visible { ${ring(focusW + 1)} }\n`;

    if (settings.preset === 'mono') {
      // Grayscale + contrast boost across the whole page.
      css += `html.${ON_CLASS} { filter: grayscale(1) contrast(1.35) !important; }\n`;
      css += `html.${ON_CLASS} img, html.${ON_CLASS} video { filter: contrast(1.1) !important; }\n`;
    } else if (settings.preset === 'night') {
      // Inverted monochrome: near-black page, bright content, max contrast.
      css += `html.${ON_CLASS} { filter: invert(1) hue-rotate(180deg) grayscale(1) contrast(1.5) !important; background: #000 !important; }\n`;
      // Re-invert media so photos/video don't look like negatives.
      css += `html.${ON_CLASS} img, html.${ON_CLASS} video, html.${ON_CLASS} picture, ` +
             `html.${ON_CLASS} canvas, html.${ON_CLASS} svg { filter: invert(1) hue-rotate(180deg) !important; }\n`;
    }
    // 'focus' preset: outlines only, no filter.
    return css;
  }

  function ensureStyle() {
    let st = document.getElementById(STYLE_ID);
    if (!st) {
      st = document.createElement('style');
      st.id = STYLE_ID;
      document.documentElement.appendChild(st);
    }
    return st;
  }

  window.__hcApply = function (settings) {
    const st = ensureStyle();
    st.textContent = cssFor(settings || { preset: 'mono', outline: 2 });
    document.documentElement.classList.add(ON_CLASS);
    return true;
  };

  window.__hcClear = function () {
    const st = document.getElementById(STYLE_ID);
    if (st) st.textContent = '';
    document.documentElement.classList.remove(ON_CLASS);
    return true;
  };
})();
