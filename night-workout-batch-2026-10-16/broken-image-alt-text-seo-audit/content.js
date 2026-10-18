/* ImgAudit content script — read-only audit of <img> elements.
   Injected on demand via chrome.scripting; never modifies the page. */
'use strict';

if (!window.__imgauditInstalled) {
  window.__imgauditInstalled = true;

  const HEAVY_PX = 1920 * 1080; // flag images with >2MP natural resolution

  function shortSrc(img) {
    const src = img.currentSrc || img.src || '';
    try {
      const u = new URL(src, location.href);
      return u.pathname.split('/').pop().slice(0, 80) || u.hostname;
    } catch { return src.slice(0, 80); }
  }

  function audit() {
    const imgs = Array.from(document.querySelectorAll('img'));
    const findings = [];

    imgs.forEach((img, i) => {
      const label = 'Image #' + (i + 1) + ' (' + shortSrc(img) + ')';
      const broken = img.complete && img.naturalWidth === 0 && img.src;
      const hasAlt = img.hasAttribute('alt');
      const alt = (img.getAttribute('alt') || '').trim();
      const role = (img.getAttribute('role') || '').toLowerCase();

      if (broken) {
        findings.push({
          sev: 'error', type: 'broken',
          msg: 'Broken image — failed to load',
          detail: label,
          fix: 'Fix the src URL or remove the <img> tag.',
        });
        return; // alt checks are meaningless on a broken image
      }

      if (!hasAlt) {
        findings.push({
          sev: role === 'presentation' || role === 'none' ? 'warning' : 'error',
          type: 'alt',
          msg: 'Missing alt attribute',
          detail: label,
          fix: 'Add descriptive alt text, or alt="" if purely decorative.',
        });
      } else if (alt === '') {
        findings.push({
          sev: 'warning', type: 'alt',
          msg: 'Empty alt text (decorative?)',
          detail: label,
          fix: 'Confirm the image is decorative; otherwise describe it.',
        });
      } else {
        if (alt.length > 125) {
          findings.push({
            sev: 'warning', type: 'alt',
            msg: 'Alt text very long (' + alt.length + ' chars)',
            detail: label + ' — "' + alt.slice(0, 90) + '…"',
            fix: 'Keep alt under ~125 characters.',
          });
        }
        if (/^(image|photo|picture|img|dsc|whatsapp image)/i.test(alt)) {
          findings.push({
            sev: 'warning', type: 'alt',
            msg: 'Non-descriptive alt text',
            detail: label + ' — "' + alt.slice(0, 60) + '"',
            fix: 'Describe what the image shows instead of its file type.',
          });
        }
      }

      const px = (img.naturalWidth || 0) * (img.naturalHeight || 0);
      if (px > HEAVY_PX) {
        findings.push({
          sev: 'warning', type: 'heavy',
          msg: 'Oversized image (' + img.naturalWidth + '×' + img.naturalHeight + 'px)',
          detail: label,
          fix: 'Serve a responsive/scaled version; consider modern formats (WebP/AVIF).',
        });
      }
      if (!img.hasAttribute('width') && !img.hasAttribute('height') && !img.style.aspectRatio) {
        findings.push({
          sev: 'warning', type: 'heavy',
          msg: 'No width/height attributes (layout-shift risk)',
          detail: label,
          fix: 'Add width/height or aspect-ratio to reserve space.',
        });
      }
    });

    // error findings first, then warnings
    findings.sort((a, b) => (a.sev === b.sev ? 0 : a.sev === 'error' ? -1 : 1));
    return { total: imgs.length, findings };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'audit') {
      try { sendResponse({ ok: true, ...audit() }); }
      catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
      return true;
    }
    return false;
  });
}
