/* quality-probe.js — injected into the MAIN world on user click only.
 * Reports what each <video> on the page is actually delivering.
 * Pure function: takes no input, returns an array. Self-contained. */
(() => {
  'use strict';

  const videos = Array.from(document.querySelectorAll('video'));
  return videos.slice(0, 8).map((v) => {
    const w = v.videoWidth || 0;
    const h = v.videoHeight || 0;
    let dropped = null, total = null;
    try {
      if (typeof v.getVideoPlaybackQuality === 'function') {
        const q = v.getVideoPlaybackQuality();
        dropped = q.droppedVideoFrames;
        total = q.totalVideoFrames;
      }
    } catch (e) { /* read-only probe; ignore */ }
    return {
      width: w,
      height: h,
      label: h >= 2160 ? '2160p' : h >= 1440 ? '1440p' : h >= 1080 ? '1080p' :
             h >= 720 ? '720p' : h >= 480 ? '480p' : h >= 360 ? '360p' :
             h > 0 ? h + 'p' : 'unknown',
      droppedFrames: dropped,
      totalFrames: total,
      paused: v.paused,
      src: (v.currentSrc || '').slice(0, 120)
    };
  });
})();
