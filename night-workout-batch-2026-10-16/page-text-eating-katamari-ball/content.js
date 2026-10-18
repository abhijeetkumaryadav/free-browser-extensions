/* Katamari Text Muncher — content script. A silly page game.
 * A ball follows the mouse and visually "munches" page words by drawing
 * colored dots over them on a separate canvas layer.
 * The page DOM is NEVER modified. One message removes everything.
 * Guarded against double injection. */
(() => {
  'use strict';
  if (window.__katamariInstalled) return;
  window.__katamariInstalled = true;

  const MAX_WORDS = 700;
  let coversCanvas = null, ballCanvas = null, coversCtx = null, ballCtx = null;
  let words = [];            // {node, start, end, rect, eaten}
  let ball = { x: 0, y: 0, r: 22, color: '#4ade80' };
  let running = false, rafId = 0, mouse = { x: 0, y: 0 }, score = 0;

  function makeCanvas(z) {
    const c = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.floor(window.innerWidth * dpr);
    c.height = Math.floor(window.innerHeight * dpr);
    c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;' +
      'z-index:' + z + ';pointer-events:none;';
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    document.documentElement.appendChild(c);
    return [c, ctx];
  }

  // Collect up to MAX_WORDS visible words with their ranges and rects.
  function collectWords() {
    words = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      { acceptNode: (n) => {
          const p = n.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          const tag = p.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' ||
              tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'BUTTON') {
            return NodeFilter.FILTER_REJECT;
          }
          return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        } }
    );
    const re = /\S+/g;
    let node;
    while ((node = walker.nextNode()) && words.length < MAX_WORDS) {
      const text = node.nodeValue;
      let m;
      while ((m = re.exec(text)) && words.length < MAX_WORDS) {
        try {
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const r = range.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            words.push({ node, start: m.index, end: m.index + m[0].length, rect: r, eaten: false });
          }
        } catch (e) { /* detached node: skip */ }
      }
    }
  }

  // Redraw every eaten word's cover dot at its current on-screen position.
  function redrawCovers() {
    coversCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const w of words) {
      if (!w.eaten) continue;
      try {
        const range = document.createRange();
        range.setStart(w.node, w.start);
        range.setEnd(w.node, w.end);
        w.rect = range.getBoundingClientRect();
      } catch (e) { continue; }
      const r = w.rect;
      if (r.width <= 0 || r.height <= 0) continue;
      coversCtx.save();
      coversCtx.fillStyle = ball.color;
      coversCtx.beginPath();
      coversCtx.arc(r.x + r.width / 2, r.y + r.height / 2, Math.max(r.height * 0.75, 4), 0, Math.PI * 2);
      coversCtx.fill();
      coversCtx.restore();
    }
  }

  function eatAt(x, y) {
    for (const w of words) {
      if (w.eaten) continue;
      const r = w.rect;
      if (!r) continue;
      // Cheap broad-phase check against the ball's bounding square.
      if (x + ball.r < r.x || x - ball.r > r.x + r.width ||
          y + ball.r < r.y || y - ball.r > r.y + r.height) continue;
      // Recompute the fresh rect (page may have shifted) before eating.
      try {
        const range = document.createRange();
        range.setStart(w.node, w.start);
        range.setEnd(w.node, w.end);
        w.rect = range.getBoundingClientRect();
      } catch (e) { continue; }
      const rr = w.rect;
      if (rr.width <= 0 || rr.height <= 0) continue;
      if (x + ball.r < rr.x || x - ball.r > rr.x + rr.width ||
          y + ball.r < rr.y || y - ball.r > rr.y + rr.height) continue;
      w.eaten = true;
      score++;
      ball.r = Math.min(ball.r + 0.35, 70);
      coversCtx.save();
      coversCtx.fillStyle = ball.color;
      coversCtx.beginPath();
      coversCtx.arc(rr.x + rr.width / 2, rr.y + rr.height / 2, Math.max(rr.height * 0.75, 4), 0, Math.PI * 2);
      coversCtx.fill();
      coversCtx.restore();
    }
  }

  function drawBall() {
    ballCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    // Ball body.
    const g = ballCtx.createRadialGradient(ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, ball.r * 0.1, ball.x, ball.y, ball.r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, ball.color);
    g.addColorStop(1, '#0e0e12');
    ballCtx.fillStyle = g;
    ballCtx.beginPath();
    ballCtx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ballCtx.fill();
    // HUD.
    ballCtx.fillStyle = 'rgba(14,14,18,.8)';
    ballCtx.fillRect(12, 12, 130, 34);
    ballCtx.fillStyle = '#4ade80';
    ballCtx.font = '600 15px system-ui, sans-serif';
    ballCtx.fillText('Munched: ' + score, 24, 34);
  }

  function loop() {
    if (!running) return;
    ball.x += (mouse.x - ball.x) * 0.18;
    ball.y += (mouse.y - ball.y) * 0.18;
    eatAt(ball.x, ball.y);
    drawBall();
    rafId = requestAnimationFrame(loop);
  }

  function onMouse(e) { mouse.x = e.clientX; mouse.y = e.clientY; }
  function onKey(e) { if (e.key === 'Escape') stopBall(); }
  function onScroll() { if (running || coversCanvas) redrawCovers(); }

  function ensureCanvases() {
    if (!coversCanvas) [coversCanvas, coversCtx] = makeCanvas(2147483646);
    if (!ballCanvas) [ballCanvas, ballCtx] = makeCanvas(2147483647);
  }

  async function start() {
    try {
      const { katamariSettings } = await chrome.storage.local.get('katamariSettings');
      if (katamariSettings) {
        ball.color = katamariSettings.color || ball.color;
        ball.r = Math.max(10, Math.min(45, (katamariSettings.size || 44) / 2));
      }
    } catch (e) { /* keep defaults */ }
    ensureCanvases();
    if (words.length === 0) collectWords();
    ball.x = window.innerWidth / 2;
    ball.y = window.innerHeight / 2;
    mouse.x = ball.x; mouse.y = ball.y;
    running = true;
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function stopBall() {
    running = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener('mousemove', onMouse);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('scroll', onScroll, true);
    if (ballCtx) ballCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  function resetAll() {
    stopBall();
    if (coversCanvas && coversCanvas.parentNode) coversCanvas.parentNode.removeChild(coversCanvas);
    if (ballCanvas && ballCanvas.parentNode) ballCanvas.parentNode.removeChild(ballCanvas);
    coversCanvas = ballCanvas = coversCtx = ballCtx = null;
    words = [];
    score = 0;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'KATAMARI_START') start();
    if (msg.type === 'KATAMARI_RESET') resetAll();
  });
})();
