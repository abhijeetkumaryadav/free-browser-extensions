// XML Sitemap Product Extractor — content script, injected into the active tab.
// Runs in the page's own origin, so it may only fetch same-origin URLs.
// Returns a JSON-serializable result to the popup.

(async () => {
  const origin = location.origin;
  const MAX_CHILD = 50;   // cap child-sitemap recursion
  const MAX_DEPTH = 3;

  async function getText(url) {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error("http-" + res.status);
    return await res.text();
  }

  // 1. Locate the sitemap: robots.txt "Sitemap:" line, then common paths.
  let xml = null, found = null;
  try {
    const robots = await getText(origin + "/robots.txt");
    const m = robots.match(/^Sitemap:\s*(\S+)/im);
    if (m) {
      const u = new URL(m[1], origin);
      if (u.origin === origin) {
        xml = await getText(u.href);
        found = u.href;
      }
    }
  } catch (e) { /* no usable robots entry */ }
  if (!xml) {
    for (const p of ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml", "/sitemap.xml.gz"]) {
      try { xml = await getText(origin + p); found = origin + p; break; }
      catch (e) { /* try next */ }
    }
  }
  if (!xml) return { ok: false, error: "no-sitemap" };

  // 2. Collect <loc> URLs, recursing into sitemap indexes (same-origin only).
  const parser = new DOMParser();
  const urls = [];
  const seen = new Set();
  let childCount = 0;

  async function collect(text, depth) {
    if (depth > MAX_DEPTH) return;
    let doc;
    try { doc = parser.parseFromString(text, "text/xml"); }
    catch (e) { return; }
    if (doc.querySelector("parsererror")) return;
    const root = (doc.documentElement.tagName || "").toLowerCase();
    if (root.includes("sitemapindex")) {
      const locs = [...doc.getElementsByTagName("loc")].map((n) => n.textContent.trim());
      for (const l of locs) {
        if (childCount >= MAX_CHILD) break;
        try {
          const u = new URL(l, origin);
          if (u.origin !== origin || seen.has(u.href)) continue;  // same-origin only
          seen.add(u.href);
          childCount++;
          await collect(await getText(u.href), depth + 1);
        } catch (e) { /* skip broken child */ }
      }
    } else {
      for (const ue of doc.getElementsByTagName("url")) {
        const loc = ue.getElementsByTagName("loc")[0];
        const lm = ue.getElementsByTagName("lastmod")[0];
        if (loc && loc.textContent.trim()) {
          urls.push({
            loc: loc.textContent.trim(),
            lastmod: lm ? lm.textContent.trim() : "",
          });
        }
      }
    }
  }

  try {
    await collect(xml, 0);
  } catch (e) {
    return { ok: false, error: "parse-failed" };
  }
  return { ok: true, sitemap: found, urls };
})();
