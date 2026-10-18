/* Text-Eating Pac-Man Cleaner — content script.
 * User-triggered toy: a Pac-Man sweeps the page in a serpentine path and
 * "eats" text nodes with a chomp animation, keeping a score. Fully reversible:
 * text nodes are wrapped in spans (never destroyed) and unwrapped on restore.
 * No audio. Runs only when the popup messages it (injected via chrome.scripting). */
"use strict";

(() => {
  const WRAP_CLS = "__pac-wrap";
  const UI_CLS = "__pacman-ui";
  const PAC = 56; // pac-man diameter in px

  const S = (window.__pacCleaner = window.__pacCleaner || {
    running: false,
    wraps: [],      // {span, node, cx, cy, len, eaten}
    raf: 0,
    score: 0,
    path: [],
    pi: 0,
    pac: null,
    speed: 4,
    frame: 0,
    styleEl: null,
  });

  if (!window.__pacMsgListener) {
    window.__pacMsgListener = true;
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.action === "start") start(msg.speed || 4);
      else if (msg && msg.action === "stop") stop();
    });
  }

  const SKIP_TAGS = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION|BUTTON|CODE|PRE)$/;

  function injectStyles() {
    if (S.styleEl) return;
    const st = document.createElement("style");
    st.textContent = `
      .${WRAP_CLS} { display: inline-block; transition: transform .18s ease, opacity .18s ease; }
      .${WRAP_CLS}.__eaten { transform: scaleX(0.05); opacity: 0; }
      .${UI_CLS} { position: absolute; width: ${PAC}px; height: ${PAC}px; z-index: 2147483647; pointer-events: none; }
      .${UI_CLS}.__flip svg { transform: scaleX(-1); }`;
    document.documentElement.appendChild(st);
    S.styleEl = st;
  }

  /* Collect visible text nodes (capped) with their document coordinates. */
  function collect() {
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const v = n.nodeValue;
        if (!v || !v.trim()) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.test(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.closest("." + UI_CLS) || p.closest("." + WRAP_CLS)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let n, guard = 0;
    while ((n = tw.nextNode()) && guard++ < 3000) nodes.push(n);

    const sy = window.scrollY;
    const out = [];
    for (const node of nodes) {
      const range = document.createRange();
      try { range.selectNodeContents(node); } catch (e) { continue; }
      const r = range.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const span = document.createElement("span");
      span.className = WRAP_CLS;
      node.parentNode.insertBefore(span, node);
      span.appendChild(node);
      out.push({
        span, node,
        cx: r.left + r.width / 2,
        cy: r.top + sy + r.height / 2,
        len: node.nodeValue.length,
        eaten: false,
      });
    }
    return out;
  }

  function makePac() {
    const el = document.createElement("div");
    el.className = UI_CLS;
    el.innerHTML =
      `<svg viewBox="0 0 56 56" width="${PAC}" height="${PAC}">` +
      `<circle cx="28" cy="28" r="26" fill="#facc15"/>` +
      `<polygon fill="#141419" points="28,28 56,13 56,43">` +
      `<animate attributeName="points" dur="0.28s" repeatCount="indefinite" ` +
      `values="28,28 56,13 56,43;28,28 56,28 56,28;28,28 56,13 56,43"/></polygon>` +
      `<circle cx="28" cy="15" r="4" fill="#141419"/></svg>`;
    document.body.appendChild(el);
    return el;
  }

  /* Serpentine sweep path across the whole document. */
  function buildPath() {
    const H = document.documentElement.scrollHeight;
    const W = document.documentElement.clientWidth;
    const path = [];
    let row = 0;
    for (let y = 60; y < H - 30; y += 110, row++) {
      if (row % 2 === 0) { for (let x = 40; x < W - 30; x += 44) path.push({ x, y }); }
      else { for (let x = W - 40; x > 30; x -= 44) path.push({ x, y }); }
    }
    return path.length ? path : [{ x: W / 2, y: 120 }];
  }

  function setScore(v) {
    S.score = v;
    chrome.storage.local.set({ pacScore: v });
  }

  function eat(w) {
    w.eaten = true;
    w.span.classList.add("__eaten");
    setTimeout(() => { w.span.style.visibility = "hidden"; }, 220);
    setScore(S.score + w.len);
  }

  function tick() {
    if (!S.running) return;
    if (S.pi >= S.path.length) { finish(); return; }
    const prev = S.path[Math.max(0, S.pi - 1)];
    const p = S.path[S.pi];
    S.pi += Math.max(1, Math.round(S.speed));
    const pac = S.pac;
    pac.style.left = (p.x - PAC / 2) + "px";
    pac.style.top = (p.y - PAC / 2) + "px";
    pac.classList.toggle("__flip", p.x < prev.x);

    // Eat check every 3rd frame against precomputed coordinates.
    if (++S.frame % 3 === 0) {
      const px = p.x, py = p.y;
      for (const w of S.wraps) {
        if (w.eaten) continue;
        if (Math.abs(w.cx - px) < 46 && Math.abs(w.cy - py) < 46) eat(w);
      }
    }
    S.raf = requestAnimationFrame(tick);
  }

  function start(speed) {
    stop(true); // silent cleanup of any previous run
    injectStyles();
    S.speed = speed;
    setScore(0);
    S.wraps = collect();
    S.path = buildPath();
    S.pi = 0;
    S.frame = 0;
    S.pac = makePac();
    S.running = true;
    cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(tick);
  }

  /* finish: sweep complete — leave eaten text hidden, remove pac. */
  function finish() {
    S.running = false;
    cancelAnimationFrame(S.raf);
    if (S.pac) { S.pac.remove(); S.pac = null; }
  }

  /* stop: full restore — unwrap every text node, remove pac + styles. */
  function stop(silent) {
    S.running = false;
    cancelAnimationFrame(S.raf);
    for (const w of S.wraps) {
      try {
        const parent = w.span.parentNode;
        if (parent) {
          parent.insertBefore(w.node, w.span);
          w.span.remove();
        }
      } catch (e) { /* ignore */ }
    }
    S.wraps = [];
    if (S.pac) { S.pac.remove(); S.pac = null; }
    if (S.styleEl) { S.styleEl.remove(); S.styleEl = null; }
    if (!silent) setScore(0);
  }
})();
