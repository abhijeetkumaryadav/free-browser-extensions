/* Twitch Chat Sentiment Ticker — in-page sampler (injected on demand).
 * Read-only: observes chat DOM via MutationObserver, scores messages with a
 * local word lexicon, and flushes compact samples to chrome.storage.local.
 * Never mutates the page, never sends data anywhere. */

(function () {
  "use strict";
  if (window.__twst) return; // prevent double injection
  window.__twst = true;

  // --- Local sentiment lexicon (heuristic, English) ---
  const POS = new Set(("love amazing awesome great best hype pog incredible fantastic wonderful " +
    "beautiful nice cool gg wp ez clap win winning letsgo glad happy excellent perfect " +
    "insane crazy sick clean smooth clutch genius brilliant wholesome").split(" "));
  const NEG = new Set(("hate terrible awful worst bad sad angry trash garbage lose losing " +
    "throwing inting feeder noob scrub unlucky rip f boring cringe yikes oof pain " +
    "disappointing horrible sucks stupid dumb").split(" "));

  const MAX_KEEP = 300;      // samples retained in storage
  const FLUSH_MS = 3000;     // storage flush cadence
  const BACKFILL = 40;       // existing messages sampled on start

  let buffer = [];
  let observer = null;
  let flushTimer = null;
  let flagTimer = null;

  /** crude word-level sentiment score: +1 / -1 / 0 */
  function score(text) {
    const words = text.toLowerCase().replace(/[^a-z0-9\s']/g, " ").split(/\s+/);
    let s = 0;
    for (const w of words) {
      if (POS.has(w)) s++;
      else if (NEG.has(w)) s--;
    }
    return s > 0 ? 1 : s < 0 ? -1 : 0;
  }

  /** Extract readable text + emote names from a chat line element. */
  function parseLine(el) {
    const emotes = [];
    el.querySelectorAll("img").forEach((img) => {
      const alt = (img.getAttribute("alt") || "").trim();
      if (alt) emotes.push(alt);
    });
    const text = (el.innerText || "").trim();
    return { text, emotes };
  }

  function ingest(el) {
    if (!el || el.nodeType !== 1) return;
    // Twitch chat lines carry one of these classes (checked defensively)
    const line = el.matches(".chat-line__message, [data-a-target='chat-line-message']")
      ? el
      : el.querySelector(".chat-line__message, [data-a-target='chat-line-message']");
    if (!line) return;
    const { text, emotes } = parseLine(line);
    if (!text && !emotes.length) return;
    buffer.push({ t: Date.now(), s: score(text), emotes: emotes.slice(0, 6) });
    if (buffer.length > MAX_KEEP * 2) buffer = buffer.slice(-MAX_KEEP * 2);
  }

  function flush() {
    chrome.storage.local.set({
      twst_samples: buffer.slice(-MAX_KEEP),
      twst_updated: Date.now(),
    });
  }

  /** Locate the scrollable chat message container. */
  function findChat() {
    return (
      document.querySelector(".chat-scrollable-area__message-container") ||
      document.querySelector("[role='log']") ||
      document.querySelector(".chat-list")
    );
  }

  function start() {
    const container = findChat();
    if (!container) return false;

    // Backfill a few existing messages so stats aren't empty.
    const existing = container.querySelectorAll(
      ".chat-line__message, [data-a-target='chat-line-message']"
    );
    Array.from(existing).slice(-BACKFILL).forEach(ingest);

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach(ingest);
      }
    });
    observer.observe(container, { childList: true, subtree: true });

    flushTimer = setInterval(flush, FLUSH_MS);
    // Self-stop if the popup turned sampling off (e.g. popup closed mid-run).
    flagTimer = setInterval(async () => {
      const { twst_running } = await chrome.storage.local.get({ twst_running: false });
      if (!twst_running) stop();
    }, 2000);
    return true;
  }

  function stop() {
    if (observer) observer.disconnect();
    if (flushTimer) clearInterval(flushTimer);
    if (flagTimer) clearInterval(flagTimer);
    flush(); // final write so the popup keeps the last window
    observer = flushTimer = flagTimer = null;
    window.__twst = false;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "TWST_STOP") stop();
  });

  if (!start()) {
    // Chat not found (e.g. not a stream page) — bail out cleanly.
    window.__twst = false;
  }
})();
