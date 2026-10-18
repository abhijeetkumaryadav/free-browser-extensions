/* Essay Clarity Checker — content.js
 * Injected on EXPLICIT user click (via chrome.scripting + activeTab).
 * Returns the page's main readable text. Never runs automatically and
 * never touches the DOM.
 */
(() => {
  function mainText() {
    // Prefer article-ish containers; fall back to cleaned body text.
    const root = document.querySelector('article, main, [role="main"]') || document.body;
    const clone = root.cloneNode(true);
    clone.querySelectorAll('script, style, nav, footer, header, aside, noscript, form').forEach((n) => n.remove());
    return (clone.innerText || '').replace(/\s+/g, ' ').trim();
  }
  return mainText();
})();
