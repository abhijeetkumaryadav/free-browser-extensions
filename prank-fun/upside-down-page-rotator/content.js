/* FlipPage content script — upside-down page prank.
 *
 * Self-executing and toggling: if the page is already flipped it is
 * restored; otherwise it is rotated 180 degrees with a smooth CSS
 * transition. Only inline styles on <html> are touched, and they are
 * fully removed on restore. Nothing persists across reloads.
 */
(() => {
  'use strict';

  const STYLE_ID = '__flippage-style';
  const SHAKE_CLASS = '__flippage-shake';
  const root = document.documentElement;

  // Toggle off: remove every trace and exit.
  if (window.__flipPageActive) {
    try {
      root.style.transform = '';
      root.style.transition = '';
      root.style.transformOrigin = '';
      root.classList.remove(SHAKE_CLASS);
      document.getElementById(STYLE_ID)?.remove();
    } catch (e) { /* never break the host page */ }
    window.__flipPageActive = false;
    return;
  }
  window.__flipPageActive = true;

  chrome.storage.local.get({ shake: false }, (opts) => {
    try {
      root.style.transition = 'transform 0.6s ease';
      root.style.transformOrigin = 'center center';
      // Force a reflow so the transition animates from the unflipped state.
      void root.offsetHeight;
      root.style.transform = 'rotate(180deg)';

      // Optional gentle wobble while flipped.
      if (opts.shake) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent =
          '@keyframes __flippage-wobble {' +
          '0%,100% { transform: rotate(180deg); }' +
          '25% { transform: rotate(182.5deg); }' +
          '75% { transform: rotate(177.5deg); }' +
          '}' +
          'html.' + SHAKE_CLASS + ' {' +
          'animation: __flippage-wobble 1.4s ease-in-out infinite !important;' +
          '}';
        document.head.appendChild(style);
        root.classList.add(SHAKE_CLASS);
      }
    } catch (e) { /* never break the host page */ }
  });
})();
