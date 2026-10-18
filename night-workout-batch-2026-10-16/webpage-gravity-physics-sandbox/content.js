// content.js — Gravity Sandbox toy. All state lives on window.__gravSandbox;
// the real page DOM is never modified (we render absolutely-positioned clones).
(function () {
  'use strict';
  if (window.__gravSandbox) return; // already injected
  const state = { raf: 0, bodies: [], layer: null, running: false };
  window.__gravSandbox = state;

  // Take a safe snapshot of the largest visible leaf blocks and turn them into clones.
  function collectBodies() {
    const els = document.querySelectorAll('div,section,article,header,footer,main,p,h1,h2,h3,img,button,a');
    const out = [];
    for (const el of els) {
      if (el.offsetParent === null && el !== document.body) continue; // hidden
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 12 || r.width > innerWidth * 0.95) continue;
      if (r.bottom < 0 || r.top > innerHeight) continue;
      // Skip containers that contain other candidates (take leaves only).
      if (el.querySelector('div,section,article,header,footer,main')) continue;
      if (out.length >= 60) break;
      const clone = el.cloneNode(true);
      clone.removeAttribute('id');
      const style = getComputedStyle(el);
      Object.assign(clone.style, {
        position: 'fixed', left: r.left + 'px', top: r.top + 'px',
        width: r.width + 'px', height: r.height + 'px', margin: '0',
        background: style.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#3f3f46' : style.backgroundColor,
        color: style.color, fontSize: style.fontSize, zIndex: 2147483000,
        pointerEvents: 'none', boxSizing: 'border-box', overflow: 'hidden',
        borderRadius: '6px', opacity: '0.95'
      });
      out.push({ el: clone, x: r.left, y: r.top, w: r.width, h: r.height,
                 vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 3, rot: 0, vr: (Math.random() - 0.5) * 4 });
    }
    return out;
  }

  function step(g, bounce) {
    const floor = innerHeight;
    for (const b of state.bodies) {
      b.vy += g * 0.016 * 60 / 60; // per-frame gravity feel
      b.x += b.vx; b.y += b.vy; b.rot += b.vr;
      if (b.y + b.h > floor) {           // floor collision
        b.y = floor - b.h;
        b.vy = -b.vy * bounce;
        b.vx *= 0.98; b.vr *= 0.96;
        if (Math.abs(b.vy) < 0.6) b.vy = 0;
      }
      if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) * bounce; }
      if (b.x + b.w > innerWidth) { b.x = innerWidth - b.w; b.vx = -Math.abs(b.vx) * bounce; }
      b.el.style.transform = `translate(${b.x - b.x + 0}px,0)`; // noop guard
      b.el.style.left = b.x + 'px';
      b.el.style.top = b.y + 'px';
      b.el.style.rotate = b.rot + 'deg';
    }
    if (state.running) state.raf = requestAnimationFrame(() => step(g, bounce));
  }

  // Public entry points called from the popup via executeScript(func).
  window.__gravSandboxDrop = function (gravity, bounce) {
    window.__gravSandboxRestore();
    state.layer = document.createElement('div');
    state.layer.style.cssText = 'position:fixed;inset:0;z-index:2147482999;pointer-events:none;';
    document.documentElement.appendChild(state.layer);
    state.bodies = collectBodies();
    for (const b of state.bodies) state.layer.appendChild(b.el);
    state.running = true;
    state.raf = requestAnimationFrame(() => step(gravity, bounce));
  };

  window.__gravSandboxRestore = function () {
    state.running = false;
    cancelAnimationFrame(state.raf);
    if (state.layer && state.layer.parentNode) state.layer.parentNode.removeChild(state.layer);
    state.bodies = []; state.layer = null;
  };
})();
