// Quick QA Contract Query — on-device, template/keyword search only.
// This is a TEXT SEARCH tool. It does not interpret clauses and is NOT legal advice.

const $ = (id) => document.getElementById(id);

// Preset questions -> keyword bundles (case-insensitive substring match)
const PRESETS = [
  { label: "Termination", keywords: ["termination", "terminate", "cancel", "expire", "expiry", "early termination", "notice period"] },
  { label: "Payment terms", keywords: ["payment", "payable", "invoice", "due date", "fees", "compensation", "late payment", "remuneration", "net 30", "net 60"] },
  { label: "Liability cap", keywords: ["liability", "liable", "indemnif", "damages", "limitation of liability", "consequential", "cap"] },
  { label: "Renewal", keywords: ["renew", "renewal", "extend", "extension", "auto-renew", "evergreen", "initial term"] },
  { label: "Confidentiality", keywords: ["confidential", "non-disclosure", "proprietary", "trade secret", "nda"] },
  { label: "Governing law", keywords: ["governing law", "jurisdiction", "venue", "applicable law"] },
  { label: "IP ownership", keywords: ["intellectual property", "ownership", "assign", "work product", "invention"] },
  { label: "Disputes", keywords: ["dispute", "arbitration", "mediation", "litigation", "arbitral"] },
];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  // Restore saved contract text (local only)
  const { contractText = "" } = await chrome.storage.local.get("contractText");
  $("contract").value = contractText;
  updateWordCount();

  let saveTimer = null;
  $("contract").addEventListener("input", () => {
    updateWordCount();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => chrome.storage.local.set({ contractText: $("contract").value }), 400);
  });

  // Build preset chips
  const chips = $("chips");
  for (const p of PRESETS) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = p.label;
    b.addEventListener("click", () => runSearch(p.label, p.keywords));
    chips.appendChild(b);
  }

  $("searchBtn").addEventListener("click", runCustom);
  $("keywords").addEventListener("keydown", (e) => { if (e.key === "Enter") runCustom(); });
  $("clearBtn").addEventListener("click", async () => {
    $("contract").value = "";
    await chrome.storage.local.remove("contractText");
    updateWordCount();
    $("resultsCard").hidden = true;
  });
}

function updateWordCount() {
  const n = $("contract").value.trim().split(/\s+/).filter(Boolean).length;
  $("wordCount").textContent = n.toLocaleString() + " words";
}

function runCustom() {
  const raw = $("keywords").value.trim();
  if (!raw) return;
  const kws = raw.split(/[,;]+/).map((k) => k.trim()).filter(Boolean);
  if (!kws.length) return;
  runSearch(`“${kws.join(" · ")}”`, kws);
}

function runSearch(title, keywords) {
  const text = $("contract").value.trim();
  const card = $("resultsCard"), box = $("results");
  card.hidden = false;
  if (!text) {
    box.innerHTML = `<div class="empty-res">Paste your contract text first.</div>`;
    $("resultsTitle").textContent = "Matches";
    return;
  }
  const t0 = performance.now();
  const matches = searchPassages(text, keywords);
  const ms = Math.max(1, Math.round(performance.now() - t0));
  $("resultsTitle").textContent = `${title} — ${matches.length} match${matches.length === 1 ? "" : "es"} · ${ms}ms`;
  box.innerHTML = "";
  if (!matches.length) {
    const d = document.createElement("div");
    d.className = "empty-res";
    d.textContent = "No passages matched those keywords. Try different terms.";
    box.appendChild(d);
    return;
  }
  for (const m of matches) box.appendChild(renderMatch(m, keywords));
}

// Split into sentence-ish passages, preserving order
function splitPassages(text) {
  return text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => p.split(/(?<=[.!?;:])\s+(?=[A-Z0-9"“(\[])/))
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 15);
}

function searchPassages(text, keywords) {
  const passages = splitPassages(text);
  const kws = [...new Set(keywords.map((k) => k.toLowerCase()))].sort((a, b) => b.length - a.length);
  const scored = [];
  passages.forEach((p, i) => {
    const low = p.toLowerCase();
    let hits = 0;
    for (const k of kws) {
      let idx = -1;
      while ((idx = low.indexOf(k, idx + 1)) !== -1) hits++;
    }
    if (hits) scored.push({ i, text: p, hits });
  });
  scored.sort((a, b) => b.hits - a.hits || a.i - b.i);
  return scored.slice(0, 8).map((r) => ({
    ...r,
    prev: r.i > 0 ? passages[r.i - 1] : null,
    next: r.i < passages.length - 1 ? passages[r.i + 1] : null,
  }));
}

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function highlight(text, keywords) {
  let out = esc(text);
  const kws = [...new Set(keywords.map((k) => k.toLowerCase()))].sort((a, b) => b.length - a.length);
  for (const k of kws) {
    const re = new RegExp("(" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    out = out.replace(re, "<mark>$1</mark>");
  }
  return out;
}

function renderMatch(m, keywords) {
  const d = document.createElement("div");
  d.className = "match";
  const score = document.createElement("span");
  score.className = "score";
  score.textContent = `${m.hits} hit${m.hits === 1 ? "" : "s"}`;
  const body = document.createElement("div");
  body.innerHTML = highlight(m.text, keywords);
  d.append(score, body);
  if (m.prev || m.next) {
    const ctx = document.createElement("div");
    ctx.className = "ctx";
    ctx.innerHTML =
      (m.prev ? "… " + highlight(m.prev, keywords) + "<br>" : "") +
      (m.next ? highlight(m.next, keywords) + " …" : "");
    d.appendChild(ctx);
  }
  return d;
}
