/* FocusSync content script
 * Cooperatively pauses media on this page while Focus mode is on, and resumes
 * only the media *it* paused when Focus mode is turned off. Fully reversible:
 * it never touches media the user paused themselves.
 *
 * Communication happens through chrome.storage.local (a single shared flag),
 * so every tab stays in sync without any background page or extra permissions.
 */
'use strict';

const STATE_KEY = 'focussync_state';      // chrome.storage.local -> { enabled: bool }
const MAP_PREFIX = 'focussync_tab_';      // chrome.storage.session entries per page load

// Unique id for this page load; used as the session-map key.
const pageId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

// Media elements paused by FocusSync itself. Only these are resumed later.
const selfPaused = new Set();

let focusEnabled = false;
let observer = null;

/* ---- session reporting -------------------------------------------------- */
/* Lets the popup show "N tabs affected / M elements paused" without needing
 * the `tabs` permission. Entries expire quickly so closed tabs don't linger. */
function report(pausedCount) {
  try {
    chrome.storage.session.set({
      [MAP_PREFIX + pageId]: {
        host: location.hostname,
        paused: pausedCount,
        ts: Date.now()
      }
    });
  } catch (e) { /* storage unavailable; non-fatal */ }
}

function unreport() {
  try { chrome.storage.session.remove(MAP_PREFIX + pageId); } catch (e) { /* noop */ }
}

/* ---- pause / resume ------------------------------------------------------ */
function isMedia(el) {
  return el instanceof HTMLMediaElement;
}

function pauseMedia(el) {
  if (!isMedia(el) || el.paused) return;
  try {
    el.pause();
    selfPaused.add(el);
  } catch (e) { /* some players reject pause; ignore */ }
}

function pauseAllPlaying() {
  document.querySelectorAll('video, audio').forEach(pauseMedia);
  report(selfPaused.size);
}

/* Resume only what FocusSync paused. Elements removed from the DOM are skipped. */
function resumeSelfPaused() {
  selfPaused.forEach(el => {
    try {
      if (el.isConnected && el.paused) {
        const p = el.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch (e) { /* ignore */ }
  });
  selfPaused.clear();
  report(0);
}

/* Catch media that starts playing while focus is on (autoplay, SPA navigation). */
function onPlayCapture(event) {
  if (!focusEnabled) return;
  const el = event.target;
  if (isMedia(el) && !selfPaused.has(el)) {
    // Defer a tick so the player finishes its play() bookkeeping first.
    setTimeout(() => {
      if (focusEnabled && !el.paused) pauseMedia(el);
      report(selfPaused.size);
    }, 0);
  }
}

function startWatching() {
  if (observer) return;
  document.addEventListener('play', onPlayCapture, true);
  observer = new MutationObserver(mutations => {
    if (!focusEnabled) return;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (isMedia(node)) pauseMedia(node);
        else if (node.querySelectorAll) node.querySelectorAll('video, audio').forEach(pauseMedia);
      }
    }
    report(selfPaused.size);
  });
  observer.observe(document.documentElement || document, { childList: true, subtree: true });
}

function stopWatching() {
  document.removeEventListener('play', onPlayCapture, true);
  if (observer) { observer.disconnect(); observer = null; }
}

function applyState(enabled) {
  focusEnabled = enabled;
  if (enabled) {
    startWatching();
    pauseAllPlaying();
  } else {
    stopWatching();
    resumeSelfPaused();
  }
}

/* ---- boot ---------------------------------------------------------------- */
chrome.storage.local.get(STATE_KEY).then(res => {
  applyState(Boolean(res[STATE_KEY] && res[STATE_KEY].enabled));
}).catch(() => applyState(false));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STATE_KEY]) {
    applyState(Boolean(changes[STATE_KEY].newValue && changes[STATE_KEY].newValue.enabled));
  }
});

window.addEventListener('beforeunload', unreport);
window.addEventListener('pagehide', unreport);
