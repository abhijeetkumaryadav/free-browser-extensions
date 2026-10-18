/* Content-side engine: reads PerformanceResourceTiming entries, keeps only
 * cross-host <script> resources, and reports {host, url, durationMs, startMs}.
 * Boot-once guard prevents duplicate handlers on re-injection. */
(() => {
  if (window.__tpscanLoaded) return;
  window.__tpscanLoaded = true;

  // Decide whether a URL belongs to a third-party host relative to the page.
  function isThirdParty(url) {
    try {
      const u = new URL(url, location.href);
      if (u.protocol !== "http:" && u.protocol !== "https:") return false;
      const pageHost = location.hostname.replace(/^www\./, "");
      const host = u.hostname.replace(/^www\./, "");
      if (!host || host === pageHost) return false;
      // Same registrable suffix is still "same site"; keep it simple: host differs.
      return true;
    } catch (e) { return false; }
  }

  function scan() {
    const pageHost = location.hostname;
    const entries = performance.getEntriesByType("resource") || [];
    const out = [];
    for (const e of entries) {
      if (e.initiatorType !== "script") continue;
      if (!isThirdParty(e.name)) continue;
      let host = "";
      try { host = new URL(e.name).hostname; } catch (err) { continue; }
      out.push({
        host,
        url: e.name,
        durationMs: Math.round((e.responseEnd - e.startTime) * 10) / 10,
        startMs: Math.round(e.startTime * 10) / 10
      });
    }
    out.sort((a, b) => a.startMs - b.startMs);
    return { pageHost, scripts: out.slice(0, 60) };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "TPS_SCAN") {
      try { sendResponse({ ok: true, data: scan() }); }
      catch (e) { sendResponse({ ok: false, error: String(e) }); }
    }
    return true;
  });
})();
