/* BullyShield content script — extracts visible page text for LOCAL heuristic analysis.
   Runs only when the user clicks "Scan this page". Nothing is transmitted anywhere. */
(() => {
  const MAX_CHARS = 60000;

  function isVisible(el) {
    if (!el || el === document.body || el === document.documentElement) return true;
    const s = window.getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
  }

  function collectText() {
    const parts = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.nodeValue.replace(/\s+/g, " ").trim();
      if (t.length < 2) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") continue;
      if (!isVisible(parent)) continue;
      parts.push(t);
      if (parts.join(" ").length > MAX_CHARS) break;
    }
    return parts.join(" ").slice(0, MAX_CHARS);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg && msg.type === "bullyshield-scan") {
      respond({ ok: true, text: collectText(), url: location.href });
    }
    return true;
  });
})();
