// H1 Sleuth — content script (injected on click only via chrome.scripting).
// Collects all h1 elements with their text, visibility, and DOM location,
// plus a full heading outline (h1-h6) for context.
(function () {
  "use strict";

  function cssPath(el) {
    var parts = [];
    while (el && el.nodeType === 1 && parts.length < 5) {
      var name = el.tagName.toLowerCase();
      if (el.id) { parts.unshift(name + "#" + el.id); break; }
      var sib = el, n = 1;
      while ((sib = sib.previousElementSibling)) {
        if (sib.tagName === el.tagName) n++;
      }
      parts.unshift(name + ":nth-of-type(" + n + ")");
      el = el.parentElement;
    }
    return parts.join(" > ");
  }

  function visible(el) {
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 &&
      cs.visibility !== "hidden" && cs.display !== "none" &&
      parseFloat(cs.opacity || "1") > 0;
  }

  var h1s = Array.prototype.slice.call(document.querySelectorAll("h1"))
    .map(function (el) {
      return {
        text: (el.innerText || el.textContent || "").trim().slice(0, 120),
        visible: visible(el),
        path: cssPath(el)
      };
    });

  var outline = Array.prototype.slice.call(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
    .slice(0, 80)
    .map(function (el) {
      return {
        level: parseInt(el.tagName.slice(1), 10),
        text: ((el.innerText || el.textContent || "").trim().slice(0, 90)) || "(empty)",
        visible: visible(el)
      };
    });

  return { url: location.href, h1s: h1s, outline: outline };
})();
