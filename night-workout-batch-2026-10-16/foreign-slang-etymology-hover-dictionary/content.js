/* ============================================================
   Etymology Hover — content script (click-only injection).
   Wraps whole-word matches of the user's dictionary entries in
   highlighted spans; hovering a span shows a tooltip with the
   user's own etymology note. Fully reversible via ETYM_REMOVE.
   Page DOM text is never destructively modified.
   ============================================================ */
(() => {
  "use strict";

  const ATTR = "data-etym-hover";
  const TIP_ID = "etym-hover-tip";

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function buildPattern(entries) {
    const keys = Object.keys(entries).sort((a, b) => b.length - a.length);
    if (!keys.length) return null;
    return new RegExp("(?<!\\w)(" + keys.map(escapeRe).join("|") + ")(?!\\w)", "gi");
  }

  function ensureTip() {
    let tip = document.getElementById(TIP_ID);
    if (tip) return tip;
    tip = document.createElement("div");
    tip.id = TIP_ID;
    tip.style.cssText = [
      "position:fixed", "z-index:2147483647", "max-width:280px",
      "background:rgba(20,20,26,.94)", "color:#e8e8ef",
      "border:1px solid rgba(167,139,250,.5)", "border-radius:10px",
      "padding:10px 12px", "font:13px/1.5 system-ui,sans-serif",
      "box-shadow:0 8px 28px rgba(0,0,0,.5)", "pointer-events:none",
      "display:none"
    ].join(";");
    document.documentElement.appendChild(tip);
    return tip;
  }

  function apply(entries) {
    remove(); // idempotent
    const pattern = buildPattern(entries);
    if (!pattern) return;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          const tag = p.tagName;
          if (/^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION)$/.test(tag)) return NodeFilter.FILTER_REJECT;
          if (p.hasAttribute(ATTR)) return NodeFilter.FILTER_REJECT;
          if (p.isContentEditable) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue;
      pattern.lastIndex = 0;
      if (!pattern.test(text)) continue;
      pattern.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0, m;
      while ((m = pattern.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const span = document.createElement("span");
        span.setAttribute(ATTR, "");
        span.textContent = m[0];
        const key = m[0].toLowerCase();
        span.dataset.etymNote = entries[key] || "";
        span.style.cssText = "border-bottom:2px dotted #a78bfa; cursor:help;";
        span.addEventListener("mouseenter", showTip);
        span.addEventListener("mouseleave", hideTip);
        frag.appendChild(span);
        last = m.index + m[0].length;
        if (m[0].length === 0) pattern.lastIndex++;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
  }

  function showTip(e) {
    const tip = ensureTip();
    tip.innerHTML = "";
    const w = document.createElement("div");
    w.style.cssText = "font-weight:700;color:#a78bfa;margin-bottom:4px;";
    w.textContent = e.target.textContent;
    const n = document.createElement("div");
    n.textContent = e.target.dataset.etymNote;
    tip.appendChild(w); tip.appendChild(n);
    tip.style.display = "block";
    const x = Math.min(e.clientX + 14, window.innerWidth - 300);
    const y = Math.min(e.clientY + 14, window.innerHeight - 120);
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  }

  function hideTip() {
    const tip = document.getElementById(TIP_ID);
    if (tip) tip.style.display = "none";
  }

  function remove() {
    document.querySelectorAll(`[${ATTR}]`).forEach(span => {
      span.replaceWith(document.createTextNode(span.textContent));
    });
    const tip = document.getElementById(TIP_ID);
    if (tip) tip.remove();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "ETYM_APPLY") apply(msg.entries || {});
    if (msg.type === "ETYM_REMOVE") remove();
  });
})();
