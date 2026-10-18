/* ScareWarn watcher (runs in the page's isolated world).
 * Polls the largest visible <video> and shows a warning banner WARN_BEFORE
 * seconds before each user-supplied timestamp. Fully reversible via stop().
 * Guarded against double-injection. */
(function () {
  'use strict';
  if (window.__JSW) return;

  var WARN_BEFORE = 5;      // seconds of advance warning
  var BANNER_ID = 'jsw-banner';
  var timer = null;
  var stamps = [];          // [{ t: seconds, note: string, fired: bool }]
  var bannerHideTimer = null;

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

  function ensureBanner() {
    var el = document.getElementById(BANNER_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = BANNER_ID;
    el.style.cssText =
      'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
      'display:none;align-items:center;gap:10px;max-width:90%;' +
      'background:rgba(20,20,26,.92);border:1px solid rgba(239,68,68,.6);' +
      'border-radius:12px;padding:10px 16px;color:#fff;' +
      'font:600 13px/1.4 -apple-system,"Segoe UI",Roboto,sans-serif;' +
      'box-shadow:0 8px 30px rgba(239,68,68,.35);backdrop-filter:blur(8px);';
    el.innerHTML =
      '<span style="color:#ef4444;font-size:18px;">&#9888;</span>' +
      '<span id="jsw-text"></span>' +
      '<button id="jsw-dismiss" style="background:none;border:none;color:#8b93a3;' +
      'cursor:pointer;font-size:16px;line-height:1;padding:0 0 0 6px;">&times;</button>';
    document.documentElement.appendChild(el);
    el.querySelector('#jsw-dismiss').addEventListener('click', function () {
      el.style.display = 'none';
    });
    return el;
  }

  function showBanner(note, secsLeft) {
    var el = ensureBanner();
    var label = secsLeft > 1
      ? 'Heads up — scare in ~' + secsLeft + 's'
      : 'Scare incoming — brace!';
    el.querySelector('#jsw-text').textContent = note ? label + ' — ' + note : label;
    el.style.display = 'flex';
    clearTimeout(bannerHideTimer);
  }

  function hideBannerSoon(ms) {
    clearTimeout(bannerHideTimer);
    bannerHideTimer = setTimeout(function () {
      var el = document.getElementById(BANNER_ID);
      if (el) el.style.display = 'none';
    }, ms);
  }

  function tick() {
    var video = pickVideo();
    if (!video || video.paused) return;
    var now = video.currentTime;
    stamps.forEach(function (s) {
      // Re-arm if the user seeks back well before the stamp.
      if (s.fired && now < s.t - WARN_BEFORE - 5) s.fired = false;
      if (!s.fired && now >= s.t - WARN_BEFORE && now <= s.t + 3) {
        s.fired = true;
        showBanner(s.note, Math.max(0, Math.ceil(s.t - now)));
        hideBannerSoon(4500);
      }
    });
  }

  function start(list) {
    stop();
    stamps = (list || []).map(function (s) {
      return { t: s.t, note: s.note || '', fired: false };
    }).sort(function (a, b) { return a.t - b.t; });
    if (!stamps.length) return { ok: false, message: 'Add at least one timestamp first.' };
    timer = setInterval(tick, 250);
    return { ok: true, message: 'Watching — ' + stamps.length + ' timestamp(s) armed.' };
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    clearTimeout(bannerHideTimer);
    var el = document.getElementById(BANNER_ID);
    if (el) el.remove();
    stamps = [];
    return { ok: true, message: 'Stopped.' };
  }

  window.__JSW = { start: start, stop: stop };
})();
