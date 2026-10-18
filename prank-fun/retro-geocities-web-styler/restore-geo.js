/* Geocities Rewind — restore script (injected on user click).
 * Removes everything apply-geo.js added: the stylesheet, the gr-geo body
 * class, and all gr-geo-el elements. Non-destructive to the page itself. */
(() => {
  'use strict';
  document.querySelectorAll('.gr-geo-el, #gr-style').forEach((el) => el.remove());
  document.body.classList.remove('gr-geo');
})();
