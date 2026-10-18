/* EmoteSwap popup logic.
 * Injects scripts/emoteify.js into the active tab on demand, then calls its
 * tiny API (apply / restore / status). Mode preference persists in storage.
 */
(function () {
  'use strict';

  var EMOTES = ['Kappa', 'PogChamp', 'KEKW', 'LUL', 'MonkaS', 'Sadge', 'FeelsBadMan', 'OMEGALUL'];

  var grid = document.getElementById('emoteGrid');
  var seg = document.getElementById('modeSeg');
  var applyBtn = document.getElementById('applyBtn');
  var restoreBtn = document.getElementById('restoreBtn');
  var stateBadge = document.getElementById('stateBadge');

  var mode = 'icon';

  // Render the emote preview grid (icons are bundled, no network).
  EMOTES.forEach(function (name) {
    var card = document.createElement('div');
    card.className = 'emote';
    var img = document.createElement('img');
    img.src = 'assets/emotes/' + name + '.png';
    img.alt = name;
    var code = document.createElement('code');
    code.textContent = name;
    card.appendChild(img);
    card.appendChild(code);
    grid.appendChild(card);
  });

  // Load saved mode preference.
  chrome.storage.local.get({ esMode: 'icon' }, function (res) {
    setMode(res.esMode === 'badge' ? 'badge' : 'icon');
  });

  function setMode(m) {
    mode = m;
    Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
      b.classList.toggle('on', b.dataset.mode === m);
    });
    chrome.storage.local.set({ esMode: m });
  }

  seg.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-mode]');
    if (b) setMode(b.dataset.mode);
  });

  function setBusy(busy) {
    applyBtn.disabled = busy;
    restoreBtn.disabled = busy;
  }

  function setLive(live) {
    stateBadge.textContent = live ? 'live' : 'idle';
    stateBadge.classList.toggle('live', live);
  }

  // Ensure the content script is present, then run `fn` in the page.
  function withPage(fnName, arg, done) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs.length) return;
      var tabId = tabs[0].id;
      chrome.scripting.executeScript(
        { target: { tabId: tabId }, files: ['scripts/emoteify.js'] },
        function () {
          if (chrome.runtime.lastError) { setBusy(false); return; }
          chrome.scripting.executeScript(
            {
              target: { tabId: tabId },
              func: function (name, a) { return window.__emoteSwap ? window.__emoteSwap[name](a) : -1; },
              args: [fnName, arg]
            },
            function (results) {
              setBusy(false);
              var v = results && results[0] ? results[0].result : -1;
              done(v);
            }
          );
        }
      );
    });
  }

  applyBtn.addEventListener('click', function () {
    setBusy(true);
    withPage('apply', mode, function (n) {
      setLive(n > 0);
    });
  });

  restoreBtn.addEventListener('click', function () {
    setBusy(true);
    withPage('restore', null, function () {
      setLive(false);
    });
  });

  // Show current state when the popup opens.
  setBusy(true);
  withPage('status', null, function (n) {
    setLive(n > 0);
  });
})();
