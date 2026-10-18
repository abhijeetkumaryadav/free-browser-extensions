// Opinion Sentiment Aggregator — on-device LEXICON heuristic.
// This is a word-list based estimate, not machine learning. Results are
// indicative only: sarcasm, slang and domain jargon may be misread.

const POS = new Set("love loved loves amazing awesome excellent great fantastic wonderful brilliant superb outstanding terrific fabulous incredible delightful pleasant happy glad pleased thrilled satisfied impressed smooth fast easy simple clean beautiful perfect nice good best better affordable reliable sturdy sleek powerful smart clever helpful useful worth recommend recommended five-star flawless seamless sturdy durable premium".split(" "));
const NEG = new Set("hate hated hates terrible awful horrible worst poor bad ugly broken cheap flimsy slow laggy buggy crash crashes defect defective disappointing disappointed waste regret regrettable useless worthless overpriced expensive fragile weak dull boring confusing complicated hard difficult painful annoying frustrating irritating scam fake faulty return returned refund junk trash mediocre meh".split(" "));
const BOOST = new Set(["very","really","extremely","so","too","absolutely","completely","totally","highly","incredibly","quite","pretty"]);
const NEGATORS = new Set(["not","no","never","without","hardly","barely","rarely","seldom","neither","nor"]);
const STOP = new Set("the a an and or of to in on for with is are was were it its this that these those as at by from be been i you he she we they my your his her our their me him us them".split(" "));

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("analyze").addEventListener("click", analyze);
  $("clear").addEventListener("click", () => { $("input").value = ""; $("results").hidden = true; });
  renderHistory();
}

// --- Lexicon scoring -------------------------------------------------------

function tokenize(text) {
  return text.toLowerCase().replace(/n't\b/g, " not").match(/[a-z']+/g) || [];
}

function score(text) {
  const toks = tokenize(text);
  let p = 0, n = 0, negWindow = 0, boost = 1;
  for (const t of toks) {
    if (NEGATORS.has(t)) { negWindow = 3; continue; }
    if (BOOST.has(t)) { boost = 1.6; continue; }
    let v = 0;
    if (POS.has(t)) v = 1;
    else if (NEG.has(t)) v = -1;
    if (v !== 0) {
      if (negWindow > 0) v = -v;
      v *= boost;
      if (v > 0) p += v; else n += -v;
      negWindow = 0; boost = 1;
    } else if (negWindow > 0) {
      negWindow--;
      if (!STOP.has(t)) { /* keep window for next content word */ }
    }
  }
  // exclamation adds a touch of intensity
  const excl = (text.match(/!/g) || []).length;
  const denom = Math.max(p + n, 1);
  let polarity = (p - n) / denom;
  polarity = Math.max(-1, Math.min(1, polarity + Math.sign(polarity) * excl * 0.03));
  return { polarity, magnitude: (p + n) / Math.max(toks.length, 1) };
}

function label(polarity) {
  if (polarity > 0.2) return "positive";
  if (polarity < -0.2) return "negative";
  return "neutral";
}

function splitOpinions(raw) {
  // blank-line blocks first, then single newlines inside each block,
  // so mixed "one per line" and "blank-line separated" input both work
  const parts = raw
    .split(/\n\s*\n/)
    .flatMap((b) => b.split(/\n/))
    .map((b) => b.trim())
    .filter(Boolean);
  return parts.slice(0, 200);
}

// --- Analysis --------------------------------------------------------------

async function analyze() {
  const raw = $("input").value.trim();
  if (!raw) return;
  const opinions = splitOpinions(raw).map((text) => {
    const { polarity, magnitude } = score(text);
    return { text, polarity, magnitude, label: label(polarity) };
  });
  renderResults(opinions);
  // save to history
  const { history = [] } = await chrome.storage.local.get("history");
  const avg = opinions.reduce((a, o) => a + o.polarity, 0) / opinions.length;
  history.unshift({ id: "a" + Date.now(), at: Date.now(), n: opinions.length, avg, opinions });
  await chrome.storage.local.set({ history: history.slice(0, 20) });
  renderHistory();
}

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function renderResults(opinions) {
  $("results").hidden = false;
  const avg = opinions.reduce((a, o) => a + o.polarity, 0) / opinions.length;
  const cPos = opinions.filter((o) => o.label === "positive").length;
  const cNeu = opinions.filter((o) => o.label === "neutral").length;
  const cNeg = opinions.filter((o) => o.label === "negative").length;
  $("cPos").textContent = cPos; $("cNeu").textContent = cNeu; $("cNeg").textContent = cNeg;
  const verdict = $("verdict");
  if (avg > 0.25) { verdict.textContent = "Mostly positive"; verdict.className = "verdict pos"; }
  else if (avg < -0.25) { verdict.textContent = "Mostly negative"; verdict.className = "verdict neg"; }
  else { verdict.textContent = "Mixed / neutral"; verdict.className = "verdict neu"; }
  drawGauge(avg);
  const byPol = [...opinions].sort((a, b) => b.polarity - a.polarity);
  $("pickPos").textContent = byPol[0] ? byPol[0].text : "—";
  $("pickNeg").textContent = byPol[byPol.length - 1] ? byPol[byPol.length - 1].text : "—";
  // per-item
  const box = $("items");
  box.innerHTML = "";
  for (const o of opinions) {
    const d = document.createElement("div");
    d.className = "item";
    const pw = Math.max(0, o.polarity) * 100, nw = Math.max(0, -o.polarity) * 100;
    d.innerHTML = `<div class="t">${esc(o.text)}</div>
      <div class="bar"><i class="p" style="width:${pw.toFixed(1)}%"></i><i class="n" style="width:${nw.toFixed(1)}%"></i><i class="u" style="width:${(100 - pw - nw).toFixed(1)}%"></i></div>
      <div class="lab ${o.label === "positive" ? "pos" : o.label === "negative" ? "neg" : "neu"}">${o.label} · ${o.polarity >= 0 ? "+" : ""}${o.polarity.toFixed(2)}</div>`;
    box.appendChild(d);
  }
  // top words
  const counts = {};
  for (const o of opinions) {
    for (const t of tokenize(o.text)) {
      if (POS.has(t) || NEG.has(t)) counts[t] = (counts[t] || 0) + 1;
    }
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const wbox = $("words");
  wbox.innerHTML = "";
  for (const [w, c] of top) {
    const s = document.createElement("span");
    s.className = "chip" + (NEG.has(w) ? " negw" : "");
    s.innerHTML = `${esc(w)}<b>${c}</b>`;
    wbox.appendChild(s);
  }
}

function drawGauge(avg) {
  const svg = $("gauge");
  const NS = "http://www.w3.org/2000/svg";
  svg.innerHTML = "";
  const t = (Math.max(-1, Math.min(1, avg)) + 1) / 2;
  const x = 100 - 80 * Math.cos(Math.PI * t), y = 100 - 80 * Math.sin(Math.PI * t);
  const mk = (d, stroke, w) => {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d); p.setAttribute("fill", "none");
    p.setAttribute("stroke", stroke); p.setAttribute("stroke-width", w);
    p.setAttribute("stroke-linecap", "round");
    svg.appendChild(p);
  };
  mk("M 20,100 A 80 80 0 0 1 180,100", "rgba(255,255,255,.08)", 12);
  const col = avg > 0.25 ? "#34d399" : avg < -0.25 ? "#f43f5e" : "#94a3b8";
  mk(`M 20,100 A 80 80 0 ${t > 0.5 ? 1 : 0} 1 ${x.toFixed(1)},${y.toFixed(1)}`, col, 12);
  const tx = document.createElementNS(NS, "text");
  tx.setAttribute("x", 100); tx.setAttribute("y", 92); tx.setAttribute("text-anchor", "middle");
  tx.setAttribute("fill", "#f4f6fb"); tx.setAttribute("font-size", "20"); tx.setAttribute("font-weight", "800");
  tx.textContent = (avg >= 0 ? "+" : "") + avg.toFixed(2);
  svg.appendChild(tx);
}

// --- History ---------------------------------------------------------------

async function renderHistory() {
  const { history = [] } = await chrome.storage.local.get("history");
  const card = $("histCard"), box = $("history");
  box.innerHTML = "";
  card.hidden = history.length === 0;
  for (const h of history) {
    const row = document.createElement("div");
    row.className = "hist-row";
    const t = document.createElement("div"); t.className = "t v";
    const d = new Date(h.at);
    t.innerHTML = `<b>${h.n} opinion${h.n === 1 ? "" : "s"} · avg ${h.avg >= 0 ? "+" : ""}${h.avg.toFixed(2)}</b><span>${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>`;
    t.addEventListener("click", () => { $("input").value = h.opinions.map((o) => o.text).join("\n\n"); renderResults(h.opinions); });
    const x = document.createElement("button"); x.className = "x"; x.textContent = "×";
    x.addEventListener("click", async () => {
      const { history: cur = [] } = await chrome.storage.local.get("history");
      await chrome.storage.local.set({ history: cur.filter((i) => i.id !== h.id) });
      renderHistory();
    });
    row.append(t, x);
    box.appendChild(row);
  }
}
