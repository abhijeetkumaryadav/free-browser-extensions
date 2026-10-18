/* FrameStep — content script.
 * Injected on demand (activeTab + scripting) when the popup needs to talk
 * to the page's video element. Non-destructive: only seeks/pauses/reads. */

(() => {
  'use strict';

  // Track the most recently interacted-with video on the page.
  let currentVideo = null;

  function pickVideo() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;
    // Prefer the last video the user interacted with, else the largest visible one.
    if (currentVideo && document.contains(currentVideo)) return currentVideo;
    let best = videos[0], bestArea = 0;
    for (const v of videos) {
      const r = v.getBoundingClientRect();
      const area = Math.max(0, r.width) * Math.max(0, r.height);
      if (area > bestArea) { bestArea = area; best = v; }
    }
    currentVideo = best;
    return best;
  }

  document.addEventListener('play', (e) => {
    if (e.target instanceof HTMLVideoElement) currentVideo = e.target;
  }, true);

  function fmtTime(sec) {
    if (!isFinite(sec)) return '--:--.---';
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    return String(m).padStart(2, '0') + ':' + s.toFixed(3).padStart(6, '0');
  }

  function snapshot(video) {
    return {
      found: true,
      time: video.currentTime,
      timeStr: fmtTime(video.currentTime),
      duration: isFinite(video.duration) ? video.duration : 0,
      paused: video.paused,
      readyState: video.readyState,
      src: (video.currentSrc || video.src || '').slice(0, 80)
    };
  }

  // Commands from the popup.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.target !== 'framestep') return;
    const video = pickVideo();
    if (!video) { sendResponse({ found: false }); return true; }

    switch (msg.cmd) {
      case 'status':
        sendResponse(snapshot(video));
        break;
      case 'pause':
        video.pause();
        sendResponse(snapshot(video));
        break;
      case 'play':
        video.play().catch(() => {});
        sendResponse(snapshot(video));
        break;
      case 'toggle':
        if (video.paused) video.play().catch(() => {}); else video.pause();
        sendResponse(snapshot(video));
        break;
      case 'step': {
        // Pause, then seek by exactly one frame at the given fps.
        video.pause();
        const step = 1 / (msg.fps || 30);
        const dir = msg.dir === -1 ? -1 : 1;
        let t = video.currentTime + dir * step;
        if (isFinite(video.duration)) t = Math.min(Math.max(t, 0), video.duration);
        // requestVideoFrameCallback gives the most accurate single-frame seek.
        const apply = () => {
          video.currentTime = t;
          // Respond after the seek lands so the readout is exact.
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            sendResponse(snapshot(video));
          };
          video.addEventListener('seeked', onSeeked);
          // Fallback in case 'seeked' never fires (e.g. same time).
          setTimeout(() => {
            video.removeEventListener('seeked', onSeeked);
            sendResponse(snapshot(video));
          }, 350);
        };
        apply();
        return true; // async response
      }
      case 'capture': {
        // Draw the current frame to canvas and export a PNG data URL.
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 1280;
          canvas.height = video.videoHeight || 720;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          sendResponse({ ok: true, dataUrl, timeStr: fmtTime(video.currentTime) });
        } catch (err) {
          sendResponse({ ok: false, error: String(err && err.message || err) });
        }
        break;
      }
      default:
        sendResponse({ found: true });
    }
    return true;
  });

  // Page-level keyboard shortcuts: , . and space handled by the site/player
  // already; we add frame-step on , / . only when a video is focused/hovered
  // and the user isn't typing. This is a convenience, popup buttons always work.
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
    if (e.key !== ',' && e.key !== '.') return;
    const video = pickVideo();
    if (!video) return;
    const r = video.getBoundingClientRect();
    const over = r.width > 0 && r.height > 0; // video present on page
    if (!over) return;
    e.preventDefault();
    video.pause();
    chrome.storage.local.get({ fps: 30 }, ({ fps }) => {
      const step = 1 / fps;
      video.currentTime = Math.max(0, video.currentTime + (e.key === ',' ? -step : step));
    });
  });
})();
