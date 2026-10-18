// ===== ENGINE-START (pure, headless-testable) =====
"use strict";

/* Claim-carrying verb phrases: a thesis normally stakes a position. */
const CLAIM_SIGNALS = [
  /\bargues?\b/i, /\bshould\b/i, /\bmust\b/i, /\bbecause\b/i, /\btherefore\b/i,
  /\bcontends?\b/i, /\bproposes?\b/i, /\bdemonstrates?\b/i, /\bshows that\b/i,
  /\bin order to\b/i, /\bwill (improve|reduce|increase|harm|benefit|cause)\b/i
];

/* Words that promise evidence is coming. */
const EVIDENCE_MARKERS = [
  "studies show", "research shows", "data show", "data suggests", "for example",
  "for instance", "according to", "evidence", "statistics", "survey",
  "case study", "experiment", "measured", "observed", "recorded"
];

/* Hedges soften a claim; a thesis built on hedges may lack conviction. */
const HEDGES = [
  "might", "could possibly", "perhaps", "maybe", "possibly", "likely",
  "tends to", "seems", "appears to", "arguably", "somewhat", "relatively"
];

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z']+/g) || []);
}

function checkClaim(text) {
  const hit = CLAIM_SIGNALS.some(re => re.test(text));
  return {
    id: "claim", title: "Claim signal",
    status: hit ? "pass" : "warn",
    detail: hit
      ? "Found a position-carrying phrase (e.g. should, because, argue). The statement reads as a claim."
      : "No obvious claim-carrying phrase found. It may read as a fact list — check that a position is stated."
  };
}

function checkEvidence(text) {
  const lower = text.toLowerCase();
  const hits = EVIDENCE_MARKERS.filter(m => lower.includes(m));
  return {
    id: "evidence", title: "Evidence markers",
    status: hits.length ? "pass" : "warn",
    detail: hits.length
      ? `Found ${hits.length} marker${hits.length > 1 ? "s" : ""} (${hits.slice(0, 3).join(", ")}).`
      : "No evidence markers (data, studies show, for example). Support may live outside the thesis — fine, just confirm."
  };
}

function checkHedges(text) {
  const words = tokenize(text);
  const lower = text.toLowerCase();
  const hedgeHits = HEDGES.filter(h => lower.includes(h)).length;
  const density = words.length ? (hedgeHits / words.length) * 100 : 0;
  let status = "pass", detail;
  if (density >= 8) {
    status = "warn";
    detail = `${density.toFixed(1)}% hedge-word density is high — the claim may read as timid. Consider committing.`;
  } else if (density > 0) {
    detail = `${density.toFixed(1)}% hedge-word density — a modest amount of hedging is normal and honest.`;
  } else {
    detail = "No hedge words detected — the claim is stated firmly. Fine, as long as it is defensible.";
  }
  return { id: "hedges", title: "Hedge-word density", status, detail };
}

function checkLength(text) {
  const n = tokenize(text).length;
  let status = "pass", detail;
  if (n < 12) {
    status = "warn";
    detail = `${n} words is very short — a full argument rarely fits in under ~12 words.`;
  } else if (n > 60) {
    status = "warn";
    detail = `${n} words is long — the claim may be buried. Consider trimming to the core position.`;
  } else {
    detail = `${n} words — a reasonable length for a thesis statement.`;
  }
  return { id: "length", title: "Length check", status, detail };
}

/* Score: pass=25, warn=10, fail=0 → 0–100. */
function lintThesis(text) {
  if (!text || !text.trim()) return null;
  const checks = [checkClaim(text), checkEvidence(text), checkHedges(text), checkLength(text)];
  const score = checks.reduce((s, c) => s + (c.status === "pass" ? 25 : 10), 0);
  const verdict = score >= 85 ? "Strong structure" : score >= 60 ? "Mostly sound" : score >= 40 ? "Could tighten" : "Needs work";
  return { checks, score, verdict };
}
// ===== ENGINE-END =====

/* ---- UI glue (browser only) ---- */
(function () {
  if (typeof chrome === "undefined" || !chrome.storage) return;
  const $ = id => document.getElementById(id);
  const thesisEl = $("thesis"), notesEl = $("notes");

  chrome.storage.local.get(["thesis", "notes"], r => {
    if (r.thesis) thesisEl.value = r.thesis;
    if (r.notes) notesEl.value = r.notes;
  });
  notesEl.addEventListener("input", () => chrome.storage.local.set({ notes: notesEl.value }));

  document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    $("guidePane").classList.toggle("hidden", t.dataset.tab !== "guide");
    $("notesPane").classList.toggle("hidden", t.dataset.tab !== "notes");
  }));

  $("checkBtn").addEventListener("click", () => {
    const text = thesisEl.value;
    chrome.storage.local.set({ thesis: text.slice(0, 5000) });
    const res = lintThesis(text);
    if (!res) return;
    $("scoreWrap").classList.remove("hidden");
    $("scoreNum").textContent = res.score;
    $("verdict").textContent = res.verdict;
    const box = $("results");
    box.classList.remove("hidden");
    box.innerHTML = "";
    for (const c of res.checks) {
      const d = document.createElement("div");
      d.className = "check " + c.status;
      d.innerHTML = `<span class="dot">${c.status === "pass" ? "✓" : "!"}</span>
        <div><b>${c.title}</b><p>${c.detail}</p></div>`;
      box.appendChild(d);
    }
  });
})();
