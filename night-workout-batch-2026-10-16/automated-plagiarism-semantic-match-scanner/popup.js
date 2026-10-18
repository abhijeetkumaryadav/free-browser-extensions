/* =====================================================================
 * Similarity Scanner — pure comparison engine (no AI, no network).
 * Heuristic: trigram overlap + longest common substring. The verdict
 * describes surface similarity only — NEVER a plagiarism verdict.
 * =================================================================== */

// ENGINE-START

/** Tokenize to lowercase words (alphanumerics only). */
function tokenize(text) {
  const m = (text || "").toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g);
  return m || [];
}

/** Build the set of word n-grams for a token array. */
function ngramSet(tokens, n) {
  const s = new Set();
  if (tokens.length < n) return s;
  for (let i = 0; i <= tokens.length - n; i++) {
    s.add(tokens.slice(i, i + n).join(" "));
  }
  return s;
}

/**
 * Compute overlap metrics between two texts.
 * @returns { pct, sharedTrigrams, totalTrigrams, wordsA, wordsB, lcsWords,
 *            lcsPhrases } — lcsPhrases are the longest shared word runs
 *            (up to 5 shown, each >= 4 words).
 */
function compareTexts(a, b) {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return null;

  const N = 3;
  const ga = ngramSet(ta, N);
  const gb = ngramSet(tb, N);
  let shared = 0;
  for (const g of ga) if (gb.has(g)) shared++;
  const total = Math.min(ga.size, gb.size) || 1;
  const pct = Math.round((shared / total) * 100);

  // Longest common substring on word tokens (O(n*m) DP, texts are short).
  const bIndex = new Map();
  tb.forEach((t, i) => { if (!bIndex.has(t)) bIndex.set(t, []); bIndex.get(t).push(i); });
  let best = 0;
  let bestPairs = [];
  for (let i = 0; i < ta.length; i++) {
    const js = bIndex.get(ta[i]);
    if (!js) continue;
    for (const j of js) {
      let k = 0;
      while (i + k < ta.length && j + k < tb.length && ta[i + k] === tb[j + k]) k++;
      if (k > best) {
        best = k;
        bestPairs = [[i, j, k]];
      } else if (k === best && k >= 4) {
        // Avoid duplicate identical spans.
        const seen = bestPairs.some(p => p[0] === i && p[1] === j);
        if (!seen) bestPairs.push([i, j, k]);
      }
    }
  }
  const lcsPhrases = best >= 4
    ? bestPairs.slice(0, 5).map(([i, , k]) => ta.slice(i, i + k).join(" "))
    : [];

  return {
    pct,
    sharedTrigrams: shared,
    totalTrigrams: total,
    wordsA: ta.length,
    wordsB: tb.length,
    lcsWords: best,
    lcsPhrases,
  };
}

/** Human bucket for the similarity percentage. */
function verdictFor(pct) {
  if (pct >= 70) return "Very high overlap";
  if (pct >= 40) return "High overlap";
  if (pct >= 15) return "Moderate overlap";
  if (pct >= 5) return "Low overlap";
  return "Little or no overlap";
}

/** Escape regex chars. */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Highlight shared phrases inside a text by wrapping them in <mark>.
 * @param {string} rawText original text
 * @param {string[]} phrases lowercased phrases to highlight
 * @param {function} esc HTML escaper
 * @returns {string} HTML
 */
function highlightPhrases(rawText, phrases, esc) {
  let html = esc(rawText);
  const sorted = [...phrases].sort((a, b) => b.length - a.length);
  for (const ph of sorted) {
    const re = new RegExp(escapeRegExp(esc(ph)), "gi");
    html = html.replace(re, (m) => `<mark>${m}</mark>`);
  }
  return html;
}

/** Basic HTML escaper. */
function escHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ENGINE-END

/* ------------------------------ UI wiring ----------------------------- */

const $ = (id) => document.getElementById(id);

function setRing(pct) {
  const ring = $("scoreRing");
  const deg = Math.round((pct / 100) * 360);
  ring.style.background = `conic-gradient(var(--accent) ${deg}deg, #2a2a33 ${deg}deg)`;
  $("scorePct").textContent = pct + "%";
}

function render() {
  const a = $("textA").value.trim();
  const b = $("textB").value.trim();
  const r = compareTexts(a, b);
  const box = $("results");
  if (!r) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  setRing(r.pct);
  $("scoreVerdict").textContent = verdictFor(r.pct);
  $("scoreDetail").textContent =
    `Shared ${r.sharedTrigrams} of ~${r.totalTrigrams} trigrams. ` +
    `This measures word overlap only — it says nothing about intent, sourcing, or plagiarism.`;
  $("statNgrams").textContent = r.sharedTrigrams;
  $("statLcs").textContent = r.lcsWords >= 4 ? r.lcsWords : "—";
  $("statWords").textContent = `${r.wordsA} / ${r.wordsB}`;
  $("hlA").innerHTML = r.lcsPhrases.length
    ? highlightPhrases(a, r.lcsPhrases, escHtml)
    : '<span style="color:var(--muted)">No shared passages of 4+ words.</span>';
  $("hlB").innerHTML = r.lcsPhrases.length
    ? highlightPhrases(b, r.lcsPhrases, escHtml)
    : '<span style="color:var(--muted)">No shared passages of 4+ words.</span>';
}

$("compareBtn").addEventListener("click", () => {
  render();
  chrome.storage.local.set({ simTextA: $("textA").value, simTextB: $("textB").value });
});
$("swapBtn").addEventListener("click", () => {
  const t = $("textA").value;
  $("textA").value = $("textB").value;
  $("textB").value = t;
  render();
});
$("clearBtn").addEventListener("click", () => {
  $("textA").value = "";
  $("textB").value = "";
  $("results").classList.add("hidden");
  chrome.storage.local.remove(["simTextA", "simTextB"]);
});

// Restore last session's texts.
chrome.storage.local.get(["simTextA", "simTextB"], (d) => {
  if (d.simTextA) $("textA").value = d.simTextA;
  if (d.simTextB) $("textB").value = d.simTextB;
});
