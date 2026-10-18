/* FontSharp content script — applies pure-CSS typography tuning. Fully reversible. */
(() => {
  "use strict";

  const STYLE_ID = "fontsharp-style";

  const SMOOTHING = [
    "-webkit-font-smoothing: none; text-rendering: optimizeSpeed;",
    "-webkit-font-smoothing: auto; text-rendering: optimizeLegibility;",
    "-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;"
  ];

  function buildCSS(cfg) {
    const smooth = SMOOTHING[cfg.smoothing] || SMOOTHING[1];
    let css = `html body, html body * { ${smooth} letter-spacing: ${cfg.spacing}em; }`;
    if (cfg.contrast > 0) {
      css += ` html body { filter: contrast(${(1 + cfg.contrast / 100).toFixed(2)}); }`;
    }
    return css;
  }

  function apply(cfg) {
    remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = buildCSS(cfg);
    document.documentElement.appendChild(style);
  }

  function remove() {
    const old = document.getElementById(STYLE_ID);
    if (old) old.remove();
  }

  function isApplied() {
    return !!document.getElementById(STYLE_ID);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "fontsharp-apply") {
      apply(msg.cfg);
      sendResponse({ ok: true, applied: true });
    } else if (msg.type === "fontsharp-reset") {
      remove();
      sendResponse({ ok: true, applied: false });
    } else if (msg.type === "fontsharp-status") {
      sendResponse({ ok: true, applied: isApplied() });
    }
    return false;
  });
})();
