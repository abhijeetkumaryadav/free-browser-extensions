// content.js — GhostScroll nudger. Injected on demand via chrome.scripting.
// Guards against double-injection; keeps everything in-page and reversible.
"use strict";

(() => {
  if (window.__ghostScrollInstalled) return; // prevent duplicate timers
  window.__ghostScrollInstalled = true;

  // Pixels per nudge + min/max delay (ms) per spookiness level.
  const LEVELS = [
    { px: 4,  min: 9000,  max: 20000 },  // Gentle
    { px: 9,  min: 5000,  max: 12000 },  // Mischievous
    { px: 16, min: 2500,  max: 7000  },  // Haunted
  ];

  let timer = null;

  function nudge(level) {
    // Don't fight the user: skip the nudge if they scrolled in the last 1.5s.
    const now = Date.now();
    if (window.__ghostScrollLastUserScroll && now - window.__ghostScrollLastUserScroll < 1500) return;
    const delta = Math.round((Math.random() - 0.5) * 2 * level.px);
    window.scrollBy({ top: delta, behavior: "smooth" });
    // A rare tiny horizontal shiver, for extra spook.
    if (Math.random() < 0.15) {
      window.scrollBy({ left: Math.round((Math.random() - 0.5) * 6), behavior: "smooth" });
    }
  }

  function schedule(levelIdx) {
    const level = LEVELS[levelIdx] || LEVELS[0];
    const delay = level.min + Math.random() * (level.max - level.min);
    timer = setTimeout(() => {
      nudge(level);
      if (timer !== null) schedule(levelIdx);
    }, delay);
  }

  function start(levelIdx) {
    stop();
    window.addEventListener("scroll", markUserScroll, { passive: true, capture: true });
    // Wait a beat before the first nudge so it feels "spooky", not instant.
    timer = setTimeout(() => {
      timer = null; // hand the timer chain over to schedule()
      schedule(levelIdx);
    }, 1000);
  }

  function markUserScroll() {
    window.__ghostScrollLastUserScroll = Date.now();
  }

  function stop() {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    window.removeEventListener("scroll", markUserScroll, { capture: true });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "gs-start") { start(Number(msg.intensity) || 0); sendResponse({ ok: true }); }
    else if (msg.type === "gs-stop") { stop(); sendResponse({ ok: true }); }
    else if (msg.type === "gs-status") { sendResponse({ haunted: timer !== null }); }
    return true;
  });
})();
