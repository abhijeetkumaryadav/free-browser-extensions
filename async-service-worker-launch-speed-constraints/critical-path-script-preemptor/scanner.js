// scanner.js — runs in the page context via chrome.scripting.executeScript.
// Read-only audit: collects script/stylesheet resources, flags render-blocking
// ones, and returns plain data to the popup. Never modifies the DOM.

(function scanRenderBlocking() {
  // Resource Timing entries give real network durations for each subresource.
  var resources = performance.getEntriesByType("resource");
  var byUrl = {};
  resources.forEach(function (r) {
    byUrl[r.name] = r;
  });

  function fmtBytes(bytes) {
    if (bytes == null || bytes === 0) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  var items = [];

  // ---- Scripts: synchronous classic scripts in <head> block rendering. ----
  Array.prototype.forEach.call(document.querySelectorAll("script[src]"), function (el) {
    var src = el.src;
    var inHead = el.closest("head") !== null;
    var isSync = !el.async && !el.defer && el.type !== "module";
    var entry = byUrl[src];
    var duration = entry ? Math.round(entry.duration) : null;
    var size = entry && entry.transferSize ? entry.transferSize : null;

    var blocking = isSync && inHead;
    var suggestions = [];
    if (blocking) {
      suggestions.push("Add defer or async so parsing is not blocked");
      suggestions.push("Move non-critical scripts to just before </body>");
    } else if (isSync && !inHead) {
      suggestions.push("Consider defer if this script is not needed before render");
    }

    items.push({
      kind: "script",
      url: src,
      label: src.split("/").pop().split("?")[0] || src,
      blocking: blocking,
      inHead: inHead,
      durationMs: duration,
      size: fmtBytes(size),
      notes: (el.async ? "async " : "") + (el.defer ? "defer " : "") +
             (el.type === "module" ? "module " : "") + (isSync ? "synchronous" : "non-blocking"),
      suggestions: suggestions
    });
  });

  // ---- Stylesheets: all render-blocking unless preloaded / media-switched. ----
  Array.prototype.forEach.call(document.querySelectorAll('link[rel="stylesheet"]'), function (el) {
    var href = el.href;
    var entry = byUrl[href];
    var duration = entry ? Math.round(entry.duration) : null;
    var size = entry && entry.transferSize ? entry.transferSize : null;
    var media = el.media || "all";
    var nonBlocking = media !== "all" && media !== "screen";

    var suggestions = [];
    if (!nonBlocking) {
      suggestions.push("Inline critical CSS for above-the-fold content");
      suggestions.push('Load the rest with media="print" onload swap or preload');
      suggestions.push("Split per-route CSS on multi-page apps");
    }

    items.push({
      kind: "stylesheet",
      url: href,
      label: href.split("/").pop().split("?")[0] || href,
      blocking: !nonBlocking,
      inHead: el.closest("head") !== null,
      durationMs: duration,
      size: fmtBytes(size),
      notes: "media=" + media + (nonBlocking ? " (non-blocking)" : " (render-blocking)"),
      suggestions: suggestions
    });
  });

  // Navigation timing gives first paint / DOM content loaded anchors.
  var nav = performance.getEntriesByType("navigation")[0];
  var timing = nav ? {
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
    load: Math.round(nav.loadEventEnd),
    firstByte: Math.round(nav.responseStart)
  } : null;

  var blockingCount = items.filter(function (i) { return i.blocking; }).length;
  var grade;
  if (blockingCount === 0) grade = { label: "Clean", color: "#22c55e", text: "No render-blocking resources found." };
  else if (blockingCount <= 3) grade = { label: "Fair", color: "#f59e0b", text: blockingCount + " render-blocking resource(s). Easy wins available." };
  else grade = { label: "Heavy", color: "#ef4444", text: blockingCount + " render-blocking resources. Prioritize deferring scripts." };

  return {
    url: location.href,
    host: location.host,
    scannedAt: new Date().toISOString(),
    timing: timing,
    grade: grade,
    items: items
  };
})();
