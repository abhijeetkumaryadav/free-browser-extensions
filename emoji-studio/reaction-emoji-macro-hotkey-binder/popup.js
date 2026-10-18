// MacroReact popup — edit macro slots, pick emoji, test-copy. All local.
(function () {
  'use strict';

  var LIBRARY = ['👍','👎','❤️','🔥','🎉','👏','🙌','💯','✅','❌','😂','🥰','😎','🤔','👀','🙏','💪','⭐','⚠️','📌','🎁','🚀','💡','⚡','🌈','☕','🍕','👻','💩','🎵'];
  var DEFAULTS = ['👍', '❤️', '🔥', '🎉', '✅'];
  var COMMAND_IDS = ['macro-1', 'macro-2', 'macro-3', 'macro-4', 'macro-5'];

  var slotsEl = document.getElementById('slots');
  var libraryEl = document.getElementById('library');
  var toast = document.getElementById('toast');
  var toastTimer = null;
  var state = { macros: DEFAULTS.slice(), selected: 0 };

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1400);
  }

  // Pure helper: normalize a slot index into 0..4. Exported for tests.
  function clampSlot(i) {
    i = parseInt(i, 10);
    if (isNaN(i)) return 0;
    return Math.max(0, Math.min(4, i));
  }

  function renderSlots() {
    slotsEl.innerHTML = '';
    state.macros.forEach(function (emoji, i) {
      var row = document.createElement('div');
      row.className = 'slot' + (i === state.selected ? ' selected' : '');
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-label', 'Macro slot ' + (i + 1) + ': ' + emoji);

      var glyph = document.createElement('span');
      glyph.className = 'glyph';
      glyph.textContent = emoji;

      var meta = document.createElement('div');
      meta.className = 'meta';
      var name = document.createElement('div');
      name.className = 'name';
      name.textContent = 'Slot ' + (i + 1);
      var key = document.createElement('div');
      key.className = 'key';
      key.textContent = COMMAND_IDS[i] + ' (Ctrl+Shift+' + (i + 1) + ')';
      meta.appendChild(name);
      meta.appendChild(key);

      var test = document.createElement('button');
      test.className = 'test';
      test.type = 'button';
      test.textContent = 'Copy';
      test.title = 'Copy this emoji now';

      row.appendChild(glyph);
      row.appendChild(meta);
      row.appendChild(test);

      function select() {
        state.selected = i;
        renderSlots();
      }
      row.addEventListener('click', select);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
      });
      test.addEventListener('click', function (e) {
        e.stopPropagation();
        copyText(state.macros[i], function (ok) {
          showToast(ok ? 'Copied ' + state.macros[i] : 'Copy blocked — click the emoji again');
        });
      });
      slotsEl.appendChild(row);
    });
  }

  function renderLibrary() {
    LIBRARY.forEach(function (emoji) {
      var b = document.createElement('button');
      b.className = 'emoji';
      b.type = 'button';
      b.textContent = emoji;
      b.title = 'Assign to slot ' + (state.selected + 1);
      b.addEventListener('click', function () {
        state.macros[state.selected] = emoji;
        chrome.storage.local.set({ macros: state.macros }, function () {
          renderSlots();
          showToast('Slot ' + (state.selected + 1) + ' → ' + emoji);
        });
      });
      libraryEl.appendChild(b);
    });
  }

  function copyText(text, cb) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { cb(true); }, function () {
        fallbackCopy(text); cb(true);
      });
    } else {
      fallbackCopy(text); cb(true);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* unavailable */ }
    document.body.removeChild(ta);
  }

  // Listen for hotkey-triggered copies from the background worker.
  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg && msg.type === 'macro-fired') {
      showToast('Hotkey copied ' + msg.emoji + (msg.ok ? '' : ' (clipboard blocked — use Copy)'));
    }
  });

  chrome.storage.local.get({ macros: DEFAULTS }, function (res) {
    state.macros = Array.isArray(res.macros) && res.macros.length === 5 ? res.macros : DEFAULTS.slice();
    renderSlots();
    renderLibrary();
  });

  // Expose pure helper for node-based testing (no-op in the extension).
  if (typeof module !== 'undefined') module.exports = { clampSlot: clampSlot };
})();
