// ---------------------------------------------------------------------------
// content.js — read-only on-page data extraction.
// Runs only on explicit user click. Never modifies the DOM.
// ---------------------------------------------------------------------------
(() => {
  /** Collect visible text from an element, trimmed. */
  function textOf(el) {
    return (el ? el.innerText : '').replace(/\s+/g, ' ').trim();
  }

  // Main text: prefer <article>/<main>, else cleaned body.
  const root =
    document.querySelector('article') ||
    document.querySelector('main') ||
    document.body;

  const bodyText = textOf(root);
  const words = bodyText ? bodyText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  // Long-word ratio (8+ letters) as a readability proxy.
  const longWords = words.filter((w) => w.replace(/[^a-zA-Z]/g, '').length >= 8).length;
  const longWordRatio = wordCount ? longWords / wordCount : 0;

  const meta = document.querySelector('meta[name="description"]');

  const h1s = Array.from(document.querySelectorAll('h1'))
    .map(textOf)
    .filter(Boolean)
    .slice(0, 5);
  const subHeads = Array.from(document.querySelectorAll('h2, h3'))
    .map(textOf)
    .filter(Boolean)
    .slice(0, 30);

  const imgs = Array.from(document.images);
  const imagesWithAlt = imgs.filter((i) => (i.alt || '').trim().length > 0).length;

  return {
    url: location.href,
    title: document.title || '',
    metaDescription: (meta && meta.content) || '',
    h1s,
    subHeads,
    wordCount,
    // Sample keeps the message small; keyword density is sampled too.
    bodyTextSample: bodyText.slice(0, 20000),
    longWordRatio,
    imagesTotal: imgs.length,
    imagesWithAlt,
  };
})();
