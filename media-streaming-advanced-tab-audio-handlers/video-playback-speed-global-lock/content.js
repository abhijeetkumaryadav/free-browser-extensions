/* ============================================================================
 * Speed Lock — content script (isolated world)
 * Enforces the user's chosen playback rate on every <video>/<audio>:
 *  - applies on document start and to late-added media via MutationObserver
 *  - re-applies when a site tries to change the rate while the lock is on
 *  - per-site overrides win over the global rate; fully reversible
 * Never touches the DOM structure; only sets media.playbackRate.
 * ========================================================================== */
'use strict';

// ---- settings --------------------------------------------------------------
const DEFAULTS = {
  vpslEnabled: true,      // master switch
  vpslRate: 1,            // global rate (0.25 – 4)
  vpslOverrides: {}       // { hostname: rate } — per-site override
};

let settings = { ...DEFAULTS };
// True while WE are the ones setting playbackRate (avoids fighting ourselves).
let selfApplying = false;

// Resolve the effective rate for this page.
function effectiveRate() {
  if (!settings.vpslEnabled) return null; // lock off -> do not touch anything
  try {
    const host = location.hostname;
    const o = settings.vpslOverrides || {};
    if (host && Object.prototype.hasOwnProperty.call(o, host)) return o[host];
  } catch (e) { /* location may be restricted; fall through to global */ }
  return settings.vpslRate;
}

// Apply the effective rate to one media element.
function applyTo(media) {
  const rate = effectiveRate();
  if (rate == null) return;
  if (typeof media.playbackRate !== 'number') return;
  if (Math.abs(media.playbackRate - rate) < 0.001) return;
  selfApplying = true;
  try {
    media.playbackRate = rate;
    // Keep defaultPlaybackRate in sync so newly loaded sources inherit it.
    if (typeof media.defaultPlaybackRate === 'number') {
      media.defaultPlaybackRate = rate;
    }
  } catch (e) { /* read-only media on some pages */ }
  // Release the guard on the next microtask so our own 'ratechange'
  // handler (below) does not re-apply redundantly.
  Promise.resolve().then(() => { selfApplying = false; });
}

function applyToAll(root) {
  const scope = root || document;
  const media = scope.querySelectorAll
    ? scope.querySelectorAll('video, audio')
    : [];
  media.forEach(applyTo);
}

// If a site changes the rate while the lock is on, put it back.
// (This is the "lock" behavior; turning the master switch off restores
// normal site/player control immediately.)
document.addEventListener('ratechange', (event) => {
  if (selfApplying) return;
  const el = event.target;
  if (el && (el.tagName === 'VIDEO' || el.tagName === 'AUDIO')) {
    applyTo(el);
  }
}, true);

// Watch for media elements added later (SPA navigation, lazy players, ads).
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
        applyTo(node);
      } else if (node.querySelectorAll) {
        node.querySelectorAll('video, audio').forEach(applyTo);
      }
    }
  }
});

function start() {
  applyToAll(document);
  observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true
  });
}

// ---- settings plumbing ------------------------------------------------------
async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get(DEFAULTS);
    settings = { ...DEFAULTS, ...stored };
  } catch (e) { settings = { ...DEFAULTS }; }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  let touched = false;
  for (const key of Object.keys(DEFAULTS)) {
    if (changes[key]) { settings[key] = changes[key].newValue; touched = true; }
  }
  if (touched) applyToAll(document);
});

// ---- boot -------------------------------------------------------------------
loadSettings().then(() => {
  if (document.documentElement) {
    start();
  } else {
    // document_start can fire before <html> exists; wait for it.
    new MutationObserver((_, obs) => {
      if (document.documentElement) { obs.disconnect(); start(); }
    }).observe(document, { childList: true, subtree: true });
  }
});
