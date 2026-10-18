/* Script Extractor — content script.
 * Collects caption / timed-text lines that the page already exposes in the DOM:
 *  - YouTube player caption segments
 *  - Elements carrying data-start / data-begin / data-timestamp (seconds or ms)
 *  - Same-origin <video> text-track cues (cross-origin tracks are unreadable)
 *  - Generic subtitle / caption / transcript containers
 * Sends the raw lines back to the popup; all beat segmentation happens there.
 */
(function () {
  if (window.__seExtractInstalled) return;
  window.__seExtractInstalled = true;

  /** Push a deduped, normalized line. */
  function collectLines() {
    const out = [];

    function push(text, start, source) {
      text = String(text || "").replace(/\s+/g, " ").trim();
      if (!text || text.length < 2) return;
      const last = out[out.length - 1];
      if (last && last.text === text) return; // caption repaints repeat text
      let s = start == null ? null : Number(start);
      if (s != null && !Number.isFinite(s)) s = null;
      out.push({ text, start: s, source });
    }

    // 1) YouTube player captions
    document
      .querySelectorAll(".caption-window .captions-text, .captions-text .captions-text-box")
      .forEach((el) => push(el.innerText, null, "youtube"));

    // 2) Generic timed elements (data-start in seconds or milliseconds)
    document
      .querySelectorAll("[data-start], [data-begin], [data-timestamp]")
      .forEach((el) => {
        const raw =
          el.getAttribute("data-start") ||
          el.getAttribute("data-begin") ||
          el.getAttribute("data-timestamp");
        let s = parseFloat(raw);
        if (Number.isFinite(s)) {
          if (s > 100000) s = s / 1000; // milliseconds -> seconds
          push(el.innerText, s, "timed-attr");
        }
      });

    // 3) Same-origin video text tracks (throws / empty for cross-origin)
    document.querySelectorAll("video").forEach((v) => {
      try {
        for (const track of v.textTracks || []) {
          try {
            for (const cue of track.cues || []) {
              push(cue.text, cue.startTime, "track");
            }
          } catch (e) { /* unreadable track */ }
        }
      } catch (e) { /* no track access */ }
    });

    // 4) Generic subtitle / caption / transcript containers
    document
      .querySelectorAll(
        ".subtitle, .subtitles, .caption, .captions, .cue, .transcript, .transcript-cue, " +
        "[class*='transcript'], [class*='subtitle']"
      )
      .forEach((el) => {
        if (el.closest(".caption-window")) return; // already covered above
        push(el.innerText, null, "container");
      });

    // Chronological first; undated lines keep DOM order at the end.
    out.sort((a, b) => (a.start == null ? 1e12 : a.start) - (b.start == null ? 1e12 : b.start));
    return out;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "SE_EXTRACT") {
      sendResponse(collectLines());
    }
    return true;
  });
})();
