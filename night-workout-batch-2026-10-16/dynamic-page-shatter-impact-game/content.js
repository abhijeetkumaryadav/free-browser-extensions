/* ShatterPlay shatter engine (content script).
 * Slices a screenshot of the visible page into triangular shards that fall
 * with gravity. Clicking a shard mid-air removes it (+10 pts). The page
 * itself is never modified — everything happens on a canvas overlay.
 * Injected on demand via chrome.scripting; never runs uninvited. */
'use strict';

(() => {
  if (window.__shatterPlayInstalled) return;
  window.__shatterPlayInstalled = true;

  // ---------- state ----------
  let overlay = null;      // root overlay div
  let canvas = null;
  let ctx = null;
  let raf = 0;
  let tris = [];           // shard triangles
  let sparks = [];         // click-burst particles
  let hud = null;
  let score = 0;
  let running = false;
  let cssW = 0, cssH = 0, dpr = 1;
  let frame = 0;

  const GRAVITY = 0.55;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- messaging ----------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'PING') { sendResponse({ pong: true }); return undefined; }
    if (msg.type === 'GET_STATE') { sendResponse({ active: running, score }); return undefined; }
    if (msg.type === 'RESTORE') { restore(); sendResponse({ ok: true }); return undefined; }
    if (msg.type === 'SHATTER') {
      startShatter(msg.image)
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
      return true; // async response
    }
    return undefined;
  });

  // ---------- public actions ----------
  function restore() {
    running = false;
    cancelAnimationFrame(raf);
    if (overlay) { overlay.remove(); overlay = null; canvas = null; ctx = null; hud = null; }
    tris = [];
    sparks = [];
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
  }

  function onKey(e) { if (e.key === 'Escape') restore(); }
  function onResize() { if (running) restore(); } // screenshot no longer matches

  /** Begin the shatter: build overlay from the screenshot data URL. */
  function startShatter(dataUrl) {
    return new Promise((resolve, reject) => {
      if (running) { resolve(); return; }
      const img = new Image();
      img.onload = () => {
        try {
          buildOverlay(img);
          resolve();
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error('image-decode'));
      img.src = dataUrl;
    });
  }

  // ---------- overlay construction ----------
  function buildOverlay(img) {
    restore();
    score = 0;
    frame = 0;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = window.innerWidth;
    cssH = window.innerHeight;

    overlay = document.createElement('div');
    overlay.id = '__shatterplay-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '2147483647',
      cursor: 'crosshair', margin: '0', padding: '0',
    });

    canvas = document.createElement('canvas');
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    Object.assign(canvas.style, { width: cssW + 'px', height: cssH + 'px', display: 'block' });
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    hud = document.createElement('div');
    Object.assign(hud.style, {
      position: 'absolute', top: '14px', right: '16px',
      background: 'rgba(20,20,26,.72)', backdropFilter: 'blur(12px)',
      color: '#fff', font: '700 15px -apple-system,"Segoe UI",Roboto,sans-serif',
      padding: '8px 14px', borderRadius: '12px',
      border: '1px solid rgba(255,255,255,.12)', pointerEvents: 'none',
    });
    updateHud();

    overlay.appendChild(canvas);
    overlay.appendChild(hud);
    // Shadow-DOM-free on purpose: the canvas must paint the page pixels.
    document.documentElement.appendChild(overlay);

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);

    triangulate(img);
    running = true;
    raf = requestAnimationFrame(tick);
  }

  function updateHud() {
    if (hud) hud.textContent = 'Score ' + score + ' — click shards!';
  }

  /** Split the screenshot into triangles and pre-render each as a sprite. */
  function triangulate(img) {
    tris = [];
    const cols = Math.max(12, Math.min(28, Math.round(cssW / 56)));
    const rows = Math.max(8, Math.min(20, Math.round(cssH / 56)));
    const cw = cssW / cols, ch = cssH / rows;
    const ix = cssW / 2, iy = cssH * 0.38; // impact point

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = c * cw, y0 = r * ch, x1 = x0 + cw, y1 = y0 + ch;
        addShard(img, [[x0, y0], [x1, y0], [x0, y1]], ix, iy);
        addShard(img, [[x1, y0], [x1, y1], [x0, y1]], ix, iy);
      }
    }
  }

  /** Create one shard triangle from original-space vertices. */
  function addShard(img, verts, ix, iy) {
    const cx0 = (verts[0][0] + verts[1][0] + verts[2][0]) / 3;
    const cy0 = (verts[0][1] + verts[1][1] + verts[2][1]) / 3;

    // Pre-render the shard's image patch into an offscreen sprite.
    const minX = Math.min(verts[0][0], verts[1][0], verts[2][0]);
    const minY = Math.min(verts[0][1], verts[1][1], verts[2][1]);
    const maxX = Math.max(verts[0][0], verts[1][0], verts[2][0]);
    const maxY = Math.max(verts[0][1], verts[1][1], verts[2][1]);
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    const sprite = document.createElement('canvas');
    sprite.width = Math.ceil(bw * dpr);
    sprite.height = Math.ceil(bh * dpr);
    const sctx = sprite.getContext('2d');
    sctx.scale(dpr, dpr);
    sctx.beginPath();
    sctx.moveTo(verts[0][0] - minX, verts[0][1] - minY);
    sctx.lineTo(verts[1][0] - minX, verts[1][1] - minY);
    sctx.lineTo(verts[2][0] - minX, verts[2][1] - minY);
    sctx.closePath();
    sctx.clip();
    sctx.drawImage(img, -minX, -minY, cssW, cssH);

    // Physics: velocity radiates from the impact point.
    const dx = cx0 - ix, dy = cy0 - iy;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.7;
    const speed = Math.max(2, Math.min(12, 11 - dist / 130)) * (0.6 + Math.random() * 0.8);

    tris.push({
      verts, cx0, cy0, sprite, minX, minY, bw, bh,
      cx: cx0, cy: cy0,
      vx: reducedMotion ? (Math.random() - 0.5) * 0.6 : Math.cos(ang) * speed,
      vy: reducedMotion ? (Math.random() - 0.5) * 0.6 : Math.sin(ang) * speed * 0.7 - 4,
      rot: 0,
      vr: reducedMotion ? 0 : (Math.random() - 0.5) * 0.3,
      alpha: 1,
      age: 0,
    });
  }

  // ---------- game loop ----------
  function tick() {
    if (!running) return;
    frame++;
    ctx.clearRect(0, 0, cssW, cssH);

    // Shards.
    for (let i = tris.length - 1; i >= 0; i--) {
      const t = tris[i];
      t.age++;
      t.vy += GRAVITY * (reducedMotion ? 0.15 : 1);
      t.cx += t.vx;
      t.cy += t.vy;
      t.rot += t.vr;
      if (t.cy - t.bh > cssH + 120) t.alpha -= 0.1;       // fell off-screen
      else if (t.age > 420) t.alpha -= 0.02;              // timed fade
      if (t.alpha <= 0) { tris.splice(i, 1); continue; }

      ctx.save();
      ctx.globalAlpha = Math.max(0, t.alpha);
      ctx.translate(t.cx, t.cy);
      ctx.rotate(t.rot);
      ctx.drawImage(t.sprite, t.minX - t.cx0, t.minY - t.cy0, t.bw, t.bh);
      ctx.restore();
    }

    // Spark particles.
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life--;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = '#ffb08a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (tris.length === 0 && sparks.length === 0) { finish(); return; }
    raf = requestAnimationFrame(tick);
  }

  /** All shards cleared — save best score and fade the overlay out. */
  async function finish() {
    running = false;
    cancelAnimationFrame(raf);
    try {
      const { best = 0 } = await chrome.storage.local.get('best');
      if (score > best) await chrome.storage.local.set({ best: score });
    } catch (_) { /* storage unavailable — non-fatal */ }
    if (hud) hud.textContent = 'Cleared! Score ' + score;
    if (overlay) {
      overlay.style.transition = 'opacity .6s ease';
      overlay.style.opacity = '0';
      setTimeout(restore, 650);
    } else restore();
  }

  // ---------- input ----------
  function onPointerDown(e) {
    if (!running) return;
    const px = e.clientX, py = e.clientY;
    // Hit-test topmost shard first.
    for (let i = tris.length - 1; i >= 0; i--) {
      const t = tris[i];
      // Inverse-transform the click into the shard's original space.
      const dx = px - t.cx, dy = py - t.cy;
      const cos = Math.cos(-t.rot), sin = Math.sin(-t.rot);
      const lx = dx * cos - dy * sin + t.cx0;
      const ly = dx * sin + dy * cos + t.cy0;
      if (pointInTriangle(lx, ly, t.verts)) {
        tris.splice(i, 1);
        score += 10;
        burst(px, py);
        updateHud();
        break;
      }
    }
  }

  function burst(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 4;
      sparks.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
        r: 1.5 + Math.random() * 2.5,
        life: 22 + Math.random() * 14, maxLife: 36,
      });
    }
  }

  function pointInTriangle(px, py, v) {
    const [ax, ay] = v[0], [bx, by] = v[1], [cx, cy] = v[2];
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (d === 0) return false;
    const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d;
    const l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d;
    const l3 = 1 - l1 - l2;
    return l1 >= 0 && l2 >= 0 && l3 >= 0;
  }
})();
