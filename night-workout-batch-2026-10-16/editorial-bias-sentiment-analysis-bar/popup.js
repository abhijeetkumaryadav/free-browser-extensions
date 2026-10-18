// Tone Word Counter — heuristic sentiment bar.
// Counts loaded positive/negative words from a bundled list.
// Word-count heuristic only — NOT real bias or sentiment analysis.
// Everything runs locally; no network.

// ENGINE-START
// Bundled tone-word lists (hand-written, headless-testable).
const POSITIVE_WORDS = [
  "amazing", "awesome", "brilliant", "excellent", "fantastic", "great",
  "incredible", "outstanding", "remarkable", "superb", "terrific",
  "triumph", "victory", "wonderful", "heroic", "bold", "courageous",
  "historic", "breakthrough", "innovative", "unprecedented", "stunning",
  "spectacular", "magnificent", "glorious", "beautiful", "lovely",
  "delightful", "joyful", "celebration", "praise", "applaud",
];

const NEGATIVE_WORDS = [
  "terrible", "awful", "horrible", "disastrous", "catastrophic", "dreadful",
  "shocking", "outrageous", "scandalous", "corrupt", "failed", "failure",
  "crisis", "chaos", "devastating", "alarming", "appalling", "disgusting",
  "vile", "sinister", "threat", "dangerous", "deadly", "tragic",
  "shameful", "disgraceful", "pathetic", "weak", "incompetent", "stupid",
  "ridiculous", "absurd", "lies", "lying", "fraud", "scam",
];

/** Tokenize into lowercase words (letters + apostrophes). */
function tokenize(text) {
  if (typeof text !== "string") return [];
  const m = text.toLowerCase().match(/[a-z']+/g);
  return m ? m : [];
}

/**
 * Count tone words. Returns
 * { totalWords, pos: [{word, count}], neg: [{word, count}], posTotal, negTotal }.
 */
function countToneWords(text) {
  const tokens = tokenize(text);
  const posSet = new Set(POSITIVE_WORDS);
  const negSet = new Set(NEGATIVE_WORDS);
  const posCounts = Object.create(null);
  const negCounts = Object.create(null);
  for (const t of tokens) {
    if (posSet.has(t)) posCounts[t] = (posCounts[t] || 0) + 1;
    else if (negSet.has(t)) negCounts[t] = (negCounts[t] || 0) + 1;
  }
  const toList = (obj) =>
    Object.keys(obj).sort().map(w => ({ word: w, count: obj[w] }));
  const pos = toList(posCounts);
  const neg = toList(negCounts);
  const posTotal = pos.reduce((s, x) => s + x.count, 0);
  const negTotal = neg.reduce((s, x) => s + x.count, 0);
  return { totalWords: tokens.length, pos, neg, posTotal, negTotal };
}

/** Ratio percentages for the bar; neutral remainder fills the middle. */
function ratioParts(posTotal, negTotal) {
  const sum = posTotal + negTotal;
  if (sum === 0) return { negPct: 0, posPct: 0 };
  return {
    negPct: (negTotal / sum) * 100,
    posPct: (posTotal / sum) * 100,
  };
}
// ENGINE-END

// ---------- UI wiring ----------
const textEl = document.getElementById("text");
const analyzeBtn = document.getElementById("analyzeBtn");
const clearBtn = document.getElementById("clearBtn");
const resultsEl = document.getElementById("results");
const negFill = document.getElementById("negFill");
const posFill = document.getElementById("posFill");
const negLabel = document.getElementById("negLabel");
const posLabel = document.getElementById("posLabel");
const wordCountEl = document.getElementById("wordCount");
const posList = document.getElementById("posList");
const negList = document.getElementById("negList");

const STORAGE_KEY = "twc_text";

function fillList(ul, items) {
  ul.innerHTML = "";
  if (items.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = '<span style="color:#9a9aa8">none</span>';
    ul.appendChild(li);
    return;
  }
  for (const it of items) {
    const li = document.createElement("li");
    const w = document.createElement("span");
    w.textContent = it.word;
    const c = document.createElement("span");
    c.textContent = "×" + it.count;
    li.appendChild(w);
    li.appendChild(c);
    ul.appendChild(li);
  }
}

function render(result) {
  resultsEl.classList.remove("hidden");
  const parts = ratioParts(result.posTotal, result.negTotal);
  // Bar is split: negative on the left, positive on the right.
  negFill.style.width = parts.negPct + "%";
  posFill.style.width = parts.posPct + "%";
  negLabel.textContent = `${result.negTotal} negative`;
  posLabel.textContent = `${result.posTotal} positive`;
  wordCountEl.textContent = `${result.totalWords} words scanned`;
  fillList(posList, result.pos);
  fillList(negList, result.neg);
}

analyzeBtn.addEventListener("click", () => {
  const result = countToneWords(textEl.value);
  render(result);
  chrome.storage.local.set({ [STORAGE_KEY]: textEl.value });
});

clearBtn.addEventListener("click", () => {
  textEl.value = "";
  resultsEl.classList.add("hidden");
  chrome.storage.local.remove(STORAGE_KEY);
});

chrome.storage.local.get([STORAGE_KEY], (data) => {
  if (data[STORAGE_KEY]) textEl.value = data[STORAGE_KEY];
});
