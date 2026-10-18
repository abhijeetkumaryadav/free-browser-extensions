/**
 * content.js — Article text extraction for ReadingLens.
 *
 * Strategy: pick the most article-like container using a density heuristic
 * (long text, paragraph-heavy elements preferred), strip boilerplate
 * selectors, and return the plain text plus the page title.
 * Runs only when the user clicks "Analyze this page".
 */

(function () {
  'use strict';

  // Selectors that are almost never article body copy.
  const BOILERPLATE = 'nav, header, footer, aside, .nav, .navbar, .header, .footer, ' +
    '.sidebar, .ad, .ads, .advertisement, .comments, .comment, script, style, ' +
    'noscript, form, button, input, select, textarea, .cookie, .banner';

  function cleanClone(root) {
    const el = root.cloneNode(true);
    el.querySelectorAll(BOILERPLATE).forEach(n => n.remove());
    return el;
  }

  function textDensity(el) {
    const text = (el.innerText || '').trim();
    const paras = el.querySelectorAll('p').length;
    return { text, score: text.length + paras * 400 };
  }

  function findArticle() {
    const candidates = [];
    // Semantic article containers first.
    document.querySelectorAll('article, [role="main"], main').forEach(el => {
      const c = cleanClone(el);
      const d = textDensity(c);
      if (d.text.length > 400) candidates.push({ ...d, el });
    });
    // Fall back to the densest generic container.
    if (!candidates.length) {
      document.querySelectorAll('div, section').forEach(el => {
        if (el.querySelector('div, section, article')) return; // leaf-ish only
        const c = cleanClone(el);
        const d = textDensity(c);
        if (d.text.length > 600) candidates.push({ ...d, el });
      });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  }

  const best = findArticle();
  if (!best) {
    return { ok: false, reason: 'No substantial article text found on this page.' };
  }
  // Normalize whitespace.
  const text = best.text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return {
    ok: true,
    title: document.title || '(untitled page)',
    text: text.slice(0, 100000) // safety cap; analysis degrades gracefully above it
  };
})();
