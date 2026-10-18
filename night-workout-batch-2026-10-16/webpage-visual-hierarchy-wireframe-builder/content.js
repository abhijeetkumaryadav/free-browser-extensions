'use strict';
/* Wireframe engine — runs in the page via chrome.scripting.
   Toggles an absolutely-positioned overlay of labeled boxes for visible
   block elements. Page DOM is never modified; removing the overlay restores
   the page exactly. Returns { active, count } as the completion value. */
(() => {
  const OVERLAY_ID = '__wf_overlay_root';

  // Toggle off: overlay already present → remove and report.
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    existing.remove();
    return { active: false, count: 0 };
  }

  const opts = window.__wfOpts || { labels: true, text: true, max: 300 };

  // Element groups → overlay color (rgba prefix, alpha appended).
  const GROUPS = {
    struct: ['HEADER', 'NAV', 'MAIN', 'SECTION', 'ARTICLE', 'ASIDE', 'FOOTER', 'FORM', 'DIV'],
    head:   ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
    media:  ['IMG', 'VIDEO', 'PICTURE', 'SVG', 'CANVAS', 'FIGURE'],
    ctrl:   ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'],
    text:   ['P', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE'],
  };
  const COLORS = {
    struct: 'rgba(167,139,250,',  // violet — layout
    head:   'rgba(245,158,11,',   // amber — headings
    media:  'rgba(52,211,153,',   // emerald — media
    ctrl:   'rgba(96,165,250,',   // blue — controls
    text:   'rgba(167,139,250,',  // violet — text blocks
  };
  const groupOf = (tag) => {
    for (const g of Object.keys(GROUPS)) if (GROUPS[g].includes(tag)) return g;
    return null;
  };

  // Collect visible candidate elements in the viewport.
  const cands = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    const tag = node.tagName;
    const grp = groupOf(tag);
    if (grp && (grp !== 'text' || opts.text)) {
      const r = node.getBoundingClientRect();
      if (r.width >= 24 && r.height >= 12 && r.bottom > 0 && r.top < window.innerHeight) {
        cands.push({ tag, grp, rect: r, area: r.width * r.height });
      }
    }
    node = walker.nextNode();
  }

  // Largest first, capped — keeps the overlay readable and fast.
  cands.sort((a, b) => b.area - a.area);
  const picked = cands.slice(0, Math.max(10, Math.min(2000, opts.max || 300)));

  // Build the overlay (positioned in document coordinates).
  const sx = window.scrollX, sy = window.scrollY;
  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2147483647;';
  for (const { tag, grp, rect } of picked) {
    const c = COLORS[grp];
    const box = document.createElement('div');
    box.style.cssText =
      `position:absolute;left:${rect.left + sx}px;top:${rect.top + sy}px;` +
      `width:${rect.width}px;height:${rect.height}px;` +
      `border:1.5px solid ${c}0.8);background:${c}0.07);border-radius:2px;box-sizing:border-box;`;
    if (opts.labels) {
      const lab = document.createElement('div');
      lab.textContent = `${tag.toLowerCase()} ${Math.round(rect.width)}×${Math.round(rect.height)}`;
      lab.style.cssText =
        `position:absolute;top:0;left:0;font:9px/1.4 monospace;white-space:nowrap;` +
        `color:#fff;background:${c}0.9);padding:1px 4px;border-radius:0 0 3px 0;`;
      box.appendChild(lab);
    }
    root.appendChild(box);
  }
  document.body.appendChild(root);
  return { active: true, count: picked.length };
})();
