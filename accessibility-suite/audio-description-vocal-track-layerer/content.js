/* Audio Description Layer — content script.
 * Attaches a user-authored spoken description track to a page video.
 * Cues are written by the user (mm:ss + text); speech is 100% on-device
 * via the Web Speech API. No auto-generation, no network, nothing stored
 * except what the user explicitly saves. */
(() => {
  'use strict';

  let session = null; // { video, cues:[{t,text}], spoken:Set, opts, onTime, onSeek }

  function labelFor(video, i) {
    const src = (video.currentSrc || video.src || '').split('/').pop().split('?')[0];
    const dur = isFinite(video.duration) ? fmt(video.duration) : '??:??';
    const base = src ? decodeURIComponent(src).slice(0, 42) : `video element #${i + 1}`;
    return `${base} (${dur})`;
  }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  }

  function listVideos() {
    return Array.from(document.querySelectorAll('video')).map((v, i) => ({
      index: i,
      label: labelFor(v, i),
      duration: isFinite(v.duration) ? Math.round(v.duration) : null
    }));
  }

  function speak(text, opts) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = opts.rate; u.pitch = opts.pitch; u.volume = opts.volume;
      speechSynthesis.speak(u);
    } catch { /* TTS unavailable — stay silent */ }
  }

  function stopSession() {
    if (!session) return;
    session.video.removeEventListener('timeupdate', session.onTime);
    session.video.removeEventListener('seeked', session.onSeek);
    try { speechSynthesis.cancel(); } catch {}
    session = null;
  }

  function startSession(videoIndex, cues, opts) {
    stopSession();
    const videos = document.querySelectorAll('video');
    const video = videos[videoIndex];
    if (!video) return { ok: false, error: 'video not found' };
    const sorted = cues
      .filter(c => typeof c.t === 'number' && isFinite(c.t) && c.t >= 0 && c.text && c.text.trim())
      .sort((a, b) => a.t - b.t);
    if (sorted.length === 0) return { ok: false, error: 'no valid cues' };

    const st = { video, cues: sorted, spoken: new Set(), opts };

    st.onTime = () => {
      const now = video.currentTime;
      sorted.forEach((cue, i) => {
        if (cue.t <= now && !st.spoken.has(i)) {
          st.spoken.add(i);
          // Don't talk over dialogue-heavy moments we can't detect; just speak.
          speak(cue.text, st.opts);
        }
      });
    };
    st.onSeek = () => {
      // Re-arm cues that are now in the future.
      const now = video.currentTime;
      sorted.forEach((cue, i) => {
        if (cue.t > now) st.spoken.delete(i);
      });
      try { speechSynthesis.cancel(); } catch {}
    };
    video.addEventListener('timeupdate', st.onTime);
    video.addEventListener('seeked', st.onSeek);
    session = st;
    return { ok: true, count: sorted.length };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'ping') { sendResponse({ ok: true }); return true; }
    if (msg.type === 'adesc-list') {
      sendResponse({ ok: true, videos: listVideos() });
      return true;
    }
    if (msg.type === 'adesc-start') {
      sendResponse(startSession(msg.videoIndex, msg.cues, msg.opts));
      return true;
    }
    if (msg.type === 'adesc-stop') {
      stopSession();
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === 'adesc-status') {
      sendResponse({
        ok: true,
        active: !!session,
        spoken: session ? session.spoken.size : 0,
        total: session ? session.cues.length : 0
      });
      return true;
    }
    return false;
  });
})();
