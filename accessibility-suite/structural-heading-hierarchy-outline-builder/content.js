/* Heading Outline content script — extracts h1–h6 and scrolls to them. */
(() => {
  if (window.__headingOutlineLoaded) return;
  window.__headingOutlineLoaded = true;

  const HIGHLIGHT_ID = 'heading-outline-flash';

  /** Collect headings in document order. */
  function getHeadings() {
    const els = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    return Array.from(els).map((el, index) => ({
      index,
      level: Number(el.tagName[1]),
      text: (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
    }));
  }

  /** Scroll to a heading and flash a highlight ring on it. */
  function scrollToHeading(index) {
    const els = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const el = els[index];
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const prev = document.getElementById(HIGHLIGHT_ID);
    if (prev) prev.remove();
    const ring = document.createElement('div');
    ring.id = HIGHLIGHT_ID;
    const r = el.getBoundingClientRect();
    Object.assign(ring.style, {
      position: 'fixed',
      left: `${r.left - 6}px`,
      top: `${r.top - 6}px`,
      width: `${r.width + 12}px`,
      height: `${r.height + 12}px`,
      border: '2px solid #34d399',
      borderRadius: '8px',
      pointerEvents: 'none',
      zIndex: '2147483647',
    });
    document.documentElement.appendChild(ring);
    setTimeout(() => ring.remove(), 1600);
    return true;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'ho-ping') { sendResponse({ ok: true }); return true; }
    if (msg.type === 'ho-get') { sendResponse({ ok: true, headings: getHeadings() }); return true; }
    if (msg.type === 'ho-scroll') { sendResponse({ ok: scrollToHeading(msg.index) }); return true; }
    return false;
  });
})();
