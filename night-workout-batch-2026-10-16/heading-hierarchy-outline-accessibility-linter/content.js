/* Outline Linter content script — on-demand heading analysis; read-only. */

/**
 * Collect headings in DOM order with accessible text.
 * Runs in page context; returns { headings: [{level, text, path, index}] }.
 */
function analyzeHeadings() {
  const cssPath = (el) => {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let seg = node.tagName.toLowerCase();
      if (node.id) { seg += '#' + node.id; parts.unshift(seg); break; }
      const parent = node.parentElement;
      if (parent) {
        const sibs = [...parent.children].filter(c => c.tagName === node.tagName);
        if (sibs.length > 1) seg += `:nth-of-type(${sibs.indexOf(node) + 1})`;
      }
      parts.unshift(seg);
      node = node.parentElement;
    }
    return parts.join(' > ');
  };

  const nodes = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const headings = nodes.map((el, i) => {
    // Accessible name: innerText first, then aria-label, then img alt inside.
    let text = (el.innerText || '').trim().replace(/\s+/g, ' ');
    if (!text) {
      const img = el.querySelector('img[alt]');
      text = (el.getAttribute('aria-label') || (img ? img.getAttribute('alt') : '') || '').trim();
    }
    return { index: i, level: parseInt(el.tagName[1], 10), text: text.slice(0, 120), path: cssPath(el) };
  });

  // Lint rules (structural only).
  const issues = [];
  const h1s = headings.filter(h => h.level === 1);
  if (h1s.length > 1) {
    issues.push({
      severity: 'warn', kind: 'multiple-h1',
      title: `Multiple H1 headings (${h1s.length})`,
      fix: 'Best practice is one H1 per page describing the page topic. Demote extras to H2 unless the page genuinely contains multiple top-level sections (e.g. some CMS templates).',
      targets: h1s.map(h => h.index),
    });
  }
  headings.forEach((h, i) => {
    if (!h.text) {
      issues.push({
        severity: 'error', kind: 'empty-heading',
        title: `Empty H${h.level} (heading #${i + 1})`,
        fix: 'Empty headings confuse screen-reader navigation — add descriptive text, or remove the element if it is decorative (and hide it from assistive tech with aria-hidden="true").',
        targets: [h.index],
      });
    }
    if (i > 0) {
      const prev = headings[i - 1];
      if (h.level > prev.level + 1) {
        issues.push({
          severity: 'error', kind: 'skipped-level',
          title: `Skipped level: H${prev.level} → H${h.level} (heading #${i + 1})`,
          fix: `Don't skip levels — an H${h.level} directly under an H${prev.level} breaks the document outline. Use H${prev.level + 1} here instead.`,
          targets: [h.index],
        });
      }
    }
  });
  if (headings.length && headings[0].level !== 1) {
    issues.push({
      severity: 'warn', kind: 'first-not-h1',
      title: `First heading is H${headings[0].level}, not H1`,
      fix: 'The first heading on the page should normally be the H1 page title. Check whether the real title is missing or styled with a non-heading element.',
      targets: [headings[0].index],
    });
  }
  return { headings, issues };
}

/** Scroll to a heading by index and flash it. */
function revealHeading(index) {
  const els = document.querySelectorAll('h1,h2,h3,h4,h5,h6');
  const el = els[index];
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.style.outline = '3px solid #a78bfa';
  el.style.outlineOffset = '2px';
  setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 2200);
  return true;
}
