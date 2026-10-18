/* Zen Mode Page Cleaner — content script (isolated world, injected on demand).
 * Enable: saves the page's original HTML, extracts the article content,
 * and swaps in a clean reader view. Disable: restores the original HTML
 * byte-for-byte. Fully reversible; the page is never modified otherwise. */

(() => {
  'use strict';

  let originalHTML = null;   // saved documentElement.innerHTML while zen is on
  let active = false;

  const REMOVE_SELECTORS = [
    'script', 'style', 'nav', 'header', 'footer', 'aside', 'form',
    'button', 'input', 'select', 'textarea', 'iframe', 'canvas',
    'video', 'audio', 'noscript', 'object', 'embed',
    '[aria-hidden="true"]',
    '[class*="ad-"]', '[class*="-ad"]', '[id*="ad-"]', '[id*="-ad"]',
    '.advertisement', '.share-buttons', '.social-share', '.comments',
    '#comments', '.comment-section', '.popup', '.modal', '.overlay',
    '.newsletter', '.subscribe', '.related-posts',
  ].join(',');

  const KEEP_TAGS = new Set([
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'img', 'figure', 'figcaption', 'blockquote',
    'ul', 'ol', 'li', 'pre', 'code',
    'a', 'strong', 'em', 'b', 'i', 'u',
    'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ]);

  const KEEP_ATTRS = { a: ['href'], img: ['src', 'alt'] };

  function metaContent(selector, attr = 'content') {
    const el = document.querySelector(selector);
    return el ? (el.getAttribute(attr) || '').trim() : '';
  }

  /** Pick the element most likely to hold the article body. */
  function findArticleRoot() {
    const direct =
      document.querySelector('article') ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]');
    if (direct && direct.innerText.trim().length > 300) return direct;

    // Fallback: score containers by paragraph text volume.
    let best = null;
    let bestScore = 0;
    const candidates = document.querySelectorAll('div, section');
    for (const el of candidates) {
      if (el.closest('nav, header, footer, aside, form')) continue;
      const ps = el.querySelectorAll('p');
      if (ps.length < 2) continue;
      let score = 0;
      for (const p of ps) score += p.innerText.trim().length;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
      if (bestScore > 20000) break; // good enough; stop scanning
    }
    return bestScore > 400 ? best : document.body;
  }

  /** Strip junk, unwrap non-text tags, keep only safe attributes. */
  function sanitize(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll(REMOVE_SELECTORS).forEach((el) => el.remove());

    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const el of nodes) {
      if (!el.isConnected) continue;
      const tag = el.tagName.toLowerCase();
      if (!KEEP_TAGS.has(tag)) {
        // Unwrap: keep children, drop the wrapper.
        const parent = el.parentNode;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        continue;
      }
      // Keep only whitelisted attributes; absolutize links/images.
      const allowed = KEEP_ATTRS[tag] || [];
      for (const attr of [...el.attributes]) {
        if (!allowed.includes(attr.name)) {
          el.removeAttribute(attr.name);
        } else if (attr.name === 'href' || attr.name === 'src') {
          try {
            el.setAttribute(attr.name, new URL(attr.value, location.href).href);
          } catch (_) {
            el.removeAttribute(attr.name);
          }
        }
      }
      if (tag === 'a' && !el.getAttribute('href')) {
        // Bare anchors become plain text wrappers.
        const parent = el.parentNode;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
    }
    return clone;
  }

  function readingMinutes(text) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  const THEMES = {
    light: { bg: '#faf9f7', fg: '#1c1c1e', muted: '#8a8a90', border: '#e6e2da', accent: '#0d9488' },
    sepia: { bg: '#f4ecd8', fg: '#433422', muted: '#9a8a6a', border: '#e0d3b3', accent: '#0d9488' },
    dark:  { bg: '#141417', fg: '#e9e9ec', muted: '#8b8b93', border: '#2a2a30', accent: '#2dd4bf' },
  };

  /** Returns { head, body } fragments for the reader view. */
  function buildReader(settings, articleEl, meta) {
    const t = THEMES[settings.theme] || THEMES.sepia;
    const text = articleEl.innerText || '';
    const minutes = readingMinutes(text);
    const byline = meta.author ? `<span>${escapeHtml(meta.author)}</span><span class="zen-dot">·</span>` : '';

    const head = `
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(meta.title)}</title>
<style>
  :root {
    --zen-bg: ${t.bg}; --zen-fg: ${t.fg}; --zen-muted: ${t.muted};
    --zen-border: ${t.border}; --zen-accent: ${t.accent};
    --zen-size: ${settings.fontSize}px; --zen-width: ${settings.width}px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--zen-bg); color: var(--zen-fg);
    font-family: Georgia, 'Times New Roman', serif;
    font-size: var(--zen-size); line-height: 1.75;
    -webkit-font-smoothing: antialiased;
  }
  .zen-wrap { max-width: var(--zen-width); margin: 0 auto; padding: 56px 24px 80px; }
  .zen-kicker { font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 12px;
    letter-spacing: 1.5px; text-transform: uppercase; color: var(--zen-accent); margin-bottom: 14px; }
  .zen-title { font-size: calc(var(--zen-size) * 1.9); line-height: 1.25; margin: 0 0 12px; font-weight: 700; }
  .zen-meta { font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 13px;
    color: var(--zen-muted); margin-bottom: 28px; }
  .zen-dot { margin: 0 8px; }
  .zen-rule { border: none; border-top: 1px solid var(--zen-border); margin: 0 0 28px; }
  .zen-article img { max-width: 100%; height: auto; border-radius: 8px; margin: 20px 0; }
  .zen-article figure { margin: 20px 0; }
  .zen-article figcaption { font-size: 0.82em; color: var(--zen-muted); text-align: center; }
  .zen-article h1, .zen-article h2, .zen-article h3 { line-height: 1.35; margin: 1.6em 0 0.6em; }
  .zen-article p { margin: 0 0 1.2em; }
  .zen-article a { color: var(--zen-accent); }
  .zen-article blockquote { border-left: 3px solid var(--zen-accent); margin: 1.4em 0;
    padding: 4px 0 4px 18px; color: var(--zen-muted); font-style: italic; }
  .zen-article pre { background: rgba(127,127,127,.12); padding: 14px 16px; border-radius: 8px;
    overflow-x: auto; font-size: 0.85em; line-height: 1.6; }
  .zen-article code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.88em; }
  .zen-article ul, .zen-article ol { margin: 0 0 1.2em; padding-left: 1.4em; }
  .zen-article li { margin-bottom: 0.4em; }
  .zen-foot { margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--zen-border);
    font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 12px; color: var(--zen-muted);
    display: flex; justify-content: space-between; }
</style>`;

    const body = `
  <div class="zen-wrap">
    <div class="zen-kicker">${escapeHtml(meta.site)}</div>
    <h1 class="zen-title">${escapeHtml(meta.title)}</h1>
    <div class="zen-meta">${byline}<span>${minutes} min read</span></div>
    <hr class="zen-rule">
    <div class="zen-article">${articleEl.innerHTML}</div>
    <div class="zen-foot"><span>Zen Mode · distraction-free reading</span><span>${escapeHtml(meta.site)}</span></div>
  </div>`;

    return { head, body };
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function enable(settings) {
    if (!active) {
      originalHTML = document.documentElement.innerHTML;
      active = true;
    }
    const meta = {
      title: metaContent('meta[property="og:title"]') || document.title || 'Untitled',
      author: metaContent('meta[name="author"]') || metaContent('meta[property="article:author"]'),
      site: metaContent('meta[property="og:site_name"]') || location.hostname.replace(/^www\./, ''),
    };
    const clean = sanitize(findArticleRoot());
    const reader = buildReader(settings, clean, meta);
    document.head.innerHTML = reader.head;
    document.body.innerHTML = reader.body;
    document.documentElement.setAttribute('lang', 'en');
    window.scrollTo(0, 0);
    return { ok: true, active: true };
  }

  function update(settings) {
    if (!active) return { ok: true, active: false };
    const root = document.documentElement;
    const t = THEMES[settings.theme] || THEMES.sepia;
    root.style.setProperty('--zen-bg', t.bg);
    root.style.setProperty('--zen-fg', t.fg);
    root.style.setProperty('--zen-muted', t.muted);
    root.style.setProperty('--zen-border', t.border);
    root.style.setProperty('--zen-accent', t.accent);
    root.style.setProperty('--zen-size', settings.fontSize + 'px');
    root.style.setProperty('--zen-width', settings.width + 'px');
    return { ok: true, active: true };
  }

  function disable() {
    if (active && originalHTML !== null) {
      document.documentElement.innerHTML = originalHTML;
    }
    originalHTML = null;
    active = false;
    return { ok: true, active: false };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (msg.type === 'enable') sendResponse(enable(msg.settings));
      else if (msg.type === 'update') sendResponse(update(msg.settings));
      else if (msg.type === 'disable') sendResponse(disable());
      else if (msg.type === 'getState') sendResponse({ ok: true, active });
      else sendResponse({ ok: false, error: 'Unknown message type.' });
    } catch (err) {
      sendResponse({ ok: false, error: err && err.message ? err.message : String(err) });
    }
    return false; // all responses are synchronous
  });
})();
