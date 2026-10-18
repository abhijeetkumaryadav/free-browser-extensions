// Patent Claim Analyzer — best-effort on-device parsing.
// Numbering, independent/dependent classification and term extraction are
// heuristics over plain text. Always verify against the original document.

const SAMPLE = `1. A widget comprising a housing, a sensor mounted in the housing, and a processor configured to process signals from the sensor.
2. The widget of claim 1, wherein the sensor is an optical sensor.
3. The widget of claim 2, wherein the processor is further configured to filter the signals, and wherein the housing is waterproof.`;

const STOP = new Set("the a an and or of to in on for with is are was were be been being by as at from that this these those which wherein whereof whereby said such each any all more most one two first second said".split(" "));
const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("analyze").addEventListener("click", analyze);
  $("sample").addEventListener("click", () => { $("input").value = SAMPLE; });
  $("copyTsv").addEventListener("click", copyTsv);
  $("csvBtn").addEventListener("click", exportCsv);
  renderHistory();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

// --- Parsing ---------------------------------------------------------------

function parseClaims(text) {
  const claims = [];
  const re = /(?:^|\n)\s*(\d+)\s*[.\)]\s*([\s\S]*?)(?=\n\s*\d+\s*[.\)]\s*|$)/g;
  let m;
  while ((m = re.exec(text)) && claims.length < 100) {
    const body = m[2].replace(/\s+/g, " ").trim();
    if (!body) continue;
    claims.push({ num: parseInt(m[1], 10), text: body });
  }
  return claims;
}

function classify(claim) {
  // capture every referenced number: "claim 1", "claims 1 and 2", "claim 1, 2 or 3"
  const refSet = new Set();
  for (const m of claim.text.matchAll(/\bclaims?\s+([0-9][0-9\s,]*(?:(?:and|or)\s+[0-9][0-9\s,]*)*)/gi)) {
    for (const n of m[1].matchAll(/\d+/g)) refSet.add(parseInt(n[0], 10));
  }
  const refs = [...refSet].sort((a, b) => a - b);
  return { type: refs.length ? "dependent" : "independent", refs };
}

function elementsOf(text) {
  // split into elements on semicolons and "wherein" clauses
  const parts = text
    .split(/;\s*/)
    .flatMap((p) => p.split(/\s*,\s*and\s+wherein\s+|\s+wherein\s+/i).map((s, i, a) => (i > 0 && a.length > 1 ? "wherein " + s : s)))
    .map((s) => s.trim().replace(/^(and|or)\s+/i, "").replace(/[.,;]$/, ""))
    .filter((s) => s.length > 2);
  let els = parts;
  // single-sentence comma lists ("a housing, a sensor, and a processor") also chart well
  if (els.length === 1) {
    els = els[0]
      .split(/\s*,\s*/)
      .map((s) => s.trim().replace(/^(and|or)\s+/i, "").replace(/[.,;]$/, ""))
      .filter((s) => s.length > 2);
  }
  return els.slice(0, 12);
}

function extractTerms(claims) {
  const counts = new Map();
  const add = (t) => { t = t.toLowerCase().trim(); if (t.length > 2) counts.set(t, (counts.get(t) || 0) + 1); };
  for (const c of claims) {
    // quoted phrases
    for (const m of c.text.matchAll(/"([^"]{3,60})"/g)) add(m[1]);
    // capitalized multi-word sequences
    for (const m of c.text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g)) {
      const t = m[1];
      if (!STOP.has(t.toLowerCase()) && t.length > 4) add(t);
    }
    // longer technical-looking lowercase words
    for (const m of c.text.toLowerCase().matchAll(/\b[a-z]{7,}\b/g)) {
      if (!STOP.has(m[0]) && !/^(wherein|comprising|configured|further)$/.test(m[0])) add(m[0]);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
}

function highlight(text, terms) {
  let out = esc(text);
  const sorted = [...terms].sort((a, b) => b[0].length - a[0].length);
  for (const [t] of sorted) {
    const re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    out = out.replace(re, "<mark>$1</mark>");
  }
  return out;
}

// --- Analysis --------------------------------------------------------------

let current = null; // {claims:[{num,type,refs,text,elements}], terms, notes:{}}

async function analyze() {
  const raw = $("input").value.trim();
  if (!raw) return;
  const parsed = parseClaims(raw);
  if (!parsed.length) {
    $("results").hidden = true;
    return;
  }
  const claims = parsed.map((c) => ({ ...c, ...classify(c), elements: elementsOf(c.text) }));
  const terms = extractTerms(claims);
  current = { claims, terms: terms.map(([t]) => t), notes: {} };
  renderResults();
  const { history = [] } = await chrome.storage.local.get("history");
  history.unshift({ id: "p" + Date.now(), at: Date.now(), n: claims.length, claims, terms: current.terms });
  await chrome.storage.local.set({ history: history.slice(0, 20) });
  renderHistory();
}

function renderResults() {
  if (!current) return;
  $("results").hidden = false;
  $("claimCount").textContent = `· ${current.claims.length} found`;
  const box = $("claims");
  box.innerHTML = "";
  for (const c of current.claims) {
    const d = document.createElement("div");
    d.className = "claim";
    const ref = c.refs.length ? `<span class="ref">→ claim${c.refs.length > 1 ? "s" : ""} ${c.refs.join(", ")}</span>` : "";
    d.innerHTML = `<div class="chead"><span class="num">${c.num}.</span><span class="tag ${c.type === "independent" ? "ind" : "dep"}">${c.type}</span>${ref}</div>
      <div class="ctext">${highlight(c.text, current.terms.map((t) => [t]))}</div>`;
    box.appendChild(d);
  }
  const tbox = $("terms");
  tbox.innerHTML = "";
  for (const t of current.terms) {
    const s = document.createElement("span");
    s.className = "chip";
    s.textContent = t;
    tbox.appendChild(s);
  }
  renderChart();
}

function chartRows() {
  const rows = [["Claim", "Element", "Notes"]];
  for (const c of current.claims) {
    c.elements.forEach((el, i) => {
      const key = c.num + ":" + i;
      rows.push([String(c.num), el, current.notes[key] || ""]);
    });
  }
  return rows;
}

function renderChart() {
  const box = $("chart");
  box.innerHTML = "";
  for (const c of current.claims) {
    c.elements.forEach((el, i) => {
      const key = c.num + ":" + i;
      const d = document.createElement("div");
      d.className = "chart-row";
      const elDiv = document.createElement("div");
      elDiv.className = "el";
      elDiv.innerHTML = `<b>Claim ${c.num} · element ${i + 1}</b>${esc(el)}`;
      const ta = document.createElement("textarea");
      ta.placeholder = "Notes (e.g. prior-art mapping)…";
      ta.value = current.notes[key] || "";
      ta.addEventListener("input", () => { current.notes[key] = ta.value; });
      d.append(elDiv, ta);
      box.appendChild(d);
    });
  }
}

async function copyTsv() {
  if (!current) return;
  const tsv = chartRows().map((r) => r.join("\t")).join("\n");
  try { await navigator.clipboard.writeText(tsv); } catch (e) { /* clipboard unavailable */ }
}

function exportCsv() {
  if (!current) return;
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = chartRows().map((r) => r.map(q).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "claim-chart.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
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
    const ind = h.claims.filter((c) => c.type === "independent").length;
    t.innerHTML = `<b>${h.n} claims · ${ind} independent</b><span>${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>`;
    t.addEventListener("click", () => {
      current = { claims: h.claims, terms: h.terms, notes: {} };
      renderResults();
    });
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
