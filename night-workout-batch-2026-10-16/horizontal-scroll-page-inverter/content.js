/* ScrollFlip content script — remaps wheel deltaX and/or mirrors layout. Reversible. */
(() => {
  "use strict";

  const STYLE_ID = "scrollflip-style";
  const ATTR = "data-scrollflip";

  let flip = false;
  let mirror = false;
  let wheelHandler = null;

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.documentElement.appendChild(style);
    }
    return style;
  }

  function render() {
    const style = ensureStyle();
    style.textContent = mirror
      ? `html[${ATTR}] { transform: scaleX(-1); transform-origin: center; }`
      : "";
    document.documentElement.toggleAttribute(ATTR, mirror);

    if (flip && !wheelHandler) {
      // Remap horizontal wheel direction: invert deltaX so scrolling
      // left moves content right and vice versa.
      wheelHandler = (e) => {
        if (e.deltaX !== 0 && !e.defaultPrevented) {
          e.preventDefault();
          e.stopPropagation();
          const target = e.target === document ? document.scrollingElement : e.target;
          const scroller = findScroller(e.target) || document.scrollingElement;
          if (scroller) scroller.scrollLeft += e.deltaX;
        }
      };
      window.addEventListener("wheel", wheelHandler, { passive: false, capture: true });
    } else if (!flip && wheelHandler) {
      window.removeEventListener("wheel", wheelHandler, { capture: true });
      wheelHandler = null;
    }
  }

  // Walk up to find the nearest horizontally-scrollable ancestor.
  function findScroller(el) {
    let node = el instanceof Element ? el : document.scrollingElement;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      if (/(auto|scroll)/.test(cs.overflowX) && node.scrollWidth > node.clientWidth) return node;
      node = node.parentElement;
    }
    return document.scrollingElement;
  }

  function teardown() {
    flip = false;
    mirror = false;
    if (wheelHandler) {
      window.removeEventListener("wheel", wheelHandler, { capture: true });
      wheelHandler = null;
    }
    const old = document.getElementById(STYLE_ID);
    if (old) old.remove();
    document.documentElement.removeAttribute(ATTR);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "scrollflip-set") {
      flip = !!msg.flip;
      mirror = !!msg.mirror;
      render();
      sendResponse({ ok: true, flip, mirror });
    } else if (msg.type === "scrollflip-reset") {
      teardown();
      sendResponse({ ok: true, flip: false, mirror: false });
    } else if (msg.type === "scrollflip-status") {
      sendResponse({ ok: true, flip, mirror });
    }
    return false;
  });
})();
