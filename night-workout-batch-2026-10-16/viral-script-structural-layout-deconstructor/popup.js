/* Script Deconstructor — heuristic segmentation engine (rule-based, NOT AI). */
"use strict";

// ================= ENGINE-START =================

// Phrases that mark a closing call-to-action (checked near the end of the script).
const CTA_PHRASES = [
  "subscribe", "follow", "link in bio", "comment below", "hit the bell",
  "like and share", "check out the link", "dm me", "share this",
  "smash that like", "turn on notifications", "join the channel"
];

// Markers that suggest a paragraph carries the payoff / resolution.
const PAYOFF_MARKERS = [
  "here's what happened", "heres what happened", "the result", "finally",
  "in the end", "that's why", "thats why", "it turns out", "the twist",
  "long story short", "and that's how", "here's the thing"
];

// Words that suggest a bold statement-style hook.
const HOOK_TRIGGERS = [
  "stop", "nobody", "what if", "secret", "you won't believe", "pov",
  "watch this", "don't scroll", "nobody talks about", "the truth about"
];

/** Split raw text into non-empty paragraphs (one beat per line). */
function splitParagraphs(text) {
  return text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

/** Count words in a string. */
function countWords(s) {
  const m = s.match(/\S+/g);
  return m ? m.length : 0;
}

/** True if the paragraph contains any phrase from the list (case-insensitive). */
function containsAny(paragraph, phrases) {
  const low = paragraph.toLowerCase();
  return phrases.some((p) => low.includes(p));
}

/** Classify the opening paragraph's hook style. */
function detectHookType(first) {
  if (!first) return "unknown";
  if (first.includes("?")) return "question";
  if (containsAny(first, HOOK_TRIGGERS)) return "statement";
  return "unknown";
}

/**
 * Heuristically segment paragraphs into Hook / Setup / Payoff / CTA.
 * Convention: closing paragraphs containing CTA phrases -> CTA;
 * first paragraph(s) -> Hook; payoff markers -> Payoff; rest -> Setup.
 */
function segment(paragraphs) {
  // 1) CTA: collect from the end while paragraphs carry CTA phrases.
  const cta = [];
  let i = paragraphs.length - 1;
  while (i >= 0 && containsAny(paragraphs[i], CTA_PHRASES)) {
    cta.unshift(paragraphs[i]);
    i--;
  }
  const rest = paragraphs.slice(0, i + 1);

  // 2) Hook: first paragraph, plus the second when the first is very short.
  const hook = [];
  if (rest.length > 0) {
    hook.push(rest[0]);
    if (countWords(rest[0]) < 12 && rest.length > 1) hook.push(rest[1]);
  }
  const middle = rest.slice(hook.length);

  // 3) Middle: payoff markers -> Payoff, everything else -> Setup.
  const setup = [];
  const payoff = [];
  for (const p of middle) {
    if (containsAny(p, PAYOFF_MARKERS)) payoff.push(p);
    else setup.push(p);
  }

  const sections = [
    { name: "Hook", color: "#fb923c", paras: hook },
    { name: "Setup", color: "#38bdf8", paras: setup },
    { name: "Payoff", color: "#34d399", paras: payoff },
    { name: "CTA", color: "#f472b6", paras: cta }
  ].filter((s) => s.paras.length > 0);

  for (const s of sections) s.words = s.paras.reduce((n, p) => n + countWords(p), 0);
  return sections;
}
// ================= ENGINE-END =================

// ---------- UI wiring ----------
const input = document.getElementById("scriptInput");
const results = document.getElementById("results");

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render() {
  const text = input.value.trim();
  const paras = splitParagraphs(text);
  if (!paras.length) {
    results.innerHTML = '<div class="empty">Paste a script above to see its structure.</div>';
    return;
  }
  const sections = segment(paras);
  const totalWords = sections.reduce((n, s) => n + s.words, 0);
  const minutes = Math.max(1, Math.round((totalWords / 150) * 10) / 10);
  const hookType = sections.length && sections[0].name === "Hook"
    ? detectHookType(sections[0].paras[0]) : "unknown";

  let html = '<div class="card"><div class="stats">' +
    '<div class="stat"><div class="n">' + totalWords + '</div><div class="l">words</div></div>' +
    '<div class="stat"><div class="n">' + sections.length + '</div><div class="l">sections</div></div>' +
    '<div class="stat"><div class="n">~' + minutes + 'm</div><div class="l">est. runtime</div></div>' +
    "</div></div>";

  for (const s of sections) {
    const pct = totalWords ? Math.round((s.words / totalWords) * 100) : 0;
    const preview = esc(s.paras[0].slice(0, 140)) + (s.paras[0].length > 140 ? "…" : "");
    const badge = s.name === "Hook"
      ? '<span class="hook-type">' + hookType + " hook</span>" : "";
    html += '<div class="card section">' +
      '<div class="sec-head"><div class="sec-name">' +
      '<span class="sec-dot" style="background:' + s.color + '"></span>' + s.name + badge +
      '</div><div class="sec-meta">' + s.words + " words · " + pct + "%</div></div>" +
      '<div class="bar"><div style="width:' + pct + "%;background:" + s.color + '"></div></div>' +
      '<div class="preview">“' + preview + "”</div>" +
      (s.paras.length > 1 ? '<div class="sec-meta" style="margin-top:6px">+' + (s.paras.length - 1) + " more beat(s)</div>" : "") +
      "</div>";
  }
  results.innerHTML = html;
}

document.getElementById("analyzeBtn").addEventListener("click", () => {
  render();
  try { chrome.storage.local.set({ lastScript: input.value }); } catch (e) { /* optional */ }
});
document.getElementById("clearBtn").addEventListener("click", () => {
  input.value = "";
  results.innerHTML = "";
  try { chrome.storage.local.remove("lastScript"); } catch (e) { /* optional */ }
});

// Restore the last pasted script (local convenience, never transmitted).
try {
  chrome.storage.local.get("lastScript", (d) => {
    if (d && d.lastScript) { input.value = d.lastScript; render(); }
  });
} catch (e) { /* storage unavailable */ }
