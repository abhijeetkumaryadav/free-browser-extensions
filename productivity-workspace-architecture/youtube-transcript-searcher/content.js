/* YouTube Transcript Searcher — content script (isolated world).
 * Handles transcript fetching + video seeking. Track discovery happens via a
 * tiny MAIN-world probe (popup injects it) because ytInitialPlayerResponse
 * lives on the page's window, which isolated worlds can't see.
 * All fetches go to YouTube's own public caption endpoints for the video
 * being watched; nothing is sent anywhere else. */

(() => {
  'use strict';

  // In-memory cache: baseUrl -> cue array. Keeps re-selecting a track instant.
  const cueCache = new Map();

  /** Convert json3 caption payload into clean {start, dur, text} cues. */
  function parseJson3(data) {
    const cues = [];
    const events = Array.isArray(data.events) ? data.events : [];
    for (const ev of events) {
      if (typeof ev.tStartMs !== 'number') continue;
      const segs = Array.isArray(ev.segs) ? ev.segs : [];
      const text = segs
        .map((s) => (s && typeof s.utf8 === 'string' ? s.utf8 : ''))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) continue; // skip empty / formatting-only events
      cues.push({
        start: ev.tStartMs / 1000,
        dur: (ev.dDurationMs || 0) / 1000,
        text,
      });
    }
    return cues;
  }

  /** Fetch a caption track (same-origin with youtube.com — public timedtext). */
  async function loadTrack(baseUrl) {
    if (cueCache.has(baseUrl)) return cueCache.get(baseUrl);
    // fmt=json3 returns a JSON transcript instead of XML.
    const url = baseUrl.includes('fmt=')
      ? baseUrl
      : baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'fmt=json3';
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error('Caption download failed (HTTP ' + res.status + ').');
    const data = await res.json();
    const cues = parseJson3(data);
    cueCache.set(baseUrl, cues);
    return cues;
  }

  /** Seek the page's main video element to the given second offset. */
  function seekVideo(seconds) {
    const video = document.querySelector('video');
    if (!video) throw new Error('No video element found on the page.');
    video.currentTime = Math.max(0, seconds);
    video.focus({ preventScroll: true });
    return true;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      if (msg.type === 'load') {
        const cues = await loadTrack(msg.baseUrl);
        sendResponse({ ok: true, cues });
      } else if (msg.type === 'seek') {
        seekVideo(msg.seconds);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: 'Unknown message type.' });
      }
    })().catch((err) => {
      sendResponse({ ok: false, error: err && err.message ? err.message : String(err) });
    });
    return true; // async response
  });
})();
