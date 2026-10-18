/* Landing Page Copywriting Hook Analyzer — popup logic.
 * Injects a read-only extractor into the active tab, then scores the hero copy
 * against a bundled heuristic checklist. 100% local. */
"use strict";

/* Runs inside the page. Extracts copy signals, returns a plain object. */
function extractCopy() {
  const textOf = el => (el.textContent || "").replace(/\s+/g, " ").trim();

  // Hero: first h1 + nearby lead paragraph.
  const h1 = document.querySelector("h1");
  const hero = h1 ? textOf(h1) : "";
  let lead = "";
  if (h1) {
    const sib = h1.parentElement;
    const p = sib ? sib.querySelector("p") : null;
    if (p) lead = textOf(p).slice(0, 300);
  }

  const headings = [...document.querySelectorAll("h1,h2,h3")]
    .slice(0, 12).map(textOf).filter(Boolean);

  const buttons = [...document.querySelectorAll("a,button")]
    .map(el => textOf(el)).filter(t => t && t.length <= 40)
    .filter(t => /buy|sign|start|get|try|join|book|demo|free|shop|order|subscribe|download|learn|discover|request/i.test(t));

  const bodyText = (document.body ? textOf(document.body) : "").slice(0, 20000);

  return { hero, lead, headings, buttons, bodyText, url: location.hostname };
}

/* Heuristic checklist. Each check: {name, run(d) -> {level, detail, tip}} */
const CHECKS = [
  {
    name: "Hero value proposition",
    run(d) {
      const words = d.hero.split(/\s+/).filter(Boolean).length;
      if (!d.hero) return { level: "weak", detail: "No h1 found.", tip: "Give the page one clear headline stating who it helps and how." };
      if (words < 4) return { level: "weak", detail: `Hero is only ${words} words.`, tip: "Expand the headline so a first-time visitor gets the value in one read." };
      if (words > 20) return { level: "ok", detail: `Hero is ${words} words — on the long side.`, tip: "Try cutting the hero to under ~15 words for skimmability." };
      return { level: "good", detail: `Hero is ${words} words.`, tip: "Hero length looks scannable. Make sure it names the visitor's outcome." };
    }
  },
  {
    name: "CTA presence",
    run(d) {
      const n = d.buttons.length;
      if (n === 0) return { level: "weak", detail: "No CTA-style buttons found.", tip: "Add a visible action button (start, try, buy, book) near the top of the page." };
      if (n === 1) return { level: "ok", detail: "1 CTA button found.", tip: "One CTA is a start — most pages benefit from repeating it after each section." };
      return { level: "good", detail: `${n} CTA-style buttons found.`, tip: "Keep every CTA pointing at the same primary action to avoid choice overload." };
    }
  },
  {
    name: "Specificity & numbers",
    run(d) {
      const nums = (d.hero + " " + d.lead + " " + d.headings.slice(0, 4).join(" ")).match(/\d+/g) || [];
      if (!nums.length) return { level: "weak", detail: "Hero area has no numbers.", tip: "Concrete numbers (price, time saved, users) make claims feel specific." };
      return { level: "good", detail: `${nums.length} number${nums.length > 1 ? "s" : ""} in the hero area.`, tip: "Numbers add specificity — keep them honest and verifiable." };
    }
  },
  {
    name: "Social proof signals",
    run(d) {
      const rx = /review|testimonial|trusted by|customers|users|rated|award|as seen|case study|logo/i;
      const found = rx.test(d.bodyText.slice(0, 8000));
      if (!found) return { level: "weak", detail: "No review/testimonial/trust signals detected.", tip: "Add a proof element near the hero: a testimonial, rating, or customer logos." };
      return { level: "good", detail: "Trust/review language detected.", tip: "Put your strongest proof (number + name) as close to the hero as possible." };
    }
  },
  {
    name: "Jargon check",
    run(d) {
      const rx = /\b(synergy|leverage|disrupt|paradigm|holistic|robust|scalable|cutting-edge|best-in-class|world-class|next-gen)\b/gi;
      const found = (d.hero + " " + d.lead + " " + d.headings.join(" ")).match(rx) || [];
      if (found.length > 2) return { level: "weak", detail: `${found.length} buzzwords spotted (${[...new Set(found.map(f=>f.toLowerCase()))].join(", ")}).`, tip: "Swap buzzwords for plain verbs: say what it does, not how innovative it is." };
      if (found.length) return { level: "ok", detail: `${found.length} buzzword${found.length > 1 ? "s" : ""} spotted.`, tip: "A little jargon is fine — make sure each one earns its place." };
      return { level: "good", detail: "No common buzzwords in the hero area.", tip: "Plain language kept. Re-check after every copy rewrite." };
    }
  },
  {
    name: "Word balance",
    run(d) {
      const words = d.bodyText.split(/\s+/).filter(Boolean).length;
      if (words < 100) return { level: "weak", detail: `Only ~${words} words on the page.`, tip: "Very short pages often under-explain; add an FAQ or feature section." };
      if (words > 4000) return { level: "ok", detail: `~${words} words — a long page.`, tip: "Long pages work if the hero answers the question first; keep sections skimmable." };
      return { level: "good", detail: `~${words} words on the page.`, tip: "Word count is in a reasonable range. Headings carry the skim — keep them descriptive." };
    }
  }
];

const LEVEL_SCORE = { good: 100, ok: 60, weak: 25 };

const scanBtn = document.getElementById("scanBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");
const overallEl = document.getElementById("overall");
const resultsEl = document.getElementById("results");

scanBtn.addEventListener("click", async () => {
  scanBtn.disabled = true;
  statusEl.textContent = "Analyzing copy…";
  resultsEl.innerHTML = "";
  overallEl.classList.add("hidden");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("No active tab.");
    if (/^(chrome|edge|about|chrome-extension):/.test(tab.url || "")) {
      throw new Error("Cannot analyze browser-internal pages.");
    }
    const [{ result: d }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: extractCopy
    });

    const outcomes = CHECKS.map(c => {
      let r;
      try { r = c.run(d); } catch (e) { r = { level: "ok", detail: "Check errored.", tip: "Re-run the analysis." }; }
      return { name: c.name, ...r };
    });
    const avg = Math.round(outcomes.reduce((a, o) => a + LEVEL_SCORE[o.level], 0) / outcomes.length);

    statusEl.textContent = `Analyzed ${d.url || "this page"}.`;
    overallEl.classList.remove("hidden");
    overallEl.innerHTML = `
      <div class="score-ring" style="--p:${avg}%">${avg}</div>
      <div class="lbl"><strong>Copy health: ${avg}</strong><br>
      Heuristic checklist — tips only, not conversion advice.</div>`;
    resultsEl.innerHTML = outcomes.map(o => `
      <div class="check">
        <div class="top">
          <span class="name">${escapeHtml(o.name)}</span>
          <span class="pill ${o.level}">${o.level.toUpperCase()}</span>
        </div>
        <div class="detail">${escapeHtml(o.detail)}</div>
        <div class="tip">${escapeHtml(o.tip)}</div>
      </div>`).join("");
  } catch (err) {
    statusEl.textContent = "Analysis failed: " + (err.message || err);
  } finally {
    scanBtn.disabled = false;
  }
});

clearBtn.addEventListener("click", () => {
  resultsEl.innerHTML = "";
  overallEl.classList.add("hidden");
  statusEl.textContent = "Click “Analyze this page”.";
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
