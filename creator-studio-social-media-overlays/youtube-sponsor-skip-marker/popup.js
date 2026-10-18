/* Sponsor Segment Finder — popup logic.
 * Reads the current YouTube video ID, queries the public read-only
 * SponsorBlock API for community-submitted segments, renders them, and
 * seeks the video on click. Marker-bar rendering is delegated to content.js. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var statusRow = $('statusRow'), segmentList = $('segmentList');
  var emptyMsg = $('emptyMsg'), barToggle = $('barToggle');
  var catFilters = $('catFilters');

  // Human-friendly labels + colors for SponsorBlock categories.
  var CATEGORIES = [
    { id: 'sponsor',        label: 'Sponsor',          color: '#ef4444' },
    { id: 'selfpromo',      label: 'Self promo',       color: '#f59e0b' },
    { id: 'interaction',    label: 'Interaction',      color: '#22c55e' },
    { id: 'intro',          label: 'Intro',            color: '#8b5cf6' },
    { id: 'outro',          label: 'Outro',            color: '#6366f1' },
    { id: 'preview',        label: 'Preview',          color: '#06b6d4' },
    { id: 'music_offtopic', label: 'Off-topic music',  color: '#ec4899' }
  ];

  var videoId = null;
  var allSegments = [];   // raw API results
  var settings = { showBar: true, categories: CATEGORIES.map(function (c) { return c.id; }) };

  // ---- Boot ----
  init();

  function init() {
    chrome.storage.local.get('sponsorSkipSettings', function (res) {
      if (res && res.sponsorSkipSettings) {
        settings = Object.assign(settings, res.sponsorSkipSettings);
      }
      barToggle.checked = settings.showBar;
      renderCategoryFilters();
      findVideo();
    });
  }

  // ---- Locate the active tab's YouTube video ID ----
  function findVideo() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab || !tab.url) { setStatus('Open a YouTube video to see its segments.'); return; }
      var m = tab.url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
      if (!m) { setStatus('This does not look like a YouTube watch page.'); return; }
      videoId = m[1];
      fetchSegments();
    });
  }

  function setStatus(html) { statusRow.innerHTML = html; }

  // ---- Query the public read-only SponsorBlock API ----
  function fetchSegments() {
    setStatus('Looking up community segments…');
    var url = 'https://sponsor.ajay.app/api/skipSegments?videoID=' +
      encodeURIComponent(videoId) +
      '&categories=' + encodeURIComponent(JSON.stringify(settings.categories));
    fetch(url)
      .then(function (r) {
        if (r.status === 404) return [];      // no submissions for this video
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        allSegments = Array.isArray(data) ? data : [];
        renderSegments();
        pushBarToPage();
      })
      .catch(function (e) {
        setStatus('<span class="warn">Lookup failed:</span> ' + escapeHtml(e.message));
      });
  }

  // ---- Render ----
  function renderSegments() {
    segmentList.innerHTML = '';
    var n = allSegments.length;
    if (!n) {
      setStatus('Video ID <strong>' + escapeHtml(videoId) + '</strong> — no segments reported.');
      emptyMsg.classList.remove('hidden');
      return;
    }
    emptyMsg.classList.add('hidden');
    var total = allSegments.reduce(function (acc, s) {
      return acc + Math.max(0, s.segment[1] - s.segment[0]);
    }, 0);
    setStatus('<span class="ok">' + n + ' segment' + (n > 1 ? 's' : '') + '</span> found · ' +
              fmtTime(total) + ' skippable — click a row to jump.');

    allSegments.slice().sort(function (a, b) { return a.segment[0] - b.segment[0]; })
      .forEach(function (s) {
        var cat = CATEGORIES.find(function (c) { return c.id === s.category; }) ||
                  { label: s.category, color: '#9ca3af' };
        var row = document.createElement('div');
        row.className = 'seg';
        row.innerHTML =
          '<span class="seg-dot" style="background:' + cat.color + '"></span>' +
          '<div class="seg-info"><div class="seg-cat">' + escapeHtml(cat.label) + '</div>' +
          '<div class="seg-time">' + fmtTime(s.segment[0]) + ' → ' + fmtTime(s.segment[1]) + '</div></div>' +
          '<span class="seg-go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
          'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<polygon points="6,4 20,12 6,20"/></svg></span>';
        row.addEventListener('click', function () { seekTo(s.segment[0]); });
        segmentList.appendChild(row);
      });
  }

  // ---- Seek the video to a timestamp ----
  function seekTo(seconds) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab) return;
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function (t) {
          var v = document.querySelector('video.html5-main-video');
          if (v) { v.currentTime = t; v.play(); }
        },
        args: [seconds]
      }, function () {});
    });
  }

  // ---- Marker bar on the page ----
  function pushBarToPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab) return;
      var type = settings.showBar ? 'SHOW_SEGMENTS' : 'CLEAR_SEGMENTS';
      chrome.tabs.sendMessage(tab.id, { type: type, segments: allSegments }, function () {
        /* content script may not be injected on all YouTube layouts — ignore */
      });
    });
  }

  // ---- Settings UI ----
  barToggle.addEventListener('change', function () {
    settings.showBar = barToggle.checked;
    saveSettings();
    pushBarToPage();
  });

  function renderCategoryFilters() {
    catFilters.innerHTML = '';
    CATEGORIES.forEach(function (c) {
      var chip = document.createElement('button');
      chip.className = 'cat-chip' + (settings.categories.indexOf(c.id) !== -1 ? ' active' : '');
      chip.textContent = c.label;
      chip.addEventListener('click', function () {
        var i = settings.categories.indexOf(c.id);
        if (i === -1) settings.categories.push(c.id);
        else settings.categories.splice(i, 1);
        chip.classList.toggle('active');
        saveSettings();
        fetchSegments();   // re-query with the new category set
      });
      catFilters.appendChild(chip);
    });
  }

  function saveSettings() {
    chrome.storage.local.set({ sponsorSkipSettings: settings }, function () {});
  }

  // ---- Utils ----
  function fmtTime(s) {
    s = Math.max(0, Math.floor(s));
    var m = Math.floor(s / 60), sec = s % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
