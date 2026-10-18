/* Cadence Profiler — content script: collects timed caption segments exposed by the page. */
(() => {
  const results = [];

  /* YouTube player caption segments. */
  document.querySelectorAll(".captions-text").forEach((el) => {
    const t = el.innerText.trim();
    if (t) results.push({ start: null, text: t });
  });

  /* Timed-text elements with data attributes (seconds or ms). */
  document.querySelectorAll("[data-start], [data-begin], [data-timestamp]").forEach((el) => {
    const t = el.innerText.trim();
    if (!t) return;
    let raw = el.getAttribute("data-start") ?? el.getAttribute("data-begin") ?? el.getAttribute("data-timestamp");
    let start = parseFloat(raw);
    if (!Number.isFinite(start)) return;
    if (start > 100000) start = start / 1000; // ms -> s
    results.push({ start, text: t });
  });

  /* Same-origin <video> text-track cues (graceful if unavailable). */
  document.querySelectorAll("video").forEach((v) => {
    try {
      for (const track of v.textTracks || []) {
        for (const cue of track.cues || []) {
          const t = (cue.text || "").trim();
          if (t && Number.isFinite(cue.startTime)) results.push({ start: cue.startTime, text: t });
        }
      }
    } catch (_) { /* cross-origin tracks are unreadable — skip */ }
  });

  /* Generic subtitle/transcript containers with per-line time labels. */
  document.querySelectorAll(".subtitle, .caption, .transcript, .cue, [class*='subtitle']").forEach((el) => {
    const t = el.innerText.trim();
    if (t && t.length < 400) results.push({ start: null, text: t });
  });

  // Dedupe identical consecutive lines (caption repaints).
  const deduped = results.filter((r, i, a) =>
    i === 0 || r.text !== a[i - 1].text);

  return deduped.slice(0, 5000);
})();
