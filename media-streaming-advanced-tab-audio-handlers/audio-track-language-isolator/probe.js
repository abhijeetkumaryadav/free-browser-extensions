/* ============================================================================
 * Audio Track Isolator — content-side probe & switcher
 * Runs in the page's MAIN world so video.audioTracks (a page-world API)
 * is directly accessible. Never modifies the DOM.
 * ========================================================================== */

(() => {
  'use strict';

  // Serialize the audio tracks exposed by every <video> on the page.
  function scanVideos() {
    const videos = Array.from(document.querySelectorAll('video'));
    return videos.map((video, index) => {
      const list = video.audioTracks || null;
      const tracks = [];
      if (list) {
        for (let i = 0; i < list.length; i++) {
          const t = list[i];
          tracks.push({
            index: i,
            id: t.id || '',
            // Language may be '' when the page does not label the track.
            language: t.language || '',
            kind: t.kind || '',
            label: t.label || '',
            enabled: !!t.enabled
          });
        }
      }
      return {
        index,
        // A short human-readable handle for the video (src or page position).
        handle: describeVideo(video, index),
        trackCount: tracks.length,
        tracks
      };
    });
  }

  function describeVideo(video, index) {
    const src = (video.currentSrc || video.src || '').split('?')[0];
    if (src) {
      const file = src.split('/').pop();
      return file.length > 42 ? file.slice(0, 42) + '…' : file;
    }
    return 'Video ' + (index + 1);
  }

  // Enable exactly one track (by its position in the AudioTrackList) and
  // disable every other track on the same video.
  function isolateTrack(videoIndex, trackIndex) {
    const video = document.querySelectorAll('video')[videoIndex];
    if (!video || !video.audioTracks) return { ok: false, reason: 'no-tracks' };
    const list = video.audioTracks;
    if (trackIndex < 0 || trackIndex >= list.length) {
      return { ok: false, reason: 'bad-index' };
    }
    for (let i = 0; i < list.length; i++) {
      list[i].enabled = (i === trackIndex);
    }
    return { ok: true, enabled: trackIndex, total: list.length };
  }

  // ---- message entry point (MAIN world) ----------------------------------
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.__ati !== true) return;
    if (msg.cmd === 'scan') {
      window.postMessage({ __ati: true, cmd: 'scan-result', payload: scanVideos() }, '*');
    } else if (msg.cmd === 'isolate') {
      const result = isolateTrack(msg.videoIndex, msg.trackIndex);
      window.postMessage({ __ati: true, cmd: 'isolate-result', payload: result }, '*');
    }
  });
})();
