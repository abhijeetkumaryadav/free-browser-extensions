// Regex Match Highlighter — injected page routine.
//
// This function is passed to chrome.scripting.executeScript as `func`,
// which serializes it. It MUST stay fully self-contained: no references
// to anything outside its own body.
//
// mode: "highlight" | "clear". Returns { count } or { cleared: true }.
function rxhlRun(mode, source, flags) {
  var CLS = "rxhl-hl";
  var STYLE_ID = "rxhl-style";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent =
      "." + CLS + "{background:rgba(139,92,246,.45)!important;color:inherit!important;" +
      "border-radius:3px;box-shadow:0 0 0 1px rgba(139,92,246,.9);}";
    (document.head || document.documentElement).appendChild(st);
  }

  // Non-destructive clear: unwrap our spans back into plain text nodes.
  function clear() {
    var els = document.querySelectorAll("." + CLS);
    for (var i = 0; i < els.length; i++) {
      els[i].replaceWith(document.createTextNode(els[i].textContent));
    }
    if (document.body) document.body.normalize();
    return { cleared: true };
  }

  if (mode === "clear") return clear();
  clear(); // re-highlighting always starts from a clean page
  ensureStyle();

  var fl = flags || "g";
  if (fl.indexOf("g") === -1) fl += "g"; // need global to find every match
  var re = new RegExp(source, fl);

  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1 };
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      if (!node.data || !node.data.trim()) return NodeFilter.FILTER_REJECT;
      var p = node.parentNode;
      while (p && p !== document.body) {
        if (p.nodeType === 1 && (SKIP[p.tagName] || (p.classList && p.classList.contains(CLS)))) {
          return NodeFilter.FILTER_REJECT;
        }
        p = p.parentNode;
      }
      if (node.parentNode && node.parentNode.nodeType === 1 && SKIP[node.parentNode.tagName]) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  var count = 0;
  for (var n = 0; n < nodes.length; n++) {
    var node = nodes[n];
    var text = node.data;
    re.lastIndex = 0;
    var m, last = 0, hits = 0;
    var frag = document.createDocumentFragment();
    while ((m = re.exec(text)) !== null) {
      if (m[0] === "") { // zero-length match guard: never loop forever
        re.lastIndex++;
        if (re.lastIndex > text.length) break;
        continue;
      }
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var span = document.createElement("span");
      span.className = CLS;
      span.textContent = m[0];
      frag.appendChild(span);
      hits++;
      last = m.index + m[0].length;
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    if (hits) {
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
      count += hits;
    }
  }
  return { count: count };
}
