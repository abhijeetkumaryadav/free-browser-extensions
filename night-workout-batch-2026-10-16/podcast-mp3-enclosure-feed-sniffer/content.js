// podcast-mp3-enclosure-feed-sniffer — content.js
// Read-only page scanner. Runs ONLY when the user clicks "Scan this page".
// Collects: audio file links (mp3/m4a/ogg/opus/wav), <audio> elements with src,
// and podcast RSS feed links (<link rel="alternate" type="application/rss+xml">).
// Returns structured results; never downloads anything.
(function () {
  'use strict';

  var AUDIO_RE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)(\?|#|$)/i;

  function absolute(href) {
    try { return new URL(href, document.baseURI).href; }
    catch (e) { return null; }
  }

  function fileName(url) {
    try {
      var p = new URL(url).pathname;
      var n = p.substring(p.lastIndexOf('/') + 1);
      return decodeURIComponent(n || url);
    } catch (e) { return url; }
  }

  function labelFor(url) {
    var m = url.match(/\.([a-z0-9]{2,5})(\?|#|$)/i);
    return m ? m[1].toUpperCase() : 'AUDIO';
  }

  var found = [];
  var seen = Object.create(null);

  function push(type, url, hint) {
    if (!url || seen[url]) return;
    seen[url] = true;
    found.push({ type: type, url: url, name: fileName(url), format: labelFor(url), hint: hint || '' });
  }

  // 1. <audio> elements (src attribute or <source> children).
  document.querySelectorAll('audio').forEach(function (a) {
    if (a.currentSrc || a.src) push('audio-tag', absolute(a.currentSrc || a.src), 'audio element');
    a.querySelectorAll('source[src]').forEach(function (s) {
      push('audio-tag', absolute(s.getAttribute('src')), 'audio source');
    });
  });

  // 2. Anchor links pointing at audio files.
  document.querySelectorAll('a[href]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href && AUDIO_RE.test(href)) {
      var text = (a.textContent || '').trim().slice(0, 80);
      push('audio-link', absolute(href), text ? 'link text: ' + text : 'audio link');
    }
  });

  // 3. RSS / Atom feed links (podcast enclosures live here).
  document.querySelectorAll('link[rel="alternate"][type]').forEach(function (l) {
    var type = (l.getAttribute('type') || '').toLowerCase();
    if (type.indexOf('rss') !== -1 || type.indexOf('atom') !== -1) {
      push('feed', absolute(l.getAttribute('href')),
        (l.getAttribute('title') || 'RSS feed').slice(0, 80));
    }
  });

  // 4. <a> links to feeds.
  document.querySelectorAll('a[href]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href && /\.(rss|xml|atom)(\?|#|$)/i.test(href) && !AUDIO_RE.test(href)) {
      var text = (a.textContent || '').trim().slice(0, 80);
      push('feed', absolute(href), text ? 'link text: ' + text : 'feed link');
    }
  });

  return { page: document.title, items: found.slice(0, 200) };
})();
