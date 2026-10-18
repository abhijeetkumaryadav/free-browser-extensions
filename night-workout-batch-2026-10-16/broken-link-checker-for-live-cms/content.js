/* LinkSentry content script — collects links on demand; also used for "reveal". */

/** Collect unique http(s) links on the page with context. Runs in page context. */
function collectLinks() {
  const cssPath = (el) => {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let seg = node.tagName.toLowerCase();
      if (node.id) { seg += '#' + node.id; parts.unshift(seg); break; }
      const sibs = [...node.parentElement.children].filter(c => c.tagName === node.tagName);
      if (sibs.length > 1) seg += `:nth(${sibs.indexOf(node) + 1})`;
      parts.unshift(seg);
      node = node.parentElement;
    }
    return parts.join(' > ');
  };
  const seen = new Map();
  const origin = location.origin;
  document.querySelectorAll('a[href]').forEach((a) => {
    let href = (a.getAttribute('href') || '').trim();
    if (!href) return;
    if (/^(javascript|mailto|tel|sms|data|ftp|file):/i.test(href)) return;
    let url;
    try { url = new URL(href, location.href); } catch { return; }
    if (!/^https?:$/.test(url.protocol)) return;
    // Skip same-page fragment links — they are not "links to check".
    if (url.href.split('#')[0] === location.href.split('#')[0]) return;
    url.hash = '';
    const key = url.href;
    if (seen.has(key)) return;
    seen.set(key, {
      url: key,
      text: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 90),
      path: cssPath(a),
      sameOrigin: url.origin === origin,
    });
  });
  return [...seen.values()];
}

/** Scroll to and briefly flash the element for a CSS path (best effort). */
function revealElement(path) {
  let el = null;
  try {
    const cleaned = path.replace(/:nth\((\d+)\)/g, ':nth-of-type($1)');
    el = document.querySelector(cleaned);
  } catch { /* fall through */ }
  if (!el) {
    // Fallback: try matching by the last segment tag only.
    const last = path.split(' > ').pop().split(':')[0].split('#')[0];
    el = document.querySelector(last);
  }
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.style.outline = '3px solid #22d3ee';
  el.style.outlineOffset = '2px';
  setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 2200);
  return true;
}
