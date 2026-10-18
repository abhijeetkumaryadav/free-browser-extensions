/* FaceBlur content script — manual per-image blur/pixelate.
 * Injected on demand via chrome.scripting (activeTab). Session-only:
 * blurs are NOT persisted across reloads — everything is reversible. */
(() => {
  // Guard against double-injection on repeated "Pick images" clicks.
  if (window.__faceblurInstalled) return;
  window.__faceblurInstalled = true;

  const NS = '__faceblur';
  let pickMode = false;
  let effect = 'blur';        // 'blur' | 'pixelate'
  let intensity = 12;         // px for blur; block size divisor for pixelate
  const blurred = new Map();  // HTMLImageElement -> { overlay: HTMLCanvasElement|null, prevFilter: string }
  let hoverEl = null;

  /* ---------- styles ---------- */
  const style = document.createElement('style');
  style.textContent = `
    .${NS}-hover { outline: 3px solid #6366f1 !important; outline-offset: 2px !important; cursor: crosshair !important; }
    .${NS}-overlay { position: absolute !important; pointer-events: none !important; z-index: 2147483647 !important; }
  `;
  document.documentElement.appendChild(style);

  /* ---------- helpers ---------- */
  function isBlurred(img) { return blurred.has(img); }

  function applyBlur(img) {
    if (isBlurred(img)) return;
    const entry = { overlay: null, prevFilter: img.style.filter || '' };
    if (effect === 'blur') {
      img.style.filter = `${entry.prevFilter} blur(${intensity}px)`.trim();
    } else {
      entry.overlay = pixelateOverlay(img);
      if (!entry.overlay) return; // image not ready / failed
    }
    blurred.set(img, entry);
  }

  function removeBlur(img) {
    const entry = blurred.get(img);
    if (!entry) return;
    img.style.filter = entry.prevFilter;
    if (entry.overlay) entry.overlay.remove();
    blurred.delete(img);
  }

  function toggleBlur(img) {
    if (isBlurred(img)) removeBlur(img);
    else applyBlur(img);
  }

  function blurAll() {
    document.querySelectorAll('img').forEach(img => {
      const r = img.getBoundingClientRect();
      if (r.width > 40 && r.height > 40 && img.complete && img.naturalWidth > 0) applyBlur(img);
    });
  }

  function restoreAll() {
    [...blurred.keys()].forEach(removeBlur);
  }

  /* Pixelate: draw the image into a low-res canvas, scale back up with
   * smoothing off, and absolutely position it over the original image. */
  function pixelateOverlay(img) {
    try {
      const rect = img.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return null;
      const block = Math.max(2, Math.round(intensity / 2)); // block size in px
      const w = Math.max(4, Math.round(rect.width / block));
      const h = Math.max(4, Math.round(rect.height / block));
      const c = document.createElement('canvas');
      c.className = `${NS}-overlay`;
      c.width = rect.width; c.height = rect.height;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      // Downscale into an offscreen buffer, then upscale.
      const tiny = document.createElement('canvas');
      tiny.width = w; tiny.height = h;
      const tctx = tiny.getContext('2d');
      tctx.drawImage(img, 0, 0, w, h);
      ctx.drawImage(tiny, 0, 0, rect.width, rect.height);
      Object.assign(c.style, {
        left: (rect.left + window.scrollX) + 'px',
        top: (rect.top + window.scrollY) + 'px',
        width: rect.width + 'px',
        height: rect.height + 'px'
      });
      c.dataset[`${NS}for`] = '1';
      document.body.appendChild(c);
      // Keep the overlay glued to the image on scroll/resize.
      const sync = () => {
        const e = blurred.get(img);
        if (!e || e.overlay !== c) { window.removeEventListener('resize', sync); return; }
        const r = img.getBoundingClientRect();
        Object.assign(c.style, {
          left: (r.left + window.scrollX) + 'px',
          top: (r.top + window.scrollY) + 'px',
          width: r.width + 'px', height: r.height + 'px'
        });
      };
      window.addEventListener('resize', sync, { passive: true });
      window.addEventListener('scroll', sync, { passive: true, capture: true });
      return c;
    } catch (e) {
      return null; // tainted canvas (cross-origin) — skip gracefully
    }
  }

  /* ---------- pick mode ---------- */
  function setPickMode(on) {
    pickMode = on;
    if (!on && hoverEl) { hoverEl.classList.remove(`${NS}-hover`); hoverEl = null; }
  }

  document.addEventListener('mouseover', e => {
    if (!pickMode) return;
    const img = e.target.closest ? e.target.closest('img') : null;
    if (hoverEl && hoverEl !== img) hoverEl.classList.remove(`${NS}-hover`);
    hoverEl = img;
    if (img) img.classList.add(`${NS}-hover`);
  }, { passive: true });

  document.addEventListener('click', e => {
    if (!pickMode) return;
    const img = e.target.closest ? e.target.closest('img') : null;
    if (!img) return;
    e.preventDefault(); e.stopPropagation();
    toggleBlur(img);
  }, true);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && pickMode) {
      setPickMode(false);
      chrome.runtime.sendMessage({ type: `${NS}-pick-off` }).catch(() => {});
    }
  });

  /* ---------- messages from popup ---------- */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.cmd) {
      case 'ping': sendResponse({ ok: true }); break;
      case 'pick': setPickMode(!!msg.on); sendResponse({ pickMode }); break;
      case 'set-effect': effect = msg.effect === 'pixelate' ? 'pixelate' : 'blur'; break;
      case 'set-intensity': intensity = Math.max(2, Math.min(40, msg.value | 0 || 12)); break;
      case 'blur-all': blurAll(); sendResponse({ count: blurred.size }); break;
      case 'restore-all': restoreAll(); sendResponse({ count: 0 }); break;
      case 'status': sendResponse({ pickMode, count: blurred.size }); break;
    }
    return true;
  });
})();
