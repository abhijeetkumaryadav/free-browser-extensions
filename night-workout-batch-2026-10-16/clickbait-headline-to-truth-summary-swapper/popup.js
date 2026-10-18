// Clickbait Signal Scanner — heuristic headline checker.
// Everything runs locally; no AI, no network.

// ENGINE-START
// Heuristic clickbait-signal engine (pure functions, headless-testable).

// Each signal: { id, label, weight, test(text)->match detail or null }
const CLICKBAIT_PATTERNS = [
  { id: "curiosity-gap", label: "Curiosity-gap phrase", weight: 25,
    re: /(you won'?t believe|what happened next|the truth about|the reason why|this is why|they don'?t want you to know|shocking)/i,
    hint: "classic curiosity-gap language" },
  { id: "exclamation", label: "Exclamation marks", weight: 15,
    re: /!{2,}|(![^\n]{0,60})/,
    hint: "excessive / any exclamation" },
  { id: "all-caps", label: "ALL-CAPS words", weight: 15,
    re: /\b[A-Z]{4,}\b/,
    hint: "shouty capitalized words" },
  { id: "listicle", label: "Listicle number", weight: 15,
    re: /^\s*\d+\s+(reasons|things|ways|facts|photos|pictures|secrets|tricks|tips|hacks|signs)/i,
    hint: "\"N things/ways/reasons\" opener" },
  { id: "question-bait", label: "Question bait", weight: 10,
    re: /\?/,
    hint: "poses a question to the reader" },
  { id: "number-bait", label: "Number bait", weight: 10,
    re: /\b\d+(\.\d+)?\b/,
    hint: "digits used as a hook" },
  { id: "urgency", label: "Urgency / FOMO", weight: 10,
    re: /(before it'?s too late|limited time|breaking|urgent|now or never|just in|don'?t miss)/i,
    hint: "urgency / fear-of-missing-out words" },
  { id: "superlative", label: "Superlative hype", weight: 8,
    re: /(best ever|worst ever|most (amazing|shocking|incredible)|unbelievable|insane|crazy|mind-?blowing)/i,
    hint: "hype superlatives" },
];

/**
 * Score a headline. Returns { score (0-100), signals: [{label, detail, points}] }.
 */
function scanHeadline(text) {
  if (typeof text !== "string") return { score: 0, signals: [] };
  const t = text.trim();
  const signals = [];
  if (!t) return { score: 0, signals: [] };
  for (const p of CLICKBAIT_PATTERNS) {
    const m = t.match(p.re);
    if (m) {
      signals.push({ id: p.id, label: p.label, detail: p.hint, points: p.weight });
    }
  }
  // Cap the raw total at 100.
  const raw = signals.reduce((s, x) => s + x.points, 0);
  return { score: Math.min(100, raw), signals };
}

/** Verdict bucket for a score. */
function verdictFor(score) {
  if (score >= 70) return "Very clickbaity";
  if (score >= 40) return "Somewhat clickbaity";
  if (score >= 15) return "Mild signals";
  return "Calm headline";
}
// ENGINE-END

// ---------- UI wiring ----------
const headlineEl = document.getElementById("headline");
const rewriteEl = document.getElementById("rewrite");
const scanBtn = document.getElementById("scanBtn");
const clearBtn = document.getElementById("clearBtn");
const resultsEl = document.getElementById("results");
const scoreNumEl = document.getElementById("scoreNum");
const verdictEl = document.getElementById("verdict");
const signalsEl = document.getElementById("signals");

const STORAGE_KEYS = { headline: "cb_headline", rewrite: "cb_rewrite" };

function render(result) {
  resultsEl.classList.remove("hidden");
  scoreNumEl.textContent = result.score;
  verdictEl.textContent = verdictFor(result.score);
  signalsEl.innerHTML = "";
  if (result.signals.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = '<span class="none">No clickbait signals detected. Plain headline.</span>';
    signalsEl.appendChild(li);
    return;
  }
  for (const s of result.signals) {
    const li = document.createElement("li");
    const left = document.createElement("span");
    left.innerHTML = `<strong>${escapeHtml(s.label)}</strong><br><span style="color:#9a9aa8">${escapeHtml(s.detail)}</span>`;
    const pts = document.createElement("span");
    pts.className = "pts";
    pts.textContent = `+${s.points}`;
    li.appendChild(left);
    li.appendChild(pts);
    signalsEl.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

scanBtn.addEventListener("click", () => {
  const result = scanHeadline(headlineEl.value);
  render(result);
  chrome.storage.local.set({ [STORAGE_KEYS.headline]: headlineEl.value });
});

clearBtn.addEventListener("click", () => {
  headlineEl.value = "";
  resultsEl.classList.add("hidden");
  chrome.storage.local.remove(STORAGE_KEYS.headline);
});

// Persist the rewrite as the user types.
let rewriteTimer = null;
rewriteEl.addEventListener("input", () => {
  clearTimeout(rewriteTimer);
  rewriteTimer = setTimeout(() => {
    chrome.storage.local.set({ [STORAGE_KEYS.rewrite]: rewriteEl.value });
  }, 400);
});

// Restore saved values on open.
chrome.storage.local.get([STORAGE_KEYS.headline, STORAGE_KEYS.rewrite], (data) => {
  if (data[STORAGE_KEYS.headline]) headlineEl.value = data[STORAGE_KEYS.headline];
  if (data[STORAGE_KEYS.rewrite]) rewriteEl.value = data[STORAGE_KEYS.rewrite];
});
