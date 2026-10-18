// GraphQL Query Workbench — popup logic.
// Paste-only workbench. No network calls, no traffic interception.

const $ = (id) => document.getElementById(id);
const KEYWORDS = new Set(["query", "mutation", "subscription", "fragment", "on", "true", "false", "null"]);
const NON_LIST_WORDS = new Set(["status", "alias"]);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("analyze").addEventListener("click", analyze);
  $("clear").addEventListener("click", clearAll);
  $("copyCurl").addEventListener("click", copyCurl);
  // restore last workbench state
  const saved = await chrome.storage.local.get("workbench");
  if (saved.workbench) {
    $("query").value = saved.workbench.query || "";
    $("vars").value = saved.workbench.vars || "";
    $("endpoint").value = saved.workbench.endpoint || "";
  }
}

function clearAll() {
  $("query").value = ""; $("vars").value = ""; $("endpoint").value = "";
  $("results").hidden = true;
  chrome.storage.local.remove("workbench");
}

/* ---------- formatter ---------- */

// Collapse whitespace outside of strings; strip # comments.
function collapseWS(src) {
  let out = "", str = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (str) {
      out += ch;
      if (ch === str && src[i - 1] !== "\\") str = null;
      continue;
    }
    if (ch === '"' || ch === "'") { str = ch; out += ch; continue; }
    if (ch === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (/\s/.test(ch)) {
      if (out && !/\s/.test(out[out.length - 1])) out += " ";
      continue;
    }
    out += ch;
  }
  return out.trim();
}

function formatQuery(src) {
  const s = collapseWS(src);
  let out = "", indent = 0, str = null, parenDepth = 0;
  const pad = () => "\n" + "  ".repeat(indent);
  const peekNext = (i) => { let j = i + 1; while (j < s.length && s[j] === " ") j++; return s[j] || ""; };
  const lastWord = () => { const m = out.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/); return m ? m[1] : ""; };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (str) {
      out += ch;
      if (ch === str && s[i - 1] !== "\\") str = null;
      continue;
    }
    if (ch === '"' || ch === "'") { str = ch; out += ch; continue; }
    // start each field on its own line (outside args), except operation keywords
    if (/[A-Za-z_]/.test(ch) && (i === 0 || !/[A-Za-z0-9_]/.test(s[i - 1])) &&
        parenDepth === 0 && /[A-Za-z0-9_)"']/.test(out.replace(/\s+$/, "").slice(-1))) {
      const upcoming = (s.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/) || [""])[0];
      if (!KEYWORDS.has(upcoming) && !KEYWORDS.has(lastWord())) {
        out = out.replace(/\s+$/, "") + pad();
      }
    }
    if (ch === "{") {
      out = out.replace(/\s+$/, "") + " {";
      indent++;
      out += pad();
      continue;
    }
    if (ch === "}") {
      indent = Math.max(0, indent - 1);
      out = out.replace(/\s+$/, "") + pad() + "}";
      const nx = peekNext(i);
      if (nx && !/[},)]/.test(nx)) out += pad();
      continue;
    }
    if (ch === "(") { out = out.replace(/\s+$/, "") + " ("; parenDepth++; continue; }
    if (ch === ")") { out = out.replace(/\s+$/, "") + ")"; parenDepth = Math.max(0, parenDepth - 1); continue; }
    if (ch === ":") { out += ": "; while (s[i + 1] === " ") i++; continue; }
    if (ch === ",") { out += ", "; while (s[i + 1] === " ") i++; continue; }
    if (ch === " " && /\n *$/.test(out)) continue; // already indented
    out += ch;
  }
  return out.replace(/[ \t]+\n/g, "\n").trim();
}

/* ---------- complexity (heuristic) ---------- */

function stripNoise(q) {
  return q
    .replace(/"""[\s\S]*?"""/g, '""')
    .replace(/"([^"\\]|\\.)*"/g, '""')
    .replace(/#[^\n]*/g, "");
}

function analyzeComplexity(q) {
  const clean = stripNoise(q);
  let depth = 0, maxDepth = 0;
  let inStr = null;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inStr) { if (ch === inStr && clean[i - 1] !== "\\") inStr = null; continue; }
    if (ch === '"') { inStr = ch; continue; }
    if (ch === "{") { depth++; maxDepth = Math.max(maxDepth, depth); }
    else if (ch === "}") depth = Math.max(0, depth - 1);
  }
  let fields = 0;
  const listish = new Set();
  const re = /[A-Za-z_][A-Za-z0-9_]*/g;
  let m;
  while ((m = re.exec(clean))) {
    const name = m[0];
    if (KEYWORDS.has(name)) continue;
    const prev = clean[m.index - 1] || "";
    if (prev === "$" || prev === ":" || prev === "." || prev === "@") continue;
    const after = clean.slice(re.lastIndex).match(/^\s*[({,}]/);
    if (!after) continue; // argument name, type, etc.
    fields++;
    if (!NON_LIST_WORDS.has(name.toLowerCase()) &&
        /(Connection|Edges)$|^(edges|nodes|items|results)$|s$/i.test(name)) {
      listish.add(name);
    }
  }
  return { fields, maxDepth, listish: [...listish].slice(0, 8) };
}

/* ---------- variables validation ---------- */

function validateVars(text) {
  const box = $("varStatus");
  const t = text.trim();
  if (!t) {
    box.className = "varstatus ok";
    box.textContent = "No variables — query will run without them.";
    return {};
  }
  try {
    const v = JSON.parse(t);
    const keys = v && typeof v === "object" ? Object.keys(v).length : 0;
    box.className = "varstatus ok";
    box.textContent = `Valid JSON · ${keys} top-level key${keys === 1 ? "" : "s"}.`;
    return v;
  } catch (e) {
    box.className = "varstatus bad";
    box.textContent = "Invalid JSON: " + e.message;
    return null;
  }
}

/* ---------- curl ---------- */

function buildCurl(endpoint, query, variables) {
  const ep = (endpoint || "").trim() || "https://YOUR_ENDPOINT/graphql";
  const payload = JSON.stringify({ query, variables: variables || {} });
  const sh = "'" + payload.replace(/'/g, "'\\''") + "'";
  return `curl -X POST "${ep}" \\\n  -H "Content-Type: application/json" \\\n  -d ${sh}`;
}

async function copyCurl() {
  const txt = $("curl").textContent;
  try {
    await navigator.clipboard.writeText(txt);
    $("copyCurl").textContent = "Copied!";
  } catch (e) {
    // clipboard unavailable — select text instead
    const r = document.createRange();
    r.selectNodeContents($("curl"));
    const sel = getSelection();
    sel.removeAllRanges(); sel.addRange(r);
    $("copyCurl").textContent = "Selected — press Ctrl+C";
  }
  setTimeout(() => { $("copyCurl").textContent = "Copy curl command"; }, 1600);
}

/* ---------- main ---------- */

async function analyze() {
  const query = $("query").value.trim();
  if (!query) { $("query").focus(); return; }
  const varsText = $("vars").value;
  const endpoint = $("endpoint").value;

  $("pretty").textContent = formatQuery(query);
  const { fields, maxDepth, listish } = analyzeComplexity(query);
  $("stFields").textContent = fields;
  $("stDepth").textContent = maxDepth;
  $("stLists").textContent = listish.length;
  $("listFields").innerHTML = listish.length
    ? "Possible lists: " + listish.map((n) => `<code>${escapeHtml(n)}</code>`).join("")
    : "No obvious list fields detected.";
  const variables = validateVars(varsText);
  $("curl").textContent = buildCurl(endpoint, collapseWS(query), variables === null ? {} : variables);
  $("results").hidden = false;

  await chrome.storage.local.set({ workbench: { query: $("query").value, vars: varsText, endpoint } });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
