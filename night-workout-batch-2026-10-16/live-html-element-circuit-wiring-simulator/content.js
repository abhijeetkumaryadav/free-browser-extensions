/* Circuit Wiring Simulator — pure canvas overlay toy.
   The page DOM is NEVER modified: everything renders on a fixed-position,
   pointer-events-none canvas that is removed entirely on hide(). */
(() => {
  if (window.__circuitToy) return; // guard against double injection

  const ACCENT = '#a3e635';
  let canvas = null, ctx = null, raf = 0, nodes = [], wires = [], pulses = [];
  let cfg = { style: 'hub', speed: 4, nodes: 18 };
  let running = false;

  /* ---------- node collection (viewport coords, no DOM changes) ---------- */
  function collectNodes(max) {
    const els = document.querySelectorAll(
      'div,section,article,main,button,img,form,nav,header,footer,aside,p,h1,h2,h3,figure');
    const seen = [];
    const step = Math.max(1, Math.floor(els.length / (max * 4)));
    for (let i = 0; i < els.length && seen.length < max; i += step) {
      const el = els[i];
      let r;
      try { r = el.getBoundingClientRect(); } catch { continue; }
      if (r.width * r.height < 400) continue;            // skip tiny fragments
      if (r.bottom < -50 || r.top > innerHeight + 50) continue;
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      if (seen.some((p) => Math.abs(p.x - x) < 24 && Math.abs(p.y - y) < 24)) continue;
      seen.push({ x, y, w: r.width, h: r.height });
    }
    return seen;
  }

  /* ---------- wire routing ---------- */
  function polyline(pts) {
    // cumulative lengths for constant-speed pulse travel
    const lens = [0];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
      lens.push(lens[i - 1] + Math.hypot(dx, dy));
    }
    return { pts, total: lens[lens.length - 1], lens };
  }
  function pointAt(wire, t) {
    const d = t * wire.total;
    let i = 1;
    while (i < wire.lens.length - 1 && wire.lens[i] < d) i++;
    const segLen = wire.lens[i] - wire.lens[i - 1] || 1;
    const f = Math.min(1, Math.max(0, (d - wire.lens[i - 1]) / segLen));
    const a = wire.pts[i - 1], b = wire.pts[i];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
  function elbowPath(a, b) { // orthogonal PCB-style routing
    const midX = (a.x + b.x) / 2;
    return polyline([a, { x: midX, y: a.y }, { x: midX, y: b.y }, b]);
  }
  function buildWires() {
    wires = [];
    if (nodes.length < 2) return;
    const add = (a, b, elbow) =>
      wires.push(elbow ? elbowPath(a, b) : polyline([a, b]));
    if (cfg.style === 'hub') {
      const hub = nodes[0];
      for (let i = 1; i < nodes.length; i++) add(hub, nodes[i], true);
    } else if (cfg.style === 'chain') {
      for (let i = 1; i < nodes.length; i++) add(nodes[i - 1], nodes[i], false);
    } else { // elbow: chain with orthogonal bends
      for (let i = 1; i < nodes.length; i++) add(nodes[i - 1], nodes[i], true);
    }
    pulses = wires.map((w, i) => ({ wire: w, t: (i / wires.length) }));
  }

  /* ---------- rendering ---------- */
  function draw(now) {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const speed = 0.00012 * cfg.speed * cfg.speed;

    // wires
    ctx.lineWidth = 2;
    for (const w of wires) {
      ctx.strokeStyle = 'rgba(163,230,53,0.28)';
      ctx.beginPath();
      w.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    }
    // travelling pulses
    for (const p of pulses) {
      p.t = (p.t + speed) % 1;
      const pt = pointAt(p.wire, p.t);
      const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 9);
      g.addColorStop(0, ACCENT); g.addColorStop(1, 'rgba(163,230,53,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 9, 0, 7); ctx.fill();
    }
    // nodes: pulsing pads + pin squares
    const phase = now / 600;
    for (const n of nodes) {
      const r = 5 + Math.sin(phase + n.x * 0.01) * 2;
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(3, r), 0, 7); ctx.stroke();
      ctx.fillStyle = ACCENT;
      ctx.fillRect(n.x - Math.min(6, n.w / 2), n.y - Math.min(6, n.h / 2), 6, 6);
      ctx.fillRect(n.x + Math.min(6, n.w / 2) - 6, n.y + Math.min(6, n.h / 2) - 6, 6, 6);
    }
    raf = requestAnimationFrame(draw);
  }

  function layout() {
    if (!canvas) return;
    canvas.width = innerWidth; canvas.height = innerHeight;
    nodes = collectNodes(cfg.nodes);
    buildWires();
  }
  let throttle = 0;
  function onViewportChange() {
    const t = Date.now();
    if (t - throttle < 150) return;
    throttle = t; layout();
  }

  /* ---------- public API ---------- */
  function show(newCfg) {
    cfg = { ...cfg, ...newCfg };
    hide(true);
    canvas = document.createElement('canvas');
    canvas.id = '__circuit_toy_overlay';
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;' +
      'pointer-events:none;z-index:2147483647;';
    document.documentElement.appendChild(canvas);
    ctx = canvas.getContext('2d');
    layout();
    running = true;
    addEventListener('scroll', onViewportChange, { passive: true });
    addEventListener('resize', onViewportChange);
    raf = requestAnimationFrame(draw);
  }
  function hide(silent) {
    running = false;
    cancelAnimationFrame(raf);
    removeEventListener('scroll', onViewportChange);
    removeEventListener('resize', onViewportChange);
    const old = document.getElementById('__circuit_toy_overlay');
    if (old) old.remove();            // overlay removed entirely — page is exactly as before
    canvas = null; ctx = null;
    if (!silent) { nodes = []; wires = []; pulses = []; }
  }

  window.__circuitToy = { show, hide };
})();
