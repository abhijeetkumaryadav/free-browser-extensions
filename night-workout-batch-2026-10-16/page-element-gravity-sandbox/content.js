/* Page Gravity Sandbox — content script.
 * User-triggered toy: page elements become physics bodies that fall, bounce
 * off the viewport floor/walls and settle. Fully reversible: every element's
 * original inline style is saved and restored, so the DOM is never destroyed.
 * Runs only when the popup messages it (injected via chrome.scripting). */
"use strict";

(() => {
  // Singleton state; re-injection is a no-op for setup.
  const S = (window.__gravitySandbox = window.__gravitySandbox || {
    running: false,
    bodies: [],
    raf: 0,
    gravity: 0.6,
  });

  if (!window.__gravityMsgListener) {
    window.__gravityMsgListener = true;
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.action === "start") start(msg.gravity || 0.6);
      else if (msg && msg.action === "stop") stop();
    });
  }

  const SKIP_TAGS = /^(SCRIPT|STYLE|NOSCRIPT|LINK|META|TITLE|IFRAME|OBJECT|EMBED|SVG|CANVAS|VIDEO|INPUT|TEXTAREA|SELECT|OPTION)$/;

  /* Collect visible, reasonably-sized elements; keep only the topmost
   * candidates (no candidate may be an ancestor of another) and cap count. */
  function candidates() {
    const all = [...document.querySelectorAll("body *")].filter((el) => {
      if (SKIP_TAGS.test(el.tagName)) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 24 && r.height >= 16 && r.bottom > -100 && r.top < window.innerHeight + 100;
    });
    const set = new Set(all);
    const top = all.filter((el) => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        if (set.has(p)) return false;
        p = p.parentElement;
      }
      return true;
    });
    // Prefer larger elements; cap for performance.
    const rects = new Map();
    const area = (el) => {
      if (!rects.has(el)) rects.set(el, el.getBoundingClientRect());
      const r = rects.get(el);
      return r.width * r.height;
    };
    top.sort((a, b) => area(b) - area(a));
    return top.slice(0, 120).map((el) => ({ el, r: rects.get(el) || el.getBoundingClientRect() }));
  }

  function start(g) {
    stop(); // restore any previous run first
    S.gravity = g;
    S.bodies = candidates().map(({ el, r }) => {
      const orig = el.style.cssText;
      // Pin the element exactly where it is, then animate via transform.
      el.style.setProperty("position", "fixed", "important");
      el.style.setProperty("left", r.left + "px", "important");
      el.style.setProperty("top", r.top + "px", "important");
      el.style.setProperty("width", r.width + "px", "important");
      el.style.setProperty("height", r.height + "px", "important");
      el.style.setProperty("margin", "0", "important");
      el.style.setProperty("box-sizing", "border-box", "important");
      return {
        el, orig,
        ox: r.left, oy: r.top, x: r.left, y: r.top,
        w: r.width, h: r.height,
        vx: (Math.random() - 0.5) * 3,
        vy: 0,
      };
    });
    S.running = true;
    cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(tick);
  }

  function tick() {
    if (!S.running) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const G = S.gravity;
    for (const b of S.bodies) {
      b.vy += G;
      b.x += b.vx;
      b.y += b.vy;
      const floor = H - b.h;
      if (b.y >= floor) {
        b.y = floor;
        b.vy *= -0.5;   // bounce damping
        b.vx *= 0.97;   // friction
        if (Math.abs(b.vy) < 1.2) b.vy = 0; // come to rest
      }
      if (b.x <= 0) { b.x = 0; b.vx = Math.abs(b.vx) * 0.6; }
      if (b.x >= W - b.w) { b.x = W - b.w; b.vx = -Math.abs(b.vx) * 0.6; }
      b.el.style.transform = `translate(${b.x - b.ox}px, ${b.y - b.oy}px)`;
    }
    S.raf = requestAnimationFrame(tick);
  }

  function stop() {
    S.running = false;
    cancelAnimationFrame(S.raf);
    for (const b of S.bodies) {
      try { b.el.style.cssText = b.orig; } catch (e) { /* element removed; ignore */ }
    }
    S.bodies = [];
  }
})();
