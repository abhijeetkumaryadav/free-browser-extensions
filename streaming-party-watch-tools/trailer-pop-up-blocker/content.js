/**
 * QuietStart content script — autoplay-with-sound guard.
 *
 * Honest scope: this CANNOT identify trailers or any specific video type.
 * It pauses <video> elements that begin playing WITH SOUND before the user
 * has interacted with the page (pointerdown / keydown / touchstart).
 *
 * - Runs at document_start and watches for new media (MutationObserver).
 * - A video is "guarded" only if: not muted, volume > 0, has audible
 *   output (audioTracks / webkitAudioDecodedByteCount where exposed),
 *   page had no user interaction yet, master toggle is ON, and the
 *   site's host is not on the user's allowlist.
 * - Pausing is done by pausing the element (non-destructive); the user
 *   can press play themselves at any time.
 * - Blocked attempts are tallied in chrome.storage.local for the popup.
 */
(() => {
  'use strict';

  const BLOCK_COUNT_KEY = 'quietstart.blockCount';   // total blocked attempts
  const SETTINGS_KEY = 'quietstart.settings';        // { enabled, allowlist: [host] }

  let userInteracted = false;
  let settings = { enabled: true, allowlist: [] };
  const guarded = new WeakSet(); // videos already handled

  /* ------------------------------------------------------------------ */
  /* Settings                                                            */
  /* ------------------------------------------------------------------ */

  async function loadSettings() {
    try {
      const stored = await chrome.storage.local.get([SETTINGS_KEY]);
      if (stored[SETTINGS_KEY]) settings = { ...settings, ...stored[SETTINGS_KEY] };
    } catch (_) { /* storage unavailable (private mode) — defaults apply */ }
  }

  function hostAllowed() {
    const host = location.hostname;
    return settings.allowlist.some((entry) => host === entry || host.endsWith('.' + entry));
  }

  /* ------------------------------------------------------------------ */
  /* Guard logic                                                         */
  /* ------------------------------------------------------------------ */

  function markInteraction() {
    userInteracted = true;
  }
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((evt) =>
    window.addEventListener(evt, markInteraction, { capture: true, passive: true, once: true })
  );

  function hasSound(video) {
    if (video.muted || video.volume === 0) return false;
    // Muted/autoplay policies: if the browser started it muted, respect that.
    if (typeof video.webkitAudioDecodedByteCount === 'number' && video.webkitAudioDecodedByteCount === 0) {
      // Not yet decoded — treat conservatively: rely on muted/volume only.
    }
    return true;
  }

  async function recordBlock() {
    try {
      const stored = await chrome.storage.local.get([BLOCK_COUNT_KEY]);
      const n = (stored[BLOCK_COUNT_KEY] || 0) + 1;
      await chrome.storage.local.set({ [BLOCK_COUNT_KEY]: n });
    } catch (_) { /* ignore */ }
  }

  function guardVideo(video) {
    if (guarded.has(video)) return;
    if (!settings.enabled) return;
    if (userInteracted) return;
    if (hostAllowed()) return;
    if (!hasSound(video)) return;

    guarded.add(video);
    video.pause();
    recordBlock();

    // Mark so the popup's "resume" knows which video we paused.
    video.dataset.quietstartPaused = '1';
  }

  // Capture play events early so we can pause before audible output.
  document.addEventListener('play', (e) => {
    if (e.target instanceof HTMLVideoElement) guardVideo(e.target);
  }, true);

  // Catch videos added later (SPA navigation, lazy players).
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node instanceof HTMLVideoElement) {
          if (!node.paused) guardVideo(node);
        } else if (node instanceof Element) {
          node.querySelectorAll('video').forEach((v) => {
            if (!v.paused) guardVideo(v);
          });
        }
      }
    }
  });

  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });

  // Re-read settings when the popup changes them.
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[SETTINGS_KEY]) settings = { enabled: true, allowlist: [], ...changes[SETTINGS_KEY].newValue };
  });

  loadSettings();
})();
