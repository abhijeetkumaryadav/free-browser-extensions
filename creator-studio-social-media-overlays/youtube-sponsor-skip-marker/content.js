/* Sponsor Segment Finder — content script.
 * Runs on YouTube watch pages: extracts the current video ID, listens for
 * segment data from the popup, and draws a subtle marker bar over the player.
 * Read-only: never modifies playback, only adds/removes its own overlay. */
(function () {
  'use strict';

  var BAR_ID = 'sponsor-skip-marker-bar';
  var lastVideoId = currentVideoId();

  // ---- Extract the video ID from the URL ----
  function currentVideoId() {
    try {
      return new URL(location.href).searchParams.get('v');
    } catch (e) { return null; }
  }

  // ---- Find the player element to anchor the bar ----
  function playerEl() {
    return document.getElementById('movie_player') ||
           document.querySelector('.html5-video-player');
  }

  // ---- Remove any existing marker bar ----
  function clearBar() {
    var old = document.getElementById(BAR_ID);
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  // ---- Draw the marker bar given segments + duration ----
  function drawBar(segments, duration) {
    clearBar();
    if (!segments || !segments.length || !duration) return;
    var player = playerEl();
    if (!player) return;

    var bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.style.cssText = [
      'position:absolute', 'left:12px', 'right:12px', 'bottom:52px',
      'height:5px', 'z-index:60', 'pointer-events:none',
      'background:rgba(255,255,255,0.12)', 'border-radius:3px', 'overflow:hidden'
    ].join(';');

    segments.forEach(function (s) {
      var start = s.segment[0], end = s.segment[1];
      if (end <= 0 || start >= duration) return;
      var seg = document.createElement('div');
      var left = Math.max(0, (start / duration) * 100);
      var width = Math.min(100 - left, ((end - start) / duration) * 100);
      seg.style.cssText = [
        'position:absolute', 'top:0', 'bottom:0',
        'left:' + left + '%', 'width:' + width + '%',
        'background:' + categoryColor(s.category),
        'opacity:0.85', 'border-radius:2px'
      ].join(';');
      seg.title = s.category + ' ' + fmtTime(start) + '–' + fmtTime(end);
      bar.appendChild(seg);
    });

    // Anchor relative to the player.
    var cs = getComputedStyle(player);
    if (cs.position === 'static') player.style.position = 'relative';
    player.appendChild(bar);
  }

  function categoryColor(cat) {
    switch (cat) {
      case 'sponsor': return '#ef4444';
      case 'selfpromo': return '#f59e0b';
      case 'interaction': return '#22c55e';
      case 'intro': return '#8b5cf6';
      case 'outro': return '#6366f1';
      case 'preview': return '#06b6d4';
      case 'music_offtopic': return '#ec4899';
      default: return '#9ca3af';
    }
  }

  function fmtTime(s) {
    s = Math.floor(s);
    var m = Math.floor(s / 60), sec = s % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  // ---- Messages from the popup ----
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.type === 'GET_VIDEO_ID') {
      sendResponse({ videoId: currentVideoId() });
      return true;
    }
    if (msg.type === 'SHOW_SEGMENTS') {
      var video = document.querySelector('video.html5-main-video');
      drawBar(msg.segments, video && video.duration ? video.duration : 0);
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === 'CLEAR_SEGMENTS') {
      clearBar();
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });

  // ---- YouTube is an SPA: watch for video-ID changes ----
  var lastUrl = location.href;
  new MutationObserver(function () {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      var vid = currentVideoId();
      if (vid !== lastVideoId) {
        lastVideoId = vid;
        clearBar();
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
