/* ReactPop page overlay.
 * Injected on-demand (user clicked "Pop out"). Idempotent: re-injecting only
 * spawns another overlay, never duplicates listeners. Fully self-contained —
 * no dependencies on popup scope (MV3 CSP forbids eval/new Function).
 */
(() => {
  'use strict';

  const NS = 'reactpop-overlay';

  function makeOverlay(gifUrl) {
    // Shadow DOM keeps page styles from leaking into the overlay.
    const host = document.createElement('div');
    host.className = NS;
    host.style.cssText = 'position:fixed;z-index:2147483647;top:24%;left:60%;pointer-events:auto;';

    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      .box { position: relative; width: 150px; cursor: grab; user-select: none;
             filter: drop-shadow(0 8px 24px rgba(0,0,0,.45)); }
      .box:active { cursor: grabbing; }
      img { width: 150px; height: 150px; display: block; border-radius: 18px;
            background: rgba(13,13,18,.85); border: 1px solid rgba(236,72,153,.5); }
      .close { position: absolute; top: -10px; right: -10px; width: 26px; height: 26px;
               border-radius: 50%; border: none; cursor: pointer;
               background: #ec4899; color: #fff; font-size: 14px; line-height: 1;
               display: flex; align-items: center; justify-content: center; }
    `;
    const box = document.createElement('div');
    box.className = 'box';
    const img = document.createElement('img');
    img.src = gifUrl;
    img.alt = 'Reaction popout';
    img.draggable = false;
    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close reaction');
    close.addEventListener('click', (e) => { e.stopPropagation(); host.remove(); });
    box.append(img, close);
    shadow.append(style, box);
    document.documentElement.appendChild(host);

    // Simple drag handling.
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    box.addEventListener('mousedown', (e) => {
      if (e.target === close) return;
      dragging = true;
      const r = host.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      host.style.left = `${ox + e.clientX - sx}px`;
      host.style.top = `${oy + e.clientY - sy}px`;
    });
    window.addEventListener('mouseup', () => { dragging = false; });
  }

  // Listen once per page for show requests.
  if (!window.__reactpopListening) {
    window.__reactpopListening = true;
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'reactpop-show' && typeof msg.gif === 'string') {
        makeOverlay(msg.gif);
      }
    });
  }
})();
