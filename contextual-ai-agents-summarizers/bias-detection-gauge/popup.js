// Bias Detection Gauge — popup logic. Fully on-device heuristic.
// IMPORTANT: this flags word-choice patterns only; it is NOT a verdict on truth.

const SIGNALS = [
  {
    id: "absolutist",
    label: "Absolutist",
    weight: 2,
    hint: "All-or-nothing words that erase nuance.",
    terms: ["always", "never", "everyone", "nobody", "no one", "everybody", "nothing",
      "entirely", "completely", "totally", "absolutely", "definitely", "undoubtedly",
      "impossible", "inevitable", "every single", "all of them", "none of them"],
  },
  {
    id: "loaded",
    label: "Loaded language",
    weight: 3,
    hint: "Emotionally charged words that push a feeling rather than a fact.",
    terms: ["corrupt", "evil", "stupid", "idiotic", "pathetic", "disgusting", "horrific",
      "terrible", "awful", "outrageous", "shameful", "sickening", "despicable",
      "insane", "horrible", "atrocious", "monstrous", "wonderful", "amazing",
      "incredible", "perfect", "flawless", "brilliant", "phenomenal", "best ever",
      "worst ever", "stunning", "shocking", "unbelievable"],
  },
  {
    id: "framing",
    label: "One-sided framing",
    weight: 2.5,
    hint: "Phrases that present opinion as settled consensus.",
    terms: ["the truth is", "everyone knows", "obviously", "wake up", "so-called",
      "fake news", "propaganda", "no doubt", "without question", "end of story",
      "trust me", "believe me", "sheeple", "mainstream media"],
  },
];

const $ = (id) => document.getElementById(id);
const ARC_LEN = 251.3; // length of the semicircle path

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("analyze").addEventListener("click", analyze);
  $("clear").addEventListener("click", async () => {
    $("text").value = "";
    $("result").hidden = true;
    await chrome.storage.local.remove(["biasText", "biasResult"]);
  });
  // restore last session
  const { biasText } = await chrome.storage.local.get("biasText");
  if (biasText) { $("text").value = biasText; analyze(); }
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scan(text) {
  const lower = " " + text.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ") + " ";
  const findings = [];
  let weight = 0;
  // longest terms first so "everyone knows" claims its range before "everyone" can
  const all = [];
  for (const sig of SIGNALS) for (const term of sig.terms) all.push({ sig, term });
  all.sort((a, b) => b.term.length - a.term.length);
  const taken = []; // claimed [start,end] ranges, to avoid double-counting overlaps
  for (const { sig, term } of all) {
    const re = new RegExp(`(?<![a-z0-9'])${escapeRe(term)}(?![a-z0-9'])`, "g");
    let m, count = 0;
    while ((m = re.exec(lower)) !== null) {
      const s = m.index, e = s + m[0].length;
      if (taken.some(([a, b]) => s < b && e > a)) continue;
      taken.push([s, e]);
      count++;
    }
    if (count) {
      findings.push({ phrase: term, category: sig.label, count, hint: sig.hint });
      weight += sig.weight * count;
    }
  }
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const density = words ? weight / words : 0;
  const score = Math.min(100, Math.round(density * 600));
  return { score, words, findings: findings.sort((a, b) => b.count - a.count) };
}

function verdictFor(score) {
  if (score <= 15) return "Low signal — reads fairly neutral";
  if (score <= 40) return "Moderate signal — some charged wording";
  if (score <= 70) return "Elevated signal — noticeably slanted";
  return "Strong signal — heavily loaded wording";
}

async function analyze() {
  const text = $("text").value;
  const btn = $("analyze");
  btn.disabled = true;
  try {
    if (text.trim().split(/\s+/).filter(Boolean).length < 10) {
      $("result").hidden = true;
      return;
    }
    const r = scan(text);
    render(r);
    await chrome.storage.local.set({ biasText: text.slice(0, 20000) });
  } finally {
    btn.disabled = false;
  }
}

function render(r) {
  $("result").hidden = false;
  $("scoreNum").textContent = r.score;
  $("verdict").textContent = verdictFor(r.score);
  // gauge: arc fill + needle rotation (0 = left, 100 = right)
  $("arc").setAttribute("stroke-dashoffset", String(ARC_LEN * (1 - r.score / 100)));
  $("needle").setAttribute("transform", `rotate(${-90 + (r.score / 100) * 180} 100 100)`);
  const box = $("findings");
  box.innerHTML = "";
  if (!r.findings.length) {
    const d = document.createElement("div");
    d.className = "noflag";
    d.textContent = `No flagged phrases in ${r.words} words.`;
    box.appendChild(d);
    return;
  }
  for (const f of r.findings) {
    const row = document.createElement("div");
    row.className = "finding";
    row.title = f.hint;
    const p = document.createElement("span");
    p.className = "phrase";
    p.textContent = f.phrase + (f.count > 1 ? ` ×${f.count}` : "");
    const c = document.createElement("span");
    c.className = "chip";
    c.textContent = f.category;
    row.append(p, c);
    box.appendChild(row);
  }
}
