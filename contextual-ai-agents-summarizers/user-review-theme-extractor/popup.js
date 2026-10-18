// Review Theme Extractor — on-device keyword-based theme mining.
// Heuristic: keyword lists per theme + positive/negative lexicons.
// Clearly labeled as heuristic, never AI.

const THEMES = [
  { id: "battery", color: "#4ade80", keywords: ["battery", "charge", "charging", "lasts", "power", "drain"] },
  { id: "shipping", color: "#60a5fa", keywords: ["shipping", "delivery", "arrived", "package", "shipped", "tracking", "dispatch"] },
  { id: "quality", color: "#14b8a6", keywords: ["quality", "durable", "sturdy", "cheap", "flimsy", "broke", "broken", "solid", "premium"] },
  { id: "price", color: "#f5a623", keywords: ["price", "expensive", "cheap", "worth", "value", "cost", "overpriced", "affordable"] },
  { id: "design", color: "#c084fc", keywords: ["design", "look", "beautiful", "ugly", "style", "color", "sleek", "aesthetic"] },
  { id: "performance", color: "#f06666", keywords: ["fast", "slow", "performance", "speed", "lag", "responsive", "smooth"] },
  { id: "ease of use", color: "#94a3b8", keywords: ["easy", "simple", "complicated", "setup", "install", "intuitive", "confusing"] },
  { id: "customer service", color: "#fb7185", keywords: ["support", "service", "refund", "return", "seller", "warranty", "helpful", "rude"] },
  { id: "packaging", color: "#a3e635", keywords: ["packaging", "box", "packed", "damaged", "sealed"] },
];

const POSITIVE = ["love", "great", "excellent", "amazing", "perfect", "awesome", "impressed", "happy", "recommend", "best", "good", "fantastic", "wonderful", "fast", "smooth", "easy", "beautiful", "worth", "solid", "premium", "lasts"];
const NEGATIVE = ["hate", "terrible", "awful", "bad", "worst", "poor", "disappointed", "broke", "broken", "cheap", "flimsy", "slow", "lag", "forever", "never", "rude", "damaged", "overpriced", "waste", "regret"];

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  $("extract").addEventListener("click", extract);
  $("demo").addEventListener("click", () => { $("reviews").value = DEMO; extract(); });
});

const DEMO = [
  "Battery lasts two full days, really impressed with the endurance.",
  "Shipping took three weeks, way too slow for the price I paid.",
  "Build quality feels premium and solid, worth every penny.",
  "It looks beautiful on my desk, the design is so sleek.",
  "Battery drains overnight even when idle, very disappointed.",
  "Customer support was rude and refused my refund request.",
  "Setup was easy and intuitive, running in five minutes.",
  "Packaging arrived damaged but the product itself works fine.",
].join("\n");

function tokenize(text) {
  return text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

function sentimentOf(text) {
  const toks = tokenize(text);
  let pos = 0, neg = 0;
  for (const t of toks) {
    if (POSITIVE.includes(t)) pos++;
    if (NEGATIVE.includes(t)) neg++;
  }
  return { pos, neg };
}

function extract() {
  const raw = $("reviews").value.trim();
  const reviews = raw.split(/\r?\n/).map((r) => r.trim()).filter((r) => r.length > 3);
  if (!reviews.length) {
    $("results").hidden = true;
    return;
  }
  // score each review against each theme
  const hits = THEMES.map((theme) => {
    const matched = [];
    for (const rev of reviews) {
      const toks = new Set(tokenize(rev));
      const count = theme.keywords.filter((k) => toks.has(k)).length;
      if (count > 0) {
        matched.push({ rev, count, ...sentimentOf(rev) });
      }
    }
    return { theme, matched };
  }).filter((h) => h.matched.length > 0);

  // sort by mention count desc
  hits.sort((a, b) => b.matched.length - a.matched.length);

  $("rcount").textContent = `· ${reviews.length} reviews · ${hits.length} themes`;
  const box = $("themes");
  box.innerHTML = "";
  $("results").hidden = false;

  for (const { theme, matched } of hits) {
    const wrap = document.createElement("div");
    wrap.className = "theme";

    const head = document.createElement("div");
    head.className = "theme-head";
    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.background = theme.color;
    const name = document.createElement("b");
    name.textContent = theme.id;
    const n = document.createElement("div");
    n.className = "n";
    n.textContent = `${matched.length} mention${matched.length > 1 ? "s" : ""}`;
    head.append(dot, name, n);

    // sentiment lean across matched reviews
    const pos = matched.reduce((a, m) => a + m.pos, 0);
    const neg = matched.reduce((a, m) => a + m.neg, 0);
    const total = pos + neg;
    const pctPos = total ? Math.round((pos / total) * 100) : 50;
    const lean = total === 0 ? "No clear lean" :
      pctPos >= 65 ? "Mostly positive" : pctPos <= 35 ? "Mostly negative" : "Mixed";

    const senti = document.createElement("div");
    senti.className = "senti";
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("i");
    fill.style.width = pctPos + "%";
    bar.appendChild(fill);
    const lbl = document.createElement("span");
    lbl.textContent = `${lean} (${pctPos}% positive)`;
    senti.append(bar, lbl);

    wrap.append(head, senti);

    // example quotes: strongest matches, balanced pos/neg when possible
    const quotes = [...matched].sort((a, b) => b.count - a.count).slice(0, 3);
    for (const q of quotes) {
      const el = document.createElement("div");
      el.className = "quote";
      el.textContent = "“" + q.rev + "”";
      wrap.appendChild(el);
    }
    box.appendChild(wrap);
  }

  // persist so the popup keeps results while open; lightweight
  try { sessionStorage.setItem("rte-reviews", raw); } catch (e) {}
}

// restore pasted text if popup reopened in same session
document.addEventListener("DOMContentLoaded", () => {
  try {
    const prev = sessionStorage.getItem("rte-reviews");
    if (prev) $("reviews").value = prev;
  } catch (e) {}
});
