/* ScareWarn popup logic.
 * - Titles + timestamps live in chrome.storage.local (on-device, user-entered).
 * - watcher.js is injected on demand into the active tab (user gesture only).
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var statusEl = $('status');
  var titles = [];        // [{ id, name, stamps: [{ t, note }] }]
  var activeId = null;
  var tabId = null;
  var watching = false;

  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function uid() {
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* Parse "mm:ss" or "hh:mm:ss" -> seconds. Returns null if invalid. */
  function parseTime(str) {
    var parts = String(str).trim().split(':').map(function (p) { return p.trim(); });
    if (parts.length < 2 || parts.length > 3) return null;
    if (!parts.every(function (p) { return /^\d+$/.test(p); })) return null;
    var nums = parts.map(Number);
    if (nums.some(function (n) { return n < 0; })) return null;
    if (nums[nums.length - 1] >= 60 || (nums.length === 3 && nums[1] >= 60)) return null;
    var secs = 0;
    for (var i = 0; i < nums.length; i++) secs = secs * 60 + nums[i];
    return secs;
  }

  function fmtTime(secs) {
    var h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    var mm = (h ? m : m).toString().padStart(h ? 2 : 1, '0');
    var out = (h ? h + ':' : '') + mm + ':' + s.toString().padStart(2, '0');
    return out;
  }

  function save() {
    return chrome.storage.local.set({ jsw_titles: titles, jsw_active: activeId });
  }

  function activeTitle() {
    return titles.find(function (t) { return t.id === activeId; }) || null;
  }

  function renderTitles() {
    var sel = $('titleSelect');
    sel.innerHTML = '';
    if (!titles.length) {
      var opt = document.createElement('option');
      opt.textContent = 'No titles yet — add one below';
      sel.appendChild(opt);
      sel.disabled = true;
    } else {
      sel.disabled = false;
      titles.forEach(function (t) {
        var o = document.createElement('option');
        o.value = t.id;
        o.textContent = t.name + ' (' + t.stamps.length + ')';
        if (t.id === activeId) o.selected = true;
        sel.appendChild(o);
      });
    }
  }

  function renderStamps() {
    var list = $('stampList');
    list.innerHTML = '';
    var t = activeTitle();
    if (!t || !t.stamps.length) {
      var li = document.createElement('li');
      li.className = 'empty';
      li.textContent = t ? 'No timestamps yet.' : 'Select or add a title first.';
      list.appendChild(li);
      return;
    }
    t.stamps.slice().sort(function (a, b) { return a.t - b.t; }).forEach(function (s) {
      var li = document.createElement('li');
      var time = document.createElement('span');
      time.className = 'stamp-time';
      time.textContent = fmtTime(s.t);
      var note = document.createElement('span');
      note.className = 'stamp-note';
      note.textContent = s.note || '—';
      var del = document.createElement('button');
      del.className = 'stamp-del';
      del.textContent = '×';
      del.title = 'Delete timestamp';
      del.setAttribute('aria-label', 'Delete timestamp ' + fmtTime(s.t));
      del.addEventListener('click', function () {
        t.stamps = t.stamps.filter(function (x) { return x !== s; });
        save().then(function () { renderTitles(); renderStamps(); });
      });
      li.appendChild(time); li.appendChild(note); li.appendChild(del);
      list.appendChild(li);
    });
  }

  function render() { renderTitles(); renderStamps(); }

  function callWatcher(fnName, args) {
    return chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['watcher.js']
    }).then(function () {
      return chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function (name, a) { return window.__JSW[name](a); },
        args: [fnName, args || null]
      });
    }).then(function (results) {
      return results && results[0] ? results[0].result : null;
    });
  }

  function setWatchUI(isWatching) {
    watching = isWatching;
    $('startWatch').disabled = isWatching;
    $('stopWatch').disabled = !isWatching;
  }

  function init() {
    chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
      if (tabs[0] && tabs[0].id) tabId = tabs[0].id;
    });

    chrome.storage.local.get(['jsw_titles', 'jsw_active']).then(function (items) {
      titles = items.jsw_titles || [];
      activeId = items.jsw_active || (titles[0] && titles[0].id) || null;
      if (activeId && !titles.some(function (t) { return t.id === activeId; })) {
        activeId = titles[0] ? titles[0].id : null;
      }
      render();
    });

    $('addTitle').addEventListener('click', function () {
      var name = $('newTitle').value.trim();
      if (!name) { setStatus('Enter a title name first.', 'err'); return; }
      var t = { id: uid(), name: name, stamps: [] };
      titles.push(t);
      activeId = t.id;
      $('newTitle').value = '';
      save().then(function () { render(); setStatus('Title added.', 'ok'); });
    });

    $('titleSelect').addEventListener('change', function () {
      activeId = $('titleSelect').value;
      save().then(renderStamps);
    });

    $('deleteTitle').addEventListener('click', function () {
      var t = activeTitle();
      if (!t) return;
      titles = titles.filter(function (x) { return x.id !== t.id; });
      activeId = titles[0] ? titles[0].id : null;
      save().then(function () { render(); setStatus('Title deleted.', 'ok'); });
    });

    $('addStamp').addEventListener('click', function () {
      var t = activeTitle();
      if (!t) { setStatus('Add a title first.', 'err'); return; }
      var secs = parseTime($('newTime').value);
      if (secs === null) { setStatus('Use mm:ss or hh:mm:ss format.', 'err'); return; }
      t.stamps.push({ t: secs, note: $('newNote').value.trim() });
      $('newTime').value = ''; $('newNote').value = '';
      save().then(function () { renderTitles(); renderStamps(); setStatus('Timestamp added.', 'ok'); });
    });

    $('startWatch').addEventListener('click', function () {
      var t = activeTitle();
      if (!t || !t.stamps.length) { setStatus('Add at least one timestamp first.', 'err'); return; }
      if (tabId == null) { setStatus('No active tab.', 'err'); return; }
      setStatus('Starting…');
      callWatcher('start', t.stamps).then(function (res) {
        if (res && res.ok) { setStatus(res.message, 'ok'); setWatchUI(true); }
        else setStatus((res && res.message) || 'Could not start.', 'err');
      }).catch(function () {
        setStatus('Cannot run here (e.g. chrome:// pages).', 'err');
      });
    });

    $('stopWatch').addEventListener('click', function () {
      if (tabId == null) { setWatchUI(false); return; }
      callWatcher('stop').then(function () {
        setStatus('Stopped.', 'ok'); setWatchUI(false);
      }).catch(function () { setWatchUI(false); });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
