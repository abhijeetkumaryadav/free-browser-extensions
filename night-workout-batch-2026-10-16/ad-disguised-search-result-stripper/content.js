/**
 * Ad-Stripper — content scan logic.
 * This function is serialized into the page via chrome.scripting (explicit click only).
 * It only ever runs when the user presses "Scan & collapse ads".
 * No network calls. Reversible: every collapsed node is stashed and can be restored.
 */

/** Ad-signal heuristics, run inside the page. Must be fully self-contained. */
function adStripperScan(aggressive) {
  // Guard against re-running the collapse marker logic twice
  if (document.documentElement.hasAttribute("data-adstrip-done")) {
    return { alreadyDone: true, flagged: [] };
  }

  const AD_LABEL_RE = /^\s*(ad|sponsored|advertisement|paid\s*placement|promoted)\s*$/i;
  const AD_HINT_RE = /(sponsored|advertisement|promoted|paid result|ad choice)/i;
  const TRACKING_URL_RE = /(aclk|googleads|gclid=|fbclid=|doubleclick|\/ads\/click|\/aclk\?)/i;

  // Candidate result containers across common search engines
  const SELECTORS = [
    "div.g",              // Google
    "div[data-hveid]",    // Google (new)
    "li.b_algo",          // Bing
    "div.b_ans",          // Bing answer cards (aggressive only really)
    "div.result",         // DuckDuckGo
    "div.web-result",     // Brave
    "li.mod > article",   // Ecosia-ish
    ".search-result", ".organic-result"
  ];

  const seen = new Set();
  const flagged = [];

  SELECTORS.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);

      // Skip tiny/nested noise — only consider elements with a link + text
      const link = el.querySelector("a[href]");
      if (!link) return;
      const text = (el.innerText || "").trim();
      if (text.length < 10) return;

      const reasons = [];

      // 1. Explicit ad/sponsored labels inside the block
      const labelEls = el.querySelectorAll("span,div,a");
      for (const l of labelEls) {
        const t = (l.textContent || "").trim();
        if (t.length <= 24 && AD_LABEL_RE.test(t)) {
          reasons.push('Label "' + t + '"');
          break;
        }
      }

      // 2. Sponsored/advertisement hint text in the block
      if (!reasons.length && AD_HINT_RE.test(text.slice(0, 400))) {
        reasons.push("Contains sponsored/ad language");
      }

      // 3. Tracking/ad click URLs
      if (TRACKING_URL_RE.test(link.href || "")) {
        reasons.push("Ad-click/tracking URL");
      }

      // 4. Aggressive mode: any click-tracking redirector URL
      if (aggressive && !reasons.length) {
        const href = link.href || "";
        if (/redirect|url\?|out\?|goto\?|jump\?/i.test(href) && href.length > 120) {
          reasons.push("Long redirect-style URL (aggressive)");
        }
      }

      if (reasons.length) {
        // Stash original display so restore is exact
        el.setAttribute("data-adstrip-orig-display", el.style.display || "");
        el.setAttribute("data-adstrip-collapsed", "1");
        el.style.display = "none";
        const title = (el.querySelector("h3,h2,h1") || link).textContent.trim().slice(0, 80) || "(untitled)";
        flagged.push({ title: title, why: reasons.join("; ") });
      }
    });
  });

  document.documentElement.setAttribute("data-adstrip-done", "1");
  return { alreadyDone: false, flagged: flagged };
}

/** Restore every node collapsed by adStripperScan. Self-contained. */
function adStripperRestore() {
  const nodes = document.querySelectorAll("[data-adstrip-collapsed='1']");
  nodes.forEach((el) => {
    el.style.display = el.getAttribute("data-adstrip-orig-display") || "";
    el.removeAttribute("data-adstrip-collapsed");
    el.removeAttribute("data-adstrip-orig-display");
  });
  document.documentElement.removeAttribute("data-adstrip-done");
  return { restored: nodes.length };
}
