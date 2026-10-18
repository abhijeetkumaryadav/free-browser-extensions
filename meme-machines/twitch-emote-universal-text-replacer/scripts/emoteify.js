/* EmoteSwap page script — injected on demand via chrome.scripting.
 * Replaces Twitch-style emote codes in page text with icons or badge pills.
 * Everything is DOM-built (no innerHTML); restore() puts original text back.
 */
(function () {
  'use strict';

  // Emote codes handled by this fun tool. Word-boundary matched, case-sensitive
  // to match how the codes are actually typed in chat.
  var EMOTES = ['Kappa', 'PogChamp', 'KEKW', 'LUL', 'MonkaS', 'Sadge', 'FeelsBadMan', 'OMEGALUL'];
  var RE = new RegExp('\\b(' + EMOTES.join('|') + ')\\b', 'g');
  var MARK = 'data-es-swap';
  var STYLE_ID = 'es-swap-style';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      'img[' + MARK + ']{height:1.5em;width:1.5em;vertical-align:-0.35em;margin:0 .1em;}' +
      'span[' + MARK + ']{display:inline-block;background:rgba(168,85,247,.16);' +
      'border:1px solid rgba(168,85,247,.55);color:#c084fc;font-weight:700;' +
      'font-size:.82em;padding:.05em .55em;border-radius:999px;margin:0 .1em;' +
      'vertical-align:baseline;white-space:nowrap;}';
    (document.head || document.documentElement).appendChild(st);
  }

  function skipNode(node) {
    var p = node.parentElement;
    while (p) {
      if (p.hasAttribute && p.hasAttribute(MARK)) return true;
      var tag = p.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || tag === 'NOSCRIPT') return true;
      p = p.parentElement;
    }
    return false;
  }

  function buildReplacement(code, mode) {
    var el;
    if (mode === 'icon') {
      el = document.createElement('img');
      // chrome.* is available in the isolated world of an injected file script.
      el.src = chrome.runtime.getURL('assets/emotes/' + code + '.png');
      el.alt = code;
      el.title = code;
    } else {
      el = document.createElement('span');
      el.textContent = code;
    }
    el.setAttribute(MARK, '1');
    return el;
  }

  // Replace emote codes inside text nodes. Returns number of replacements.
  function apply(mode) {
    ensureStyle();
    var count = 0;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (var i = 0; i < nodes.length; i++) {
      var tn = nodes[i];
      if (skipNode(tn)) continue;
      RE.lastIndex = 0;
      if (!RE.test(tn.nodeValue)) continue;
      RE.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var last = 0, m;
      var original = tn.nodeValue;
      while ((m = RE.exec(original)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(original.slice(last, m.index)));
        frag.appendChild(buildReplacement(m[1], mode));
        count++;
        last = m.index + m[0].length;
      }
      frag.appendChild(document.createTextNode(original.slice(last)));
      var wrap = document.createElement('span');
      wrap.setAttribute(MARK, 'wrap');
      wrap.setAttribute('data-es-orig', original);
      wrap.appendChild(frag);
      tn.parentNode.replaceChild(wrap, tn);
    }
    return count;
  }

  // Put original text back. Returns number of restored nodes.
  function restore() {
    var els = document.querySelectorAll('span[' + MARK + '="wrap"]');
    for (var i = 0; i < els.length; i++) {
      var orig = els[i].getAttribute('data-es-orig');
      els[i].parentNode.replaceChild(document.createTextNode(orig === null ? '' : orig), els[i]);
    }
    return els.length;
  }

  function status() {
    return document.querySelectorAll('span[' + MARK + '="wrap"]').length;
  }

  // Expose a tiny API for the popup to call after injecting this file.
  window.__emoteSwap = { apply: apply, restore: restore, status: status, emotes: EMOTES };
})();
