// ============================================================================
// FALLACY ENGINE — heuristic pattern-based fallacy signal scanning.
// Pure logic between ENGINE markers; headless-testable in Node.
// ============================================================================
// ENGINE-START
// Each fallacy: display name, plain-language explanation, weighted regex signals.
const FALLACIES = [
  {
    id: "ad-hominem",
    name: "Ad Hominem",
    weight: 25,
    desc: "Attacks the person instead of their argument. Watch for name-calling or dismissing an idea because of who said it.",
    signals: [
      /\b(you('re|’re)?|he|she|they)( are|\'re)?\s+(an?\s+)?(idiot|stupid|moron|liar|fool|hypocrite|fraud|clown|ignorant|dumb)\b/i,
      /\btypical\s+(liberal|conservative|leftist|right[- ]?winger|millennial|boomer)\b/i,
      /\bof course (you|he|she|they)(\'d| would)\b/i
    ]
  },
  {
    id: "strawman",
    name: "Strawman",
    weight: 25,
    desc: "Misrepresents the other side's position to make it easier to attack. Watch for exaggerated restatements of what 'they' supposedly believe.",
    signals: [
      /\bso you(\'re| are)? (basically )?saying\b/i,
      /\bwhat (you|they)( really| actually) mean(t)? is\b/i,
      /\b(people|they) (like you )?just want\b/i,
      /\bno one (is|was) (actually )?arguing\b/i
    ]
  },
  {
    id: "appeal-authority",
    name: "Appeal to Authority",
    weight: 15,
    desc: "Treats a claim as true because an authority said it. Experts can be wrong or out of their field — check the evidence itself.",
    signals: [
      /\b(scientists|experts|doctors|studies) say\b/i,
      /\btrust the (science|experts|authorities)\b/i,
      /\ba (famous|renowned|leading) (scientist|doctor|professor) (said|says)\b/i,
      /\beveryone knows\b/i
    ]
  },
  {
    id: "slippery-slope",
    name: "Slippery Slope",
    weight: 20,
    desc: "Claims one step will inevitably lead to an extreme outcome without evidence for the chain. Watch for 'then' cascades and 'before you know it'.",
    signals: [
      /\bbefore you know it\b/i,
      /\b(then|and) (next|soon|before long)\b/i,
      /\bslippery slope\b/i,
      /\bwhere does it (end|stop)\b/i,
      /\bgive (them|an inch).*(take|mile)/i
    ]
  },
  {
    id: "false-dilemma",
    name: "False Dilemma",
    weight: 20,
    desc: "Presents only two options when more exist. Watch for 'either/or' framing that ignores middle ground.",
    signals: [
      /\beither .{0,60} or .{0,60}[.?!]/i,
      /\byou(\'re| are) (either|with us or against us)\b/i,
      /\bno (middle|third) (ground|option)\b/i,
      /\bonly two (choices|options)\b/i
    ]
  },
  {
    id: "hasty-generalization",
    name: "Hasty Generalization",
    weight: 15,
    desc: "Draws a broad rule from a tiny sample. Watch for 'all', 'every', 'always', 'never' doing heavy lifting.",
    signals: [
      /\b(all|every|always|never)\s+(politicians|men|women|scientists|doctors|journalists|teachers)\b/i,
      /\b(my|one) (friend|neighbor|cousin).*(so|therefore|proves?)\b/i
    ]
  },
  {
    id: "circular",
    name: "Circular Reasoning",
    weight: 15,
    desc: "The conclusion is just the premise restated. Watch for 'because' clauses that repeat the claim in different words.",
    signals: [
      /\bbecause (it|that)(\'s| is) (just |simply )?(true|right|wrong|false)\b/i,
      /\bit(\'s| is) (true|right) because\b/i
    ]
  },
  {
    id: "appeal-emotion",
    name: "Appeal to Emotion",
    weight: 15,
    desc: "Manipulates feelings instead of giving reasons. Watch for fear-mongering, outrage bait, or guilt trips standing in for evidence.",
    signals: [
      /\b(think of|what about) the children\b/i,
      /\bbe (afraid|scared|terrified)\b/i,
      /\b(shame on|disgusting|outrageous)\b/i,
      /\byou should feel\b/i
    ]
  },
  {
    id: "bandwagon",
    name: "Bandwagon",
    weight: 10,
    desc: "Claims something is true or good because many people believe it. Popularity is not evidence.",
    signals: [
      /\b(millions|everyone|most people) (agree|believe|think|use)\b/i,
      /\bjoin the (movement|crowd|majority)\b/i,
      /\b(get|jump) on board\b/i
    ]
  },
  {
    id: "red-herring",
    name: "Red Herring",
    weight: 10,
    desc: "Introduces an irrelevant topic to dodge the actual argument. Watch for abrupt subject changes mid-debate.",
    signals: [
      /\b(that|this) (has|have) nothing to do with\b/i,
      /\bwhat about\b/i,
      /\b(let|let\'s) (not |forget )talk about\b/i
    ]
  }
];

// Extract a ~80-char snippet around a match index.
function snippet(text, idx, len) {
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + len + 30);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end).replace(/\s+/g, " ").trim() + suffix;
}

// Scan text; returns { score, hits: [{id,name,desc,weight,count,snippets}] }.
function scanText(text) {
  const hits = [];
  const t = String(text || "");
  if (!t.trim()) return { score: 0, hits };
  let score = 0;
  for (const f of FALLACIES) {
    const snippets = [];
    for (const re of f.signals) {
      const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      let m;
      while ((m = g.exec(t)) !== null && snippets.length < 3) {
        snippets.push(snippet(t, m.index, m[0].length));
        if (m[0].length === 0) g.lastIndex++;
      }
    }
    if (snippets.length > 0) {
      const add = Math.min(f.weight + (snippets.length - 1) * 5, 40);
      score += add;
      hits.push({ id: f.id, name: f.name, desc: f.desc, count: snippets.length, snippets });
    }
  }
  return { score: Math.min(score, 100), hits: hits.sort((a, b) => b.count - a.count) };
}

// Verdict bucket for a score.
function verdictFor(score) {
  if (score === 0) return "Clean";
  if (score <= 25) return "Mild signals";
  if (score <= 55) return "Somewhat fallacious";
  return "Very fallacious";
}
// ENGINE-END
// ============================================================================

// --- Popup wiring (browser only) ---------------------------------------------
(function () {
  if (typeof document === "undefined") return;
  const input = document.getElementById("input");
  const scanBtn = document.getElementById("scanBtn");
  const results = document.getElementById("results");
  const scoreNum = document.getElementById("scoreNum");
  const verdictEl = document.getElementById("verdict");
  const signalCount = document.getElementById("signalCount");
  const hitsEl = document.getElementById("hits");

  // Remember last pasted text.
  try {
    chrome.storage.local.get(["lastText"], (d) => { if (d.lastText) input.value = d.lastText; });
  } catch (e) { /* storage unavailable */ }

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  scanBtn.addEventListener("click", () => {
    const text = input.value;
    try { chrome.storage.local.set({ lastText: text }); } catch (e) { /* ignore */ }
    const { score, hits } = scanText(text);
    scoreNum.textContent = score;
    verdictEl.textContent = verdictFor(score);
    const total = hits.reduce((n, h) => n + h.count, 0);
    signalCount.textContent = hits.length
      ? `${total} signal${total === 1 ? "" : "s"} across ${hits.length} categor${hits.length === 1 ? "y" : "ies"}`
      : "No heuristic signals matched.";
    hitsEl.innerHTML = "";
    for (const h of hits) {
      const div = document.createElement("div");
      div.className = "hit";
      div.innerHTML =
        '<div class="hit-head"><span class="hit-name">' + esc(h.name) + '</span>' +
        '<span class="hit-count">' + h.count + " signal" + (h.count === 1 ? "" : "s") + "</span></div>" +
        '<div class="hit-desc">' + esc(h.desc) + "</div>" +
        h.snippets.map((s) => '<div class="hit-snippet">"' + esc(s) + '"</div>').join("");
      hitsEl.appendChild(div);
    }
    results.classList.remove("hidden");
  });
})();
