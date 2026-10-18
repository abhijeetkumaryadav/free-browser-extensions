/* My Word Hover — content script.
 * Reads the user's personal word->translation dictionary from storage and
 * shows a small tooltip when the mouse hovers over a known word.
 * Read-only: never modifies the page DOM except injecting the tooltip div. */
(function () {
  const TOOLTIP_ID = '__wordhover_tooltip__';
  let dict = {};           // word (lowercase) -> { t: translation, note: '' }
  let enabled = true;
  let tip = null;
  let lastWord = '';

  function loadDict() {
    return chrome.storage.local.get(['words', 'enabled']).then(res => {
      dict = res.words || {};
      enabled = res.enabled !== false;
    }).catch(() => { dict = {}; enabled = true; });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.words) dict = changes.words.newValue || {};
    if (changes.enabled) enabled = changes.enabled.newValue !== false;
  });

  function wordAt(x, y) {
    // caretRangeFromPoint / caretPositionFromPoint to find the text node.
    let range = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y);
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.setEnd(pos.offsetNode, pos.offset);
      }
    }
    if (!range || !range.startContainer || range.startContainer.nodeType !== 3) return null;
    const text = range.startContainer.textContent;
    let off = range.startOffset;
    if (off >= text.length) off = text.length - 1;
    // Expand to word boundaries (letters, apostrophes, hyphens).
    const isWordChar = c => /[A-Za-zÀ-ÖØ-öø-ÿ'’-]/u.test(c);
    if (!isWordChar(text[off] || '')) return null;
    let a = off, b = off;
    while (a > 0 && isWordChar(text[a - 1])) a--;
    while (b < text.length && isWordChar(text[b])) b++;
    const word = text.slice(a, b).replace(/['’-]+$/u, '');
    return word.length >= 2 ? word : null;
  }

  function showTip(x, y, word, entry) {
    if (!tip) {
      tip = document.createElement('div');
      tip.id = TOOLTIP_ID;
      tip.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;' +
        'background:rgba(20,20,26,.95);backdrop-filter:blur(8px);' +
        'border:1px solid rgba(34,211,238,.4);border-radius:10px;' +
        'padding:8px 10px;font:13px/1.4 system-ui,sans-serif;color:#eef2f7;' +
        'max-width:240px;box-shadow:0 8px 24px rgba(0,0,0,.5);';
      document.documentElement.appendChild(tip);
    }
    const safe = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    tip.innerHTML = '<div style="font-weight:600;color:#22d3ee">' + safe(word) + '</div>' +
      '<div>' + safe(entry.t) + '</div>' +
      (entry.note ? '<div style="color:#9aa3b2;font-size:11px;margin-top:4px">' + safe(entry.note) + '</div>' : '');
    tip.style.display = 'block';
    const w = 250, h = 80;
    let lx = x + 14, ly = y + 16;
    if (lx + w > window.innerWidth) lx = x - w - 8;
    if (ly + h > window.innerHeight) ly = y - h - 8;
    tip.style.left = lx + 'px';
    tip.style.top = ly + 'px';
  }

  function hideTip() {
    if (tip) tip.style.display = 'none';
    lastWord = '';
  }

  // Throttled hover lookup: only fire when the hovered word actually changes.
  let throttle = 0;
  document.addEventListener('mousemove', e => {
    const now = performance.now();
    if (now - throttle < 80) return;
    throttle = now;
    if (!enabled) { hideTip(); return; }
    const word = wordAt(e.clientX, e.clientY);
    if (!word || word === lastWord) {
      if (!word) hideTip();
      return;
    }
    lastWord = word;
    const entry = dict[word.toLowerCase()];
    if (entry) showTip(e.clientX, e.clientY, word, entry);
    else hideTip();
  }, { passive: true });

  document.addEventListener('mouseout', e => {
    if (e.relatedTarget === null || !document.documentElement.contains(e.relatedTarget)) hideTip();
  });

  loadDict();
})();
