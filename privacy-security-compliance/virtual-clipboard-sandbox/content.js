/* ==========================================================================
   Virtual Clipboard Sandbox — content script
   Listens for real 'copy' events on pages the user visits and stores the
   copied text on-device. Only plain text is captured; images/rich content
   are ignored. Nothing is ever transmitted anywhere.
   ========================================================================== */

'use strict';

/** Same cap as the popup; duplicated here so the cap holds even if the
    popup is never opened. */
const MAX_CLIPS = 50;

/**
 * Persist a freshly copied string into the on-device history.
 * @param {string} text
 */
async function storeCopy(text) {
  text = (text || '').trim().slice(0, 5000);
  if (!text) return;

  const { autoCapture } = await chrome.storage.local.get('settings')
    .then(d => d.settings || { autoCapture: true })
    .catch(() => ({ autoCapture: true }));
  if (autoCapture === false) return;

  const data = await chrome.storage.local.get({ clips: [] });
  let clips = Array.isArray(data.clips) ? data.clips : [];

  // De-dupe: identical text moves to the top rather than duplicating.
  clips = clips.filter(c => c.text !== text);
  clips.unshift({
    id: 'c' + Date.now() + Math.floor(Math.random() * 1e6),
    text,
    source: location.hostname || 'unknown',
    ts: Date.now(),
    pinned: false,
  });

  // Enforce cap, always preserving pinned clips.
  const pinned = clips.filter(c => c.pinned);
  const unpinned = clips.filter(c => !c.pinned).slice(0, MAX_CLIPS);
  clips = [...pinned, ...unpinned].sort((a, b) => b.ts - a.ts);

  await chrome.storage.local.set({ clips });
}

// The 'copy' event fires for real user copies (Ctrl+C, context menu copy,
// JS-driven copies). We read the *selection* rather than intercepting the
// clipboard payload, so we never disturb the actual copy operation.
document.addEventListener('copy', () => {
  try {
    const sel = window.getSelection().toString();
    if (sel && sel.trim()) storeCopy(sel);
  } catch (err) {
    // Never break the host page.
  }
});
