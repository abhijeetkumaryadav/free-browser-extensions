// Payload Badger — content script (injected on click only via chrome.scripting).
// Collects every <img> on the page with its natural dimensions, decoded size,
// transfer size (from Resource Timing when available) and format.
(function () {
  "use strict";

  // Read transfer size from PerformanceResourceTiming when available.
  function transferBytes(url) {
    try {
      var entries = performance.getEntriesByType("resource");
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].name === url && entries[i].transferSize) {
          return entries[i].transferSize;
        }
      }
    } catch (e) { /* performance API unavailable */ }
    return 0;
  }

  // Rough estimate of decoded byte size from natural dimensions.
  function decodedEstimate(img) {
    var w = img.naturalWidth || 0, h = img.naturalHeight || 0;
    return w * h * 4; // 4 bytes/px RGBA — an upper-bound estimate
  }

  function formatFrom(url, img) {
    var m = (url || "").split("?")[0].match(/\.([a-z0-9]+)$/i);
    var ext = m ? m[1].toLowerCase() : "";
    // Detect WebP/AVIF served under another extension via canvas round-trip.
    try {
      var c = document.createElement("canvas");
      var uri = c.toDataURL("image/webp");
      if (uri.indexOf("data:image/webp") !== 0) { ext = ext || "unknown"; }
    } catch (e) { /* canvas blocked */ }
    return ext || "unknown";
  }

  var imgs = Array.prototype.slice.call(document.querySelectorAll("img"));
  var out = imgs.map(function (img) {
    var src = img.currentSrc || img.src || "";
    var naturalW = img.naturalWidth || 0, naturalH = img.naturalHeight || 0;
    var shownW = img.clientWidth || 0, shownH = img.clientHeight || 0;
    var transfer = transferBytes(src);
    var decoded = decodedEstimate(img);
    // Best available byte count: real transfer size first, then decoded estimate.
    var bytes = transfer > 0 ? transfer : decoded;
    var oversizeRatio = (shownW > 0 && naturalW > shownW * 1.5) ? naturalW / shownW : 0;
    return {
      src: src.slice(0, 220),
      alt: (img.alt || "").slice(0, 80),
      naturalW: naturalW, naturalH: naturalH,
      shownW: shownW, shownH: shownH,
      bytes: bytes, transferKnown: transfer > 0,
      format: formatFrom(src, img),
      oversizeRatio: oversizeRatio,
      loading: img.loading || "auto"
    };
  });

  return {
    url: location.href,
    images: out.filter(function (x) { return x.src; })
  };
})();
