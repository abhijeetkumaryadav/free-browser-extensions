// PaletteSwap content script — applies / removes the recolor stylesheet.
// Runs only when the user triggers it from the popup (programmatic injection).
(function () {
  "use strict";

  var STYLE_ID = "paletteswap-style";
  var CLASS_ON = "paletteswap-on";

  /** Build the override CSS for a palette {bg, text, link}. */
  function cssFor(p) {
    return [
      "html." + CLASS_ON + ", html." + CLASS_ON + " body {",
      "  background-color: " + p.bg + " !important;",
      "  color: " + p.text + " !important;",
      "}",
      "html." + CLASS_ON + " body *:not(svg):not(svg *):not(img):not(video):not(canvas):not(iframe) {",
      "  background-color: transparent !important;",
      "  border-color: " + p.text + "55 !important;",
      "  color: " + p.text + " !important;",
      "  text-shadow: none !important;",
      "  box-shadow: none !important;",
      "}",
      "html." + CLASS_ON + " a, html." + CLASS_ON + " a * {",
      "  color: " + p.link + " !important;",
      "}",
      "html." + CLASS_ON + " input, html." + CLASS_ON + " textarea, html." + CLASS_ON + " select,",
      "html." + CLASS_ON + " button {",
      "  background-color: " + p.bg + " !important;",
      "  color: " + p.text + " !important;",
      "  border: 1px solid " + p.text + "55 !important;",
      "}",
      "html." + CLASS_ON + " ::placeholder { color: " + p.text + "88 !important; }",
      "html." + CLASS_ON + " ::selection { background: " + p.link + " !important; color: " + p.bg + " !important; }"
    ].join("\n");
  }

  function apply(palette) {
    remove(); // idempotent: clear any previous palette first
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = cssFor(palette);
    (document.head || document.documentElement).appendChild(style);
    document.documentElement.classList.add(CLASS_ON);
  }

  function remove() {
    var old = document.getElementById(STYLE_ID);
    if (old) old.remove();
    document.documentElement.classList.remove(CLASS_ON);
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type) return;
    if (msg.type === "paletteswap-apply" && msg.palette) {
      apply(msg.palette);
      sendResponse({ ok: true });
    } else if (msg.type === "paletteswap-reset") {
      remove();
      sendResponse({ ok: true });
    } else if (msg.type === "paletteswap-status") {
      sendResponse({ applied: !!document.getElementById(STYLE_ID) });
    }
  });
})();
