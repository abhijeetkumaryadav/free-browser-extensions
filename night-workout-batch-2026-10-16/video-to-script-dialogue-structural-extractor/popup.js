/* Script Extractor — popup logic.
 * Injects content.js on demand, segments caption lines into dialogue beats
 * (speaker-label changes and time gaps), renders them, and exports Markdown.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  let lastBeats = [];
  let lastTitle = "";

  /** seconds -> "mm:ss" (or "h:mm:ss"). */
  function fmt(s) {
    if (s == null) return "—";
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
    return (h > 0 ? h + ":" : "") + mm + ":" + String(sec).padStart(2, "0");
  }

  function setStatus(text) {
    const el = $("status");
    el.textContent = text;
    el.classList.remove("hidden");
  }

  /** Group raw caption lines into beats: new beat on speaker change or a
   *  long time gap (> 6s) between dated lines. */
  function segmentBeats(lines) {
    const beats = [];
    const speakerRe = /^([A-Z][A-Za-z' .\-]{1,24}):\s/;
    let cur = null;

    for (const l of lines) {
      const m = l.text.match(speakerRe);
      const speaker = m ? m[1] : null;
      const gap =
        cur && l.start != null && cur.lastStart != null ? l.start - cur.lastStart : 0;

      if (!cur || gap > 6 || (speaker && cur.speaker && speaker !== cur.speaker)) {
        cur = { speaker: speaker, start: l.start, lastStart: l.start, lines: [] };
        beats.push(cur);
      }
      if (speaker && !cur.speaker) cur.speaker = speaker;
      cur.lines.push(l.text);
      if (l.start != null) cur.lastStart = l.start;
    }
    return beats;
  }

  function render(lines) {
    const box = $("results");
    box.innerHTML = "";
    $("export").classList.add("hidden");
    lastBeats = [];

    if (!lines || lines.length === 0) {
      setStatus(
        "No captions found on this page. This tool only reads captions and " +
        "timed text the page already exposes — it cannot transcribe audio. " +
        "Try a video page with subtitles turned on."
      );
      return;
    }

    lastBeats = segmentBeats(lines);
    setStatus(
      "Found " + lines.length + " caption line" + (lines.length === 1 ? "" : "s") +
      " → " + lastBeats.length + " beat" + (lastBeats.length === 1 ? "" : "s") + "."
    );

    lastBeats.forEach((b, i) => {
      const card = document.createElement("div");
      card.className = "beat";

      const head = document.createElement("div");
      head.className = "beat-head";
      head.innerHTML =
        '<span class="beat-num">Beat ' + (i + 1) + "</span>" +
        '<span class="beat-time">' + fmt(b.start) + "</span>" +
        (b.speaker ? '<span class="beat-speaker">' + escapeHtml(b.speaker) + "</span>" : "");
      card.appendChild(head);

      const body = document.createElement("div");
      body.className = "beat-lines";
      body.textContent = b.lines.join("\n");
      card.appendChild(body);

      box.appendChild(card);
    });

    $("export").classList.remove("hidden");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function buildMarkdown() {
    let md = "# Script outline\n\n";
    md += "_" + lastTitle.replace(/\*/g, "") + "_\n\n";
    md += "> Extracted from on-page captions / timed text. Not a speech-to-text transcription.\n\n";
    lastBeats.forEach((b, i) => {
      md += "## Beat " + (i + 1) + " — " + fmt(b.start);
      if (b.speaker) md += " — " + b.speaker;
      md += "\n\n" + b.lines.join("\n") + "\n\n";
    });
    return md;
  }

  $("extract").addEventListener("click", async () => {
    const btn = $("extract");
    btn.disabled = true;
    setStatus("Scanning page for captions…");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      const lines = await chrome.tabs.sendMessage(tab.id, { type: "SE_EXTRACT" });
      lastTitle = tab.title || "Untitled page";
      render(lines);
    } catch (e) {
      setStatus(
        "Could not access this page (" + (e.message || e) + "). " +
        "Open a normal web page (not a chrome:// or store page) and try again."
      );
    } finally {
      btn.disabled = false;
    }
  });

  $("export").addEventListener("click", () => {
    const blob = new Blob([buildMarkdown()], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "script-outline.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
})();
