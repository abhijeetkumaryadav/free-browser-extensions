/* CropZoom content helper (runs in the page's isolated world).
 * CSS-only crop/zoom: wraps the largest visible <video> in an overflow-hidden
 * container and scales it. Fully reversible — reset unwraps the video and
 * restores its original inline styles. Guarded against double-injection. */
(function () {
  'use strict';
  if (window.__VACZ) return; // already injected

  var WRAP_CLASS = 'vacz-wrap';
  var state = { video: null, wrap: null, orig: null };

  /* Pick the largest visible video on the page. */
  function pickVideo() {
    var vids = Array.prototype.slice.call(document.querySelectorAll('video'));
    var best = null, bestArea = 0;
    vids.forEach(function (v) {
      var r = v.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) return;
      var area = r.width * r.height;
      if (area > bestArea) { bestArea = area; best = v; }
    });
    return best;
  }

  /* Wrap the video in an overflow-hidden box matching its layout size. */
  function wrapVideo(video) {
    if (state.wrap && state.video === video) return state.wrap;
    reset(); // unwrap any previous video first
    var wrap = document.createElement('div');
    wrap.className = WRAP_CLASS;
    var r = video.getBoundingClientRect();
    wrap.style.cssText =
      'display:inline-block;position:relative;overflow:hidden;' +
      'width:' + r.width + 'px;height:' + r.height + 'px;' +
      'max-width:100%;line-height:0;';
    state.orig = {
      transform: video.style.transform,
      transformOrigin: video.style.transformOrigin,
      width: video.style.width,
      height: video.style.height
    };
    video.parentNode.insertBefore(wrap, video);
    wrap.appendChild(video);
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.transformOrigin = 'center center';
    state.video = video;
    state.wrap = wrap;
    return wrap;
  }

  /* Uniform scale needed to crop native aspect A into target aspect T. */
  function cropScale(A, T) {
    if (!A || !T) return 1;
    return Math.max(A / T, T / A);
  }

  /**
   * Apply settings: { mode, zoom (100-300), panX (-50..50), panY (-50..50) }
   * mode: 'fit' | '16:9' | '4:3' | '1:1'
   * Returns { ok, message } for the popup status line.
   */
  function apply(settings) {
    var video = pickVideo();
    if (!video) return { ok: false, message: 'No video found on this page.' };
    var targets = { '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1 };
    var base = 1;
    if (settings.mode !== 'fit' && targets[settings.mode]) {
      var A = (video.videoWidth && video.videoHeight)
        ? video.videoWidth / video.videoHeight : 16 / 9;
      base = cropScale(A, targets[settings.mode]);
    }
    wrapVideo(video);
    var s = base * (settings.zoom / 100);
    video.style.transform =
      'translate(' + settings.panX + '%,' + settings.panY + '%) scale(' + s + ')';
    return { ok: true, message: 'Applied — ' + settings.mode + ' @ ' + settings.zoom + '%.' };
  }

  /* Restore the video exactly and remove the wrapper. */
  function reset() {
    if (state.video && state.wrap && state.wrap.parentNode) {
      var v = state.video, o = state.orig || {};
      state.wrap.parentNode.insertBefore(v, state.wrap);
      state.wrap.remove();
      v.style.transform = o.transform || '';
      v.style.transformOrigin = o.transformOrigin || '';
      v.style.width = o.width || '';
      v.style.height = o.height || '';
    }
    state = { video: null, wrap: null, orig: null };
    return { ok: true, message: 'Video restored.' };
  }

  window.__VACZ = { apply: apply, reset: reset };
})();
