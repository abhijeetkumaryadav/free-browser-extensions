/* TikTok Hook Analyzer — popup logic.
   Heuristic (rule-based) hook scoring. No AI, no network. */

"use strict";

/* ------------------------------------------------------------------ */
/* ENGINE-START: pure, DOM-free scoring engine (headless-testable)     */
/* ------------------------------------------------------------------ */

// Bundled word lists used by the heuristics.
const QUESTION_STARTERS = [
  "who", "what", "when", "where", "why", "how",
  "did", "do", "does", "can", "could", "would", "should",
  "is", "are", "was", "were", "will", "have", "has", "had",
  "want", "ever", "stop"
];

const STRONG_VERBS = [
  "stop", "watch", "discover", "unlock", "reveal", "revealed",
  "secret", "secrets", "never", "always", "shocking", "insane",
  "crazy", "transform", "boost", "hack", "hacks", "win", "wins",
  "grow", "learn", "save", "earn", "free", "proven", "finally",
  "truth", "mistake", "mistakes", "avoid", "instantly", "destroy",
  "build", "create", "double", "triple", "explode", "viral",
  "guarantee", "guaranteed", "warning", "pov", "exposed", "banned"
];

const DIRECT_ADDRESS = ["you", "your", "you're", "yours", "yourself", "u "];

// Scoring weights; totals 100.
const WEIGHTS = { question: 20, number: 15, length: 25, strongVerb: 20, direct: 20 };

function tokenize(text) {
  return text.toLowerCase().replace(/[^\w\s']/g, " ").split(/\s+/).filter(Boolean);
}

function firstNonEmptyLine(script) {
  const lines = String(script).split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length);
  return lines[0] || "";
}

function isQuestion(hook, words) {
  if (/\?\s*$/.test(hook)) return true;
  const first = words[0] || "";
  if (QUESTION_STARTERS.includes(first)) return true;
  // "Have you ever...", "Did you know..."
  if ((first === "have" || first === "did" || first === "do" || first === "are" || first === "can") &&
      words[1] === "you") return true;
  return false;
}

function hasNumber(hook) {
  return /\d/.test(hook);
}

function lengthScore(words) {
  const n = words.length;
  if (n === 0) return { points: 0, band: "no hook found — paste a script" };
  if (n <= 12) return { points: 25, band: "12 or fewer — snappy" };
  if (n <= 18) return { points: 12, band: "13–18 — trim it down" };
  return { points: 0, band: "over 18 — too long for a hook" };
}

function hasStrongVerb(words) {
  const hits = words.filter((w) => STRONG_VERBS.includes(w));
  return hits;
}

function hasDirectAddress(words) {
  const hits = words.filter((w) => DIRECT_ADDRESS.includes(w.trim()));
  return hits;
}

// Main entry: returns { hook, words, score, factors, tips, verdict, stats }.
function analyzeHook(script) {
  const hook = firstNonEmptyLine(script);
  const words = tokenize(hook);
  const factors = [];
  const tips = [];

  // Factor 1: question hook.
  const q = isQuestion(hook, words);
  factors.push({
    id: "question", name: "Opens with a question",
    passed: q, points: q ? WEIGHTS.question : 0, max: WEIGHTS.question,
    desc: q ? "Questions create an open loop." : "Not phrased as a question."
  });
  if (!q) tips.push("Turn the hook into a question — e.g. start with \"Did you know...\" or end with \"?\".");

  // Factor 2: concrete number.
  const n = hasNumber(hook);
  factors.push({
    id: "number", name: "Contains a number",
    passed: n, points: n ? WEIGHTS.number : 0, max: WEIGHTS.number,
    desc: n ? "Numbers signal concrete value." : "No number found."
  });
  if (!n) tips.push("Add a concrete number — \"3 mistakes\", \"in 7 days\" — specificity earns attention.");

  // Factor 3: hook length.
  const ls = lengthScore(words);
  const lenOk = ls.points === WEIGHTS.length;
  factors.push({
    id: "length", name: "Short hook (" + words.length + " words)",
    passed: lenOk, points: ls.points, max: WEIGHTS.length,
    desc: ls.band + "."
  });
  if (!lenOk) tips.push("Cut the hook to 12 words or fewer. One idea, one line.");

  // Factor 4: strong verb / power word.
  const sv = hasStrongVerb(words);
  const svOk = sv.length > 0;
  factors.push({
    id: "strongVerb", name: "Strong verb or power word",
    passed: svOk, points: svOk ? WEIGHTS.strongVerb : 0, max: WEIGHTS.strongVerb,
    desc: svOk ? "Found: " + sv.slice(0, 3).join(", ") + "." : "No power words found."
  });
  if (!svOk) tips.push("Add a power word — \"stop\", \"secret\", \"proven\", \"warning\" — to raise the stakes.");

  // Factor 5: direct address.
  const da = hasDirectAddress(words);
  const daOk = da.length > 0;
  factors.push({
    id: "direct", name: "Speaks to the viewer",
    passed: daOk, points: daOk ? WEIGHTS.direct : 0, max: WEIGHTS.direct,
    desc: daOk ? "Addresses the viewer directly." : "Does not address the viewer."
  });
  if (!daOk) tips.push("Talk to the viewer — use \"you\" / \"your\" so it feels personal.");

  const score = factors.reduce((s, f) => s + f.points, 0);

  let verdict, vclass;
  if (score >= 80)      { verdict = "Strong hook";   vclass = "strong"; }
  else if (score >= 60) { verdict = "Good — tweak 1–2 things"; vclass = "good"; }
  else if (score >= 40) { verdict = "Needs work";    vclass = "work"; }
  else                  { verdict = "Rewrite the hook"; vclass = "rewrite"; }

  const allWords = tokenize(String(script));
  const stats = {
    hookWords: words.length,
    totalWords: allWords.length,
    lines: String(script).split(/\r?\n/).filter((l) => l.trim()).length,
    estSeconds: Math.round((allWords.length / 150) * 60) // ~150 wpm speech
  };

  return { hook, words, score, factors, tips, verdict, vclass, stats };
}
/* ENGINE-END */
/* ------------------------------------------------------------------ */

/* ------------------------- UI wiring ------------------------------ */

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "ttha_last_script";

const CHECK_SVG = '<svg class="mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8 12.5 2.5 2.5L16 9.5"/></svg>';
const CROSS_SVG = '<svg class="mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m9 9 6 6M15 9l-6 6"/></svg>';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function render(result) {
  $("results").classList.remove("hidden");

  // Score ring.
  const C = 2 * Math.PI * 34;
  $("ringFg").style.strokeDashoffset = String(C * (1 - result.score / 100));
  $("scoreNum").textContent = result.score;
  const v = $("verdict");
  v.textContent = result.verdict;
  v.className = "verdict " + result.vclass;
  $("hookLine").textContent = result.hook ? "\u201C" + result.hook + "\u201D" : "No hook found — paste a script first.";

  // Factors.
  $("factors").innerHTML = result.factors.map((f) =>
    '<li class="factor ' + (f.passed ? "pass" : "fail") + '">' +
    (f.passed ? CHECK_SVG : CROSS_SVG) +
    '<div class="f-body"><div class="f-name">' + escapeHtml(f.name) + '</div>' +
    '<div class="f-desc">' + escapeHtml(f.desc) + '</div></div>' +
    '<div class="f-pts">' + f.points + '/' + f.max + '</div></li>'
  ).join("");

  // Tips.
  $("tips").innerHTML = result.tips.length
    ? result.tips.map((t) => "<li>" + escapeHtml(t) + "</li>").join("")
    : '<li class="none">All factors pass — this hook is in great shape.</li>';

  // Stats.
  const s = result.stats;
  $("stats").innerHTML =
    stat("Hook words", s.hookWords) + stat("Script words", s.totalWords) +
    stat("Lines", s.lines) + stat("Est. runtime", s.estSeconds + "s");
}

function stat(k, val) {
  return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + val + "</div></div>";
}

document.addEventListener("DOMContentLoaded", () => {
  // Restore last script.
  chrome.storage.local.get([STORAGE_KEY], (data) => {
    if (data[STORAGE_KEY]) $("script").value = data[STORAGE_KEY];
  });

  $("analyze").addEventListener("click", () => {
    const text = $("script").value;
    chrome.storage.local.set({ [STORAGE_KEY]: text });
    render(analyzeHook(text));
  });
});
