/* BlurBuddy — content script.
   User-controlled image blurring. Injected on demand via chrome.scripting.
   Re-injection safe: setup runs once per page (guard flag below).
   Honest scope: blurs ONLY what the user chooses — no image-content detection. */

(() => {
  'use strict';

  if (window.__blurBuddyInjected) return;
  window.__blurBuddyInjected = true;

  const state = { clickMode: false, intensity: 12 };
  const blurred = new Set(); // <img> elements currently blurred

  /** Apply blur styling to an image element. */
  function blurImage(img) {
    if (!(img instanceof HTMLImageElement) || blurred.has(img)) return;
    img.dataset.blurBuddyOrigFilter = img.style.filter || '';
    img.dataset.blurBuddyOrigCursor = img.style.cursor || '';
    img.style.filter = `${img.dataset.blurBuddyOrigFilter} blur(${state.intensity}px) brightness(0.85)`.trim();
    img.style.cursor = 'pointer';
    img.title = 'BlurBuddy: click to reveal';
    blurred.add(img);
  }

  /** Restore an image element. */
  function unblurImage(img) {
    if (!blurred.has(img)) return;
    img.style.filter = img.dataset.blurBuddyOrigFilter || '';
    img.style.cursor = img.dataset.blurBuddyOrigCursor || '';
    img.removeAttribute('title');
    delete img.dataset.blurBuddyOrigFilter;
    delete img.dataset.blurBuddyOrigCursor;
    blurred.delete(img);
  }

  /** Refresh styling of all blurred images (e.g. after intensity change). */
  function refreshBlurred() {
    blurred.forEach((img) => {
      const orig = img.dataset.blurBuddyOrigFilter || '';
      img.style.filter = `${orig} blur(${state.intensity}px) brightness(0.85)`.trim();
    });
  }

  /** Click-to-blur: when enabled, clicking an image blurs it instead of following links. */
  document.addEventListener('click', (event) => {
    const img = event.target instanceof Element ? event.target.closest('img') : null;
    if (img && state.clickMode) {
      event.preventDefault();
      event.stopPropagation();
      blurImage(img);
      return;
    }
    // Clicking an already-blurred image reveals it (works even with click-mode off).
    if (img && blurred.has(img)) {
      event.preventDefault();
      event.stopPropagation();
      unblurImage(img);
    }
  }, true);

  /** Message API for the popup. */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'blurBuddy') return false;

    if (msg.action === 'setState') {
      state.clickMode = Boolean(msg.clickMode);
      const n = Number(msg.intensity);
      if (Number.isFinite(n) && n >= 0) state.intensity = n;
      refreshBlurred();
      sendResponse({ ok: true, blurredCount: blurred.size });
    } else if (msg.action === 'blurAll') {
      let count = 0;
      document.querySelectorAll('img').forEach((img) => {
        // Skip tiny/hidden images (likely icons, spacers, tracking pixels).
        const rect = img.getBoundingClientRect();
        if (rect.width < 24 || rect.height < 24) return;
        const style = getComputedStyle(img);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        blurImage(img);
        count += 1;
      });
      sendResponse({ ok: true, count });
    } else if (msg.action === 'unblurAll') {
      [...blurred].forEach(unblurImage);
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false, error: 'unknown action' });
    }
    return true; // keep channel open (responses are synchronous, but be safe)
  });
})();
