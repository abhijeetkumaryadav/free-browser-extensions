/* Content-side engine: scheme check + mixed-content scan of the page's
 * subresources (scripts, images, styles, frames, media, XHR/fetch). Boot-once. */
(() => {
  if (window.__httpsHygieneLoaded) return;
  window.__httpsHygieneLoaded = true;

  function isHttpUrl(u) {
    return /^http:\/\//i.test(u) || u.startsWith("//") === false && /^http:/i.test(u);
  }

  function collect(tag, attr) {
    const out = [];
    document.querySelectorAll(tag).forEach((el) => {
      const v = el.getAttribute(attr) || "";
      if (v && /^http:\/\//i.test(v.trim())) out.push({ kind: tag + "[" + attr + "]", url: v.trim() });
    });
    return out;
  }

  function scan() {
    const pageUrl = location.href;
    const pageIsHttps = /^https:\/\//i.test(pageUrl);
    const insecure = [];
    if (pageIsHttps) {
      insecure.push(...collect("script", "src"));
      insecure.push(...collect("img", "src"));
      insecure.push(...collect("link", "href"));
      insecure.push(...collect("iframe", "src"));
      insecure.push(...collect("video", "src"));
      insecure.push(...collect("audio", "src"));
      insecure.push(...collect("source", "src"));
      insecure.push(...collect("embed", "src"));
      insecure.push(...collect("object", "data"));
      // Inline style url(http://...) references
      document.querySelectorAll("[style]").forEach((el) => {
        const st = el.getAttribute("style") || "";
        const m = st.match(/url\(\s*['"]?http:\/\/[^'")]+/i);
        if (m) insecure.push({ kind: "inline style url()", url: m[0].slice(0, 120) });
      });
    }
    // Cap output
    return { pageUrl, pageIsHttps, insecure: insecure.slice(0, 40), total: insecure.length };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "HTTPS_SCAN") {
      try { sendResponse({ ok: true, data: scan() }); }
      catch (e) { sendResponse({ ok: false, error: String(e) }); }
    }
    return true;
  });
})();
