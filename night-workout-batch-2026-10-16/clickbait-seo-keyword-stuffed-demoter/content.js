// Clickbait Demoter — page-side engine. Injected only on explicit click (activeTab + scripting).
// Heuristic, reversible: dims suspected clickbait cards; restore() returns the page exactly.
(function () {
  "use strict";
  const MARK = "__clickbaitDemoted";

  // Bundled heuristic signals.
  const PHRASES = [
    "you won't believe", "you wont believe", "will shock you", "doctors hate",
    "number 7 will", "what happens next", "gone wrong", "gone right",
    "mind-blowing", "mind blowing", "insane trick", "secret trick", "they don't want you",
    "never knew", "changed my life", "at 3am", "not clickbait", "100% free money"
  ];

  function clickbaitScore(text) {
    const t = text.trim();
    if (!t || t.length > 220) return { score: 0, why: [] };
    const why = [];
    let score = 0;
    // ALL CAPS title (long enough to matter)
    if (t.length >= 12 && t === t.toUpperCase() && /[A-Z]/.test(t)) { score += 2; why.push("all-caps title"); }
    // Excessive punctuation
    if (/[!?]{2,}/.test(t)) { score += 2; why.push("excessive punctuation"); }
    // Bait phrases
    const low = t.toLowerCase();
    for (const p of PHRASES) {
      if (low.includes(p)) { score += 2; why.push("bait phrase: \"" + p + "\""); break; }
    }
    // List-bait: starts with a big number
    if (/^\s*\d{1,3}\s+(reasons|things|ways|tips|tricks|secrets|signs|facts|hacks|photos|pictures)\b/i.test(t)) {
      score += 1; why.push("list-bait number");
    }
    // Keyword stuffing: same word 3+ times in title
    const words = low.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3);
    const counts = {};
    for (const w of words) { counts[w] = (counts[w] || 0) + 1; }
    for (const w in counts) {
      if (counts[w] >= 3) { score += 2; why.push("keyword stuffing: \"" + w + "\" x" + counts[w]); break; }
    }
    return { score, why };
  }

  // Candidate result cards: links with substantial title text inside list/article/card-ish ancestors.
  function findCards() {
    const cards = new Map();
    document.querySelectorAll("a h1, a h2, a h3, a h4").forEach(h => {
      let el = h;
      for (let i = 0; i < 4 && el && el !== document.body; i++) {
        el = el.parentElement;
        if (el && /article|li|div/i.test(el.tagName)) break;
      }
      if (el && el !== document.body && el.offsetHeight > 20) cards.set(el, h.innerText);
    });
    // Fallback: plain list items with bold/strong links
    if (cards.size < 3) {
      document.querySelectorAll("li a, article a").forEach(a => {
        const t = a.innerText || "";
        if (t.length > 15 && t.length < 220 && a.offsetHeight > 20) cards.set(a.closest("li,article") || a, t);
      });
    }
    return cards;
  }

  window.__clickbaitDemote = function () {
    let n = 0;
    const evidence = [];
    for (const [card, title] of findCards()) {
      if (card.dataset[MARK]) continue;
      const { score, why } = clickbaitScore(title);
      if (score >= 2) {
        card.dataset[MARK] = "1";
        card.dataset.__origStyle = card.getAttribute("style") || "";
        card.style.opacity = "0.25";
        card.style.filter = "grayscale(60%)";
        card.style.outline = "2px dashed #ef4444";
        n++;
        evidence.push({ title: title.slice(0, 80), why });
      }
    }
    return { demoted: n, evidence: evidence.slice(0, 12) };
  };

  window.__clickbaitRestore = function () {
    let n = 0;
    document.querySelectorAll("[data-" + MARK + "]").forEach(el => {
      if (el.dataset.__origStyle) el.setAttribute("style", el.dataset.__origStyle);
      else el.removeAttribute("style");
      delete el.dataset[MARK];
      delete el.dataset.__origStyle;
      n++;
    });
    return n;
  };
})();
