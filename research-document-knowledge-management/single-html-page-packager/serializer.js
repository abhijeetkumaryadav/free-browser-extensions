/* PagePack serializer — runs in the page MAIN world so it can fetch
   same-origin resources. Returns { html, warnings[] }. */
(async () => {
  'use strict';

  const MAX_IMG_BYTES = 3 * 1024 * 1024; // per-image inline cap
  const warnings = [];

  const includeImages = document.documentElement.getAttribute('data-pp-images') === '1';

  // Work on a deep clone so the live page is untouched.
  const clone = document.documentElement.cloneNode(true);
  const baseHref = location.href;

  // Ensure relative URLs resolve when the file is opened later.
  const head = clone.querySelector('head');
  if (head) {
    const base = document.createElement('base');
    base.setAttribute('href', baseHref);
    head.insertBefore(base, head.firstChild);
  }

  // Remove anything executable or interactive-state dependent.
  clone.querySelectorAll('script, noscript').forEach((el) => el.remove());
  clone.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    }
  });

  // Inline same-origin stylesheets (cross-origin <link> stays as-is).
  const links = Array.from(clone.querySelectorAll('link[rel="stylesheet"]'));
  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href) continue;
    try {
      const abs = new URL(href, baseHref).href;
      if (new URL(abs).origin !== location.origin) continue; // CORS would block
      const res = await fetch(abs, { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const css = await res.text();
      const style = document.createElement('style');
      style.textContent = '/* inlined from ' + abs + ' */\n' + css;
      link.replaceWith(style);
    } catch (e) {
      warnings.push('Stylesheet not inlined (left as link): ' + href);
    }
  }

  // Inline images as data URIs (best-effort).
  if (includeImages) {
    const imgs = Array.from(clone.querySelectorAll('img[src]'));
    let inlined = 0, skipped = 0;
    for (const img of imgs) {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) continue;
      try {
        const abs = new URL(src, baseHref).href;
        if (!/^https?:/.test(abs)) { skipped++; continue; }
        const res = await fetch(abs, { credentials: 'omit' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const blob = await res.blob();
        if (blob.size > MAX_IMG_BYTES) { skipped++; continue; }
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(blob);
        });
        img.setAttribute('src', dataUrl);
        img.removeAttribute('srcset');
        inlined++;
      } catch (e) {
        skipped++; // cross-origin/CORS-blocked images keep their URL
      }
    }
    if (skipped > 0) {
      warnings.push(skipped + ' image(s) could not be inlined and keep remote URLs.');
    }
  }

  // Serialize with doctype.
  const html =
    '<!DOCTYPE html>\n' + new XMLSerializer().serializeToString(clone);

  return { html, warnings };
})();
