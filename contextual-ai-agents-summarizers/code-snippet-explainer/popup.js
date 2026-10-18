// Code Snippet Explainer — popup logic.
// collectBlocks() is injected into the page; it must stay self-contained (no closures).

function collectBlocks() {
  const out = [];
  const els = document.querySelectorAll("pre, code");
  for (const el of els) {
    if (el.tagName === "CODE" && el.closest("pre")) continue; // avoid dupes inside <pre>
    const text = (el.innerText || "").trim();
    if (text.length < 12 || text.length > 80000) continue;
    const ctx = ((el.getAttribute("class") || "") + " " + (el.getAttribute("data-language") || "")).trim();
    out.push({ text: text.slice(0, 25000), ctx: ctx.slice(0, 120), tag: el.tagName });
    if (out.length >= 40) break;
  }
  return out;
}

const $ = (id) => document.getElementById(id);
let blocks = [];
let selected = -1;
let lastAnalysis = null;

// ---------- language detection (heuristic, ordered) ----------
function detectLanguage(text, ctx) {
  const t = text.trim();
  const fromCtx = (ctx || "").toLowerCase().match(/language-([a-z#+]+)|lang-([a-z#+]+)/);
  if (fromCtx) return labelLang(fromCtx[1] || fromCtx[2]);
  if (/^[\s]*[{[]/.test(t)) { try { JSON.parse(t); return "JSON"; } catch (e) {} }
  if (/<[a-z][^>]*>/i.test(t) && /<\//.test(t)) return "HTML";
  if (/^#!\//.test(t) || /^\s*\$ /m.test(t)) return "Shell";
  if (/\b(SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE)\b/i.test(t)) return "SQL";
  if (/#include\s*</.test(t)) return "C / C++";
  if (/\bdef\s+\w+\s*\(/.test(t) || /^\s*import\s+\w+/m.test(t) || /\bprint\s*\(/.test(t) || /:\s*$/.test(t.split("\n")[0] || "")) return "Python";
  if (/\b(public|private|protected)\s+(class|static|void|int|string)\b/.test(t)) return "Java / C#";
  if (/\b(function\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=|=>|console\.log|require\()/.test(t)) return "JavaScript";
  if (/^\s*[.#]?[\w-]+\s*{[^}]*:[^}]*}/m.test(t) && /:\s*[^;]+;/.test(t)) return "CSS";
  if (/^\s{2,}\w[\w-]*:\s/m.test(t) || /^[\w-]+:\s*$/m.test(t)) return "YAML";
  return "Unknown";
}
function labelLang(s) {
  const map = { js: "JavaScript", javascript: "JavaScript", ts: "TypeScript", typescript: "TypeScript",
    py: "Python", python: "Python", sh: "Shell", bash: "Shell", html: "HTML", css: "CSS",
    json: "JSON", sql: "SQL", java: "Java", csharp: "C#", c: "C", cpp: "C++", yaml: "YAML", xml: "XML", php: "PHP", ruby: "Ruby", go: "Go", rust: "Rust" };
  return map[s] || s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- structural analysis ----------
function analyze(text) {
  const lines = text.split("\n");
  const nonBlank = lines.filter((l) => l.trim().length > 0);
  const lang = detectLanguage(text, "");
  const funcs = new Set();
  const classes = new Set();
  const addAll = (re, set) => { let m; const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"); while ((m = rx.exec(text)) !== null) { if (m[1]) set.add(m[1]); } };
  addAll(/\bdef\s+([A-Za-z_]\w*)/, funcs);
  addAll(/\bfunction\s+([A-Za-z_]\w*)/, funcs);
  addAll(/\b(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>/, funcs);
  addAll(/\b([A-Za-z_]\w*)\s*\([^;{}]*\)\s*{/, funcs); // method-ish; may catch control flow, trimmed below
  for (const kw of ["if", "for", "while", "switch", "catch", "else"]) funcs.delete(kw);
  addAll(/\bclass\s+([A-Za-z_]\w*)/, classes);
  const imports = (text.match(/^\s*(import|from|#include|require\(|using\s+\w|package\s+\w)/gm) || []).length;
  const comments = lines.filter((l) => /^\s*(#|\/\/|\/\*|\*|<!--)/.test(l)).length;
  return { lang, lines: nonBlank.length, funcs: [...funcs].slice(0, 12), funcCount: funcs.size, classes: [...classes].slice(0, 8), classCount: classes.size, imports, comments };
}

function patternRead(a) {
  const L = a.lang;
  if (L === "JSON") return "pure data — no executable logic; describes objects, arrays and values";
  if (L === "HTML") return "markup — defines page/document structure, not program logic";
  if (L === "CSS") return "style rules — selectors with declarations that style a page";
  if (L === "SQL") return "database work — queries or schema definitions";
  if (L === "YAML") return "configuration data — keys and values, no executable logic";
  if (a.classCount > 0) return "object-oriented structure — one or more classes, likely with methods";
  if (a.funcCount > 3) return "a toolkit — a collection of utility functions, probably imported elsewhere";
  if (a.funcCount > 0) return "a small procedural script — does its work top to bottom with helper function(s)";
  if (a.lines <= 6) return "a short fragment — too little structure to classify confidently";
  return "a code fragment — reads like part of a larger file";
}

function summarize(a) {
  const fn = a.funcCount ? ` Defines <b>${a.funcCount}</b> function${a.funcCount > 1 ? "s" : ""}${a.funcs.length ? ` (${a.funcs.join(", ")})` : ""}` : " Defines no named functions";
  const cl = a.classCount ? ` and <b>${a.classCount}</b> class${a.classCount > 1 ? "es" : ""}${a.classes.length ? ` (${a.classes.join(", ")})` : ""}` : "";
  return `<p>This is a <b>${a.lines}</b>-line <b>${a.lang}</b> snippet.${fn}${cl}.</p>` +
    `<p>It has <b>${a.imports}</b> import/include line${a.imports === 1 ? "" : "s"} and <b>${a.comments}</b> comment line${a.comments === 1 ? "" : "s"}.</p>` +
    `<p class="pat">Pattern read: ${patternRead(a)}.</p>`;
}

function plainText(a) {
  return [
    `Structural explanation (${a.lang}, ${a.lines} lines) — heuristic, on-device, not AI.`,
    `Functions (${a.funcCount}): ${a.funcs.join(", ") || "none"}`,
    `Classes (${a.classCount}): ${a.classes.join(", ") || "none"}`,
    `Imports: ${a.imports}, comment lines: ${a.comments}`,
    `Pattern read: ${patternRead(a)}.`,
  ].join("\n");
}

// ---------- UI ----------
document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("scan").addEventListener("click", scan);
  $("copyBtn").addEventListener("click", copyExplanation);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
  renderHistory();
}

async function scan() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectBlocks });
    blocks = (res && res.result) || [];
    renderBlocks();
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "Couldn’t scan this page — it may restrict extensions (e.g. chrome:// pages).";
  } finally {
    btn.disabled = false; btn.textContent = "Scan page";
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderBlocks() {
  const card = $("blocksCard"), box = $("blocks");
  box.innerHTML = "";
  if (!blocks.length) {
    card.hidden = true;
    $("empty").style.display = "";
    $("empty").innerHTML = "No code blocks found on this page. Try a docs page, GitHub, or Stack Overflow.";
    return;
  }
  $("empty").style.display = "none";
  card.hidden = false;
  $("blockCount").textContent = `(${blocks.length})`;
  blocks.forEach((b, i) => {
    const preview = b.text.split("\n").slice(0, 4).join("\n");
    const a = analyze(b.text);
    const btn = document.createElement("button");
    btn.className = "block" + (i === selected ? " sel" : "");
    btn.innerHTML = `<pre>${esc(preview)}</pre><div class="meta"><b>${esc(a.lang)}</b><span>${a.lines} lines</span><span>${b.tag === "PRE" ? "&lt;pre&gt;" : "&lt;code&gt;"}</span></div>`;
    btn.addEventListener("click", () => selectBlock(i));
    box.appendChild(btn);
  });
}

async function selectBlock(i) {
  selected = i;
  document.querySelectorAll(".block").forEach((el, j) => el.classList.toggle("sel", j === i));
  const b = blocks[i];
  const a = analyze(b.text);
  lastAnalysis = a;
  $("analysisCard").hidden = false;
  $("langBadge").textContent = a.lang;
  $("sLines").textContent = a.lines;
  $("sFuncs").textContent = a.funcCount;
  $("sClasses").textContent = a.classCount;
  $("sComments").textContent = a.comments;
  $("summary").innerHTML = summarize(a);
  $("analysisCard").scrollIntoView({ block: "nearest" });
  // save to history
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { analyses = [] } = await chrome.storage.local.get("analyses");
  analyses.unshift({
    id: "an-" + Date.now(),
    host: tab && tab.url ? (() => { try { return new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) { return ""; } })() : "",
    lang: a.lang, lines: a.lines, funcCount: a.funcCount, classCount: a.classCount,
    summary: plainText(a), at: Date.now(),
  });
  await chrome.storage.local.set({ analyses: analyses.slice(0, 30) });
  renderHistory();
}

async function copyExplanation() {
  if (!lastAnalysis) return;
  try {
    await navigator.clipboard.writeText(plainText(lastAnalysis));
    $("copyBtn").textContent = "Copied ✓";
  } catch (e) {
    $("copyBtn").textContent = "Copy failed";
  }
  setTimeout(() => { $("copyBtn").textContent = "Copy explanation"; }, 1500);
}

async function renderHistory() {
  const { analyses = [] } = await chrome.storage.local.get("analyses");
  const card = $("historyCard"), box = $("history");
  box.innerHTML = "";
  card.hidden = analyses.length === 0;
  for (const a of analyses) {
    const row = document.createElement("div");
    row.className = "hist-row";
    const t = document.createElement("div"); t.className = "t";
    const b = document.createElement("b"); b.textContent = `${a.lang} · ${a.lines} lines · ${a.funcCount} fn`;
    const s = document.createElement("span");
    s.textContent = `${a.host || "page"} · ${new Date(a.at).toLocaleString()}`;
    t.append(b, s);
    const copy = document.createElement("button");
    copy.className = "x"; copy.textContent = "⧉"; copy.title = "Copy explanation";
    copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(a.summary); } catch (e) {} });
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×";
    x.addEventListener("click", async () => {
      const { analyses: cur = [] } = await chrome.storage.local.get("analyses");
      await chrome.storage.local.set({ analyses: cur.filter((i) => i.id !== a.id) });
      renderHistory();
    });
    row.append(t, copy, x);
    box.appendChild(row);
  }
}
