// Click Heatmap — heatmap overlay injector
// Self-contained function passed to chrome.scripting.executeScript.
// Draws a density heatmap of the user's OWN recorded clicks as blurred
// radial-gradient blobs over the page. Visual only: adds one absolutely-
// positioned overlay div + a "Hide" button; everything removable.
(function () {
  'use strict';

  const STORAGE_KEY = 'clickheatmap_clicks_v1';
  const PAGE = location.href.split('#')[0];
  const doc = document.documentElement;

  // Remove any previous overlay (idempotent).
  const old = document.getElementById('__click_heatmap_overlay__');
  if (old) old.remove();
  const oldBtn = document.getElementById('__click_heatmap_hide__');
  if (oldBtn) oldBtn.remove();

  const overlay = document.createElement('div');
  overlay.id = '__click_heatmap_overlay__';
  overlay.style.cssText = [
    'position:absolute', 'top:0', 'left:0',
    `width:${doc.scrollWidth}px`, `height:${doc.scrollHeight}px`,
    'pointer-events:none', 'z-index:2147483646', 'mix-blend-mode:screen'
  ].join(';');

  const hideBtn = document.createElement('button');
  hideBtn.id = '__click_heatmap_hide__';
  hideBtn.textContent = 'Hide heatmap (your own clicks only)';
  hideBtn.style.cssText = [
    'position:fixed', 'top:12px', 'right:12px', 'z-index:2147483647',
    'background:#0ea5e9', 'color:#04121a', 'border:none',
    'border-radius:8px', 'padding:8px 12px', 'font-size:13px',
    'font-weight:700', 'cursor:pointer'
  ].join(';');
  hideBtn.addEventListener('click', () => { overlay.remove(); hideBtn.remove(); });

  // Scale stored coordinates (recorded against the old scroll size).
  function scaleClicks(clicks) {
    const sx = doc.scrollWidth / 1;
    return clicks.map(c => ({
      x: (c.x / (c.w || doc.scrollWidth)) * doc.scrollWidth,
      y: (c.y / (c.h || doc.scrollHeight)) * doc.scrollHeight
    }));
  }

  function draw(clicks) {
    const radius = 42; // px — soft blob per click
    clicks.forEach(c => {
      const dot = document.createElement('div');
      dot.style.cssText = [
        'position:absolute',
        `left:${c.x - radius}px`, `top:${c.y - radius}px`,
        `width:${radius * 2}px`, `height:${radius * 2}px`,
        'border-radius:50%',
        'background:radial-gradient(circle, rgba(14,165,233,0.55) 0%, rgba(14,165,233,0.18) 55%, transparent 72%)',
        'pointer-events:none'
      ].join(';');
      overlay.appendChild(dot);
    });
  }

  chrome.storage.local.get(STORAGE_KEY).then(data => {
    const all = data[STORAGE_KEY] || {};
    const clicks = all[PAGE] || [];
    if (!clicks.length) {
      hideBtn.textContent = 'No recorded clicks on this page yet';
      setTimeout(() => hideBtn.remove(), 2500);
      return;
    }
    draw(scaleClicks(clicks));
    document.body.appendChild(overlay);
    document.body.appendChild(hideBtn);
  });
})();
