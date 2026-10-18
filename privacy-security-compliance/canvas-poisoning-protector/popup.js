/* Canvas Poisoning Protector — popup logic.
 * Shows per-site protection status, master toggle, per-site allowlist,
 * and a fingerprint demo simulated with the same noise algorithm.
 */
(function () {
  'use strict';

  var DEFAULTS = { enabled: true, allowlist: [] };
  var settings = Object.assign({}, DEFAULTS);
  var currentHost = '';

  var els = {};
  ['globalToggle', 'statusDot', 'statusTitle', 'statusHost', 'siteToggleBtn',
   'hash1', 'hash2', 'demoVerdict', 'demoBtn', 'allowList', 'allowEmpty',
   'allowCount'].forEach(function (id) { els[id] = document.getElementById(id); });

  /* ---------- settings ---------- */
  function loadSettings() {
    return new Promise(function (resolve) {
      chrome.storage.sync.get(DEFAULTS, function (res) {
        settings = res;
        resolve();
      });
    });
  }

  function saveSettings() {
    return new Promise(function (resolve) {
      chrome.storage.sync.set(settings, resolve);
    });
  }

  function isAllowlisted(host) {
    return settings.allowlist.some(function (d) {
      return host === d || host.endsWith('.' + d);
    });
  }

  /* ---------- active tab ---------- */
  function getActiveTab() {
    return new Promise(function (resolve) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        resolve(tabs && tabs[0]);
      });
    });
  }

  function hostOf(url) {
    try { return new URL(url).hostname; } catch (e) { return ''; }
  }

  /* ---------- status ---------- */
  function renderStatus(status) {
    var canRun = !!status;
    var active = canRun && status.active;

    els.statusDot.className = 'status-dot ' + (active ? 'on' : canRun ? 'off' : '');
    els.statusTitle.textContent = !canRun
      ? 'Cannot run on this page'
      : active ? 'Protected' : 'Not protected';
    els.statusHost.textContent = currentHost || 'browser-internal or restricted page';

    var allowlisted = canRun && status.allowlisted;
    els.siteToggleBtn.textContent = allowlisted
      ? 'Re-enable for this site'
      : 'Disable for this site';
    els.siteToggleBtn.disabled = !canRun;
    els.siteToggleBtn.style.opacity = canRun ? '1' : '.45';
  }

  function refreshStatus() {
    getActiveTab().then(function (tab) {
      currentHost = tab && tab.url ? hostOf(tab.url) : '';
      if (!tab || !tab.id || !currentHost) { renderStatus(null); return; }
      chrome.tabs.sendMessage(tab.id, { type: 'cpp-status' }, function (res) {
        if (chrome.runtime.lastError) { renderStatus(null); return; }
        renderStatus(res);
      });
    });
  }

  /* ---------- site toggle ---------- */
  els.siteToggleBtn.addEventListener('click', function () {
    if (!currentHost) return;
    var i = settings.allowlist.indexOf(currentHost);
    if (i >= 0) settings.allowlist.splice(i, 1);
    else settings.allowlist.push(currentHost);
    saveSettings().then(function () { renderAllowlist(); refreshStatus(); });
  });

  /* ---------- allowlist UI ---------- */
  function renderAllowlist() {
    var list = settings.allowlist;
    els.allowCount.textContent = list.length;
    els.allowEmpty.style.display = list.length ? 'none' : 'block';
    els.allowList.innerHTML = '';
    list.forEach(function (domain) {
      var li = document.createElement('li');
      var span = document.createElement('span');
      span.textContent = domain;
      var btn = document.createElement('button');
      btn.textContent = '×';
      btn.title = 'Remove exception';
      btn.setAttribute('aria-label', 'Remove ' + domain);
      btn.addEventListener('click', function () {
        settings.allowlist = settings.allowlist.filter(function (d) { return d !== domain; });
        saveSettings().then(function () { renderAllowlist(); refreshStatus(); });
      });
      li.appendChild(span);
      li.appendChild(btn);
      els.allowList.appendChild(li);
    });
  }

  /* ---------- master toggle ---------- */
  els.globalToggle.addEventListener('change', function () {
    settings.enabled = els.globalToggle.checked;
    saveSettings().then(refreshStatus);
  });

  /* ---------- fingerprint demo ---------- */
  // FNV-1a hash of a string.
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return ('0000000' + (h >>> 0).toString(16)).slice(-8);
  }

  // Draw the standard fingerprint test pattern, apply the same ±2
  // sparse noise used by the page protector, and hash the pixels.
  function simulatedFingerprint() {
    var c = document.createElement('canvas');
    c.width = 220; c.height = 30;
    var ctx = c.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(10, 10, 100, 12);
    ctx.fillStyle = '#069';
    ctx.fillText('CanvasPrint 12345', 10, 12);
    ctx.strokeStyle = 'rgba(120,180,60,.8)';
    ctx.beginPath(); ctx.arc(180, 15, 12, 0, Math.PI * 2); ctx.stroke();

    var img = ctx.getImageData(0, 0, c.width, c.height);
    var d = img.data;
    for (var i = 0; i < d.length; i += 28) {
      var delta = Math.floor(Math.random() * 5) - 2;
      d[i] = Math.max(0, Math.min(255, d[i] + delta));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + delta));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + delta));
    }
    var sample = '';
    for (var j = 0; j < d.length; j += 400) sample += d[j] + ',';
    return fnv1a(sample);
  }

  els.demoBtn.addEventListener('click', function () {
    var h1 = simulatedFingerprint();
    var h2 = simulatedFingerprint();
    els.hash1.textContent = h1;
    els.hash2.textContent = h2;
    var different = h1 !== h2;
    els.demoVerdict.textContent = different
      ? '✓ Hashes differ — a tracker would fail to match you across visits.'
      : 'Hashes matched this time (rare) — run again; noise is random per read.';
    els.demoVerdict.className = 'verdict ' + (different ? 'good' : 'same');
  });

  /* ---------- init ---------- */
  loadSettings().then(function () {
    els.globalToggle.checked = settings.enabled;
    renderAllowlist();
    refreshStatus();
  });
})();
