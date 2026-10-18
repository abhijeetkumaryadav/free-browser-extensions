// ToneSet — default skin tone + emoji picker. All local, zero network.
(function () {
  'use strict';

  // Skin-tone modifiers, U+1F3FB..U+1F3FF ("" = default yellow)
  var TONES = [
    { id: '',   label: 'Default', icon: '👋' },
    { id: '\u{1F3FB}', label: 'Light',   icon: '👋🏻' },
    { id: '\u{1F3FC}', label: 'Med-Light', icon: '👋🏼' },
    { id: '\u{1F3FD}', label: 'Medium',  icon: '👋🏽' },
    { id: '\u{1F3FE}', label: 'Med-Dark', icon: '👋🏾' },
    { id: '\u{1F3FF}', label: 'Dark',    icon: '👋🏿' }
  ];

  // Emoji whose rendering accepts a skin-tone modifier (subset of common ones)
  var TONEABLE = ['👋','👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐','🖖','👏','🙌','👐','🤲','🤝','🙏','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','👶','🧒','👦','👧','🧑','👨','👩','🧓','👴','👵','👱','🧔','👮','💂','🕵','👷','🤴','👸','👳','👲','🧕','🤵','👰','🤰','🤱','👼','🎅','🤶','🦸','🦹','🧙','🧚','🧛','🧜','🧝','💆','💇','🚶','🧍','🧎','🏃','💃','🕺','🧘','🛀','🛌','🏋','🚴','🤸','🤼','🤽','🤾','🏄','🏊','🚣','🧗','🚵','🤹','👫','👭','👬','💏','💑','👪'];

  // General emoji for the picker (no toneable overlap needed beyond TONEABLE)
  var EXTRA = ['😀','😂','🥰','😎','🤔','😴','😱','👻','💩','🔥','⭐','💯','🎉','❤️','💔','✅','❌','⚠️','📌','🎁','🍕','☕','🌈','🌙','⚡','🎵','📷','✈️','🚀','💡'];

  var state = { tone: '' };
  var toneGrid = document.getElementById('toneGrid');
  var grid = document.getElementById('grid');
  var search = document.getElementById('search');
  var toast = document.getElementById('toast');
  var toastTimer = null;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1400);
  }

  // Normalized lookup set: strip variation selectors so forms like
  // "✌\uFE0F" and "✌" are treated as the same base.
  var TONEABLE_SET = {};
  TONEABLE.forEach(function (e) { TONEABLE_SET[e.replace(/\uFE0F/g, '')] = true; });

  // Apply the stored tone to a base emoji if it is toneable.
  function applyTone(base) {
    if (!state.tone) return base;
    var clean = base.replace(/\uFE0F/g, '');
    if (!TONEABLE_SET[clean]) return base;
    return clean + state.tone;
  }

  function renderTones() {
    toneGrid.innerHTML = '';
    TONES.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'tone';
      b.type = 'button';
      b.title = t.label;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', state.tone === t.id ? 'true' : 'false');
      b.setAttribute('aria-label', t.label + ' skin tone');
      b.textContent = t.icon;
      b.addEventListener('click', function () {
        state.tone = t.id;
        chrome.storage.local.set({ tone: state.tone });
        renderTones();
        renderGrid(search.value.trim());
        showToast('Default tone: ' + t.label);
      });
      toneGrid.appendChild(b);
    });
  }

  function allEmoji() {
    var seen = {};
    return TONEABLE.concat(EXTRA).filter(function (e) {
      if (seen[e]) return false;
      seen[e] = true;
      return true;
    });
  }

  function renderGrid(query) {
    grid.innerHTML = '';
    var q = (query || '').toLowerCase();
    allEmoji().forEach(function (base) {
      var final = applyTone(base);
      if (q && final.toLowerCase().indexOf(q) === -1 && base.indexOf(q) === -1) return;
      var b = document.createElement('button');
      b.className = 'emoji';
      b.type = 'button';
      b.textContent = final;
      b.title = 'Copy ' + final;
      b.addEventListener('click', function () { copyEmoji(final); });
      grid.appendChild(b);
    });
  }

  function copyEmoji(emoji) {
    function done() { showToast('Copied ' + emoji); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(emoji).then(done, function () { fallbackCopy(emoji, done); });
    } else {
      fallbackCopy(emoji, done);
    }
  }

  function fallbackCopy(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* clipboard unavailable */ }
    document.body.removeChild(ta);
    cb();
  }

  search.addEventListener('input', function () { renderGrid(search.value.trim()); });

  // Restore saved preference, then render.
  chrome.storage.local.get({ tone: '' }, function (res) {
    state.tone = res.tone || '';
    renderTones();
    renderGrid('');
  });
})();
