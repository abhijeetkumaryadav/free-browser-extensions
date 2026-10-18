/* Local Document Index — popup logic
   Import .txt/.md files -> full-text TF keyword index -> snippet search.
   Honest scope: keyword index only, not RAG. No AI, no network. */

"use strict";

const $ = (id) => document.getElementById(id);
const STORE_KEY = "ldi_docs_v1";
const SNIPPET_RADIUS = 90;   // chars of context around a hit

// ---------------------------------------------------------------- state
// docs: [{id, name, size, ts, text, tf: {term: count}}]
let docs = [];

// ---------------------------------------------------------------- utils
const uid = () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tokenize = (s) => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function buildTF(text) {
  const tf = {};
  tokenize(text).forEach((t) => { tf[t] = (tf[t] || 0) + 1; });
  return tf;
}

async function loadDocs() {
  const res = await chrome.storage.local.get(STORE_KEY);
  docs = Array.isArray(res[STORE_KEY]) ? res[STORE_KEY] : [];
}
async function saveDocs() {
  await chrome.storage.local.set({ [STORE_KEY]: docs });
}

// ---------------------------------------------------------------- import
$("fileInput").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  let added = 0;
  for (const f of files) {
    if (f.size > 5 * 1024 * 1024) continue;              // 5 MB cap per file
    const text = await f.text();
    if (!text.trim()) continue;
    const clean = text.slice(0, 200000);                  // 200k char cap per doc
    docs.push({ id: uid(), name: f.name, size: clean.length, ts: Date.now(), text: clean, tf: buildTF(clean) });
    added++;
  }
  e.target.value = "";
  if (added) { await saveDocs(); renderDocs(); updateStats(); }
});

function renderDocs() {
  const ul = $("docList");
  ul.innerHTML = "";
  docs.slice().reverse().forEach((d) => {
    const li = document.createElement("li");
    li.className = "doc-card";
    li.innerHTML = `<h3>${esc(d.name)}</h3>
      <div class="meta"><span>${(d.size / 1024).toFixed(1)} KB · ${new Date(d.ts).toLocaleDateString()}</span>
      <button class="del" data-id="${d.id}">Remove</button></div>`;
    ul.appendChild(li);
  });
  ul.querySelectorAll(".del").forEach((b) => b.addEventListener("click", async () => {
    docs = docs.filter((d) => d.id !== b.dataset.id);
    await saveDocs(); renderDocs(); updateStats();
  }));
}

function updateStats() {
  $("statDocs").textContent = `${docs.length} document${docs.length === 1 ? "" : "s"} indexed`;
}

$("btnClear").addEventListener("click", async () => {
  if (!confirm("Remove all indexed documents?")) return;
  docs = [];
  await saveDocs(); renderDocs(); updateStats();
  $("resultList").innerHTML = '<li class="empty">Import documents below, then search.</li>';
});

// ---------------------------------------------------------------- search
function scoreDoc(doc, terms) {
  let score = 0;
  const matched = new Set();
  terms.forEach((t) => {
    const c = doc.tf[t] || 0;
    if (c) { matched.add(t); score += c; }
  });
  return { score, matched: [...matched] };
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// First hit position (case-insensitive) of any matched term.
function firstHitIndex(text, matched) {
  const lower = text.toLowerCase();
  let best = -1;
  matched.forEach((t) => {
    const i = lower.indexOf(t);
    if (i !== -1 && (best === -1 || i < best)) best = i;
  });
  return best;
}

function snippet(text, matched) {
  const i = firstHitIndex(text, matched);
  const start = i === -1 ? 0 : Math.max(0, i - SNIPPET_RADIUS);
  const end = i === -1 ? Math.min(text.length, 2 * SNIPPET_RADIUS) : Math.min(text.length, i + matched[0].length + SNIPPET_RADIUS);
  let out = text.slice(start, end).replace(/\s+/g, " ");
  const re = new RegExp("(" + matched.map(escapeRe).join("|") + ")", "gi");
  return (start > 0 ? "… " : "") + esc(out).replace(re, "<mark>$1</mark>") + (end < text.length ? " …" : "");
}

function runSearch() {
  const q = $("inQuery").value.trim();
  const ul = $("resultList");
  ul.innerHTML = "";
  if (!q) { ul.innerHTML = '<li class="empty">Type keywords and press Search.</li>'; return; }
  if (!docs.length) { ul.innerHTML = '<li class="empty">No documents indexed yet.</li>'; return; }
  const terms = tokenize(q);
  const scored = docs
    .map((d) => ({ d, ...scoreDoc(d, terms) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) { ul.innerHTML = '<li class="empty">No matches.</li>'; return; }
  scored.slice(0, 15).forEach((r) => {
    const li = document.createElement("li");
    li.className = "result-card";
    li.innerHTML = `<h3>${esc(r.d.name)}</h3><p>${snippet(r.d.text, r.matched)}</p>
      <div class="meta"><span class="score">TF score ${r.score}</span>
      <span>${r.matched.length} term${r.matched.length === 1 ? "" : "s"} matched</span></div>`;
    ul.appendChild(li);
  });
}
$("btnSearch").addEventListener("click", runSearch);
$("inQuery").addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });

// ---------------------------------------------------------------- init
(async function init() {
  await loadDocs();
  renderDocs();
  updateStats();
})();
