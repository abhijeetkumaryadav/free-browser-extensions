/* Highlight Compiler — save highlights + heuristic word-frequency summary.
 * No network, no AI. All state in chrome.storage.local. */

// ============ ENGINE-START ============
// Common English stopwords so frequent-but-empty words don't win the ranking.
const STOPWORDS = new Set(
  "a,an,the,and,or,but,if,then,else,when,while,of,at,by,for,with,about,into,through,during,before,after,above,below,to,from,up,down,in,out,on,off,over,under,again,further,once,here,there,all,any,both,each,few,more,most,other,some,such,no,nor,not,only,own,same,so,than,too,very,can,will,just,don,should,now,is,are,was,were,be,been,being,have,has,had,having,do,does,did,doing,would,could,ought,i,me,my,myself,we,our,ours,ourselves,you,your,yours,yourself,yourselves,he,him,his,himself,she,her,hers,herself,it,its,itself,they,them,their,theirs,themselves,what,which,who,whom,this,that,these,those,am,as,also,may,might,must,shall,there,say,said,says".split(",")
);

// Split text into sentence-like units (keeps original order).
function splitSentences(text) {
  if (!text || typeof text !== "string") return [];
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Tokenize: lowercase, keep word characters incl. apostrophes.
function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9']+/g) || []).filter(
    (t) => t.length > 1 && !STOPWORDS.has(t)
  );
}

// Build a frequency map across ALL highlight texts (excluding stopwords).
function wordFrequencies(highlights) {
  const freq = new Map();
  for (const h of highlights) {
    for (const t of tokenize(h.text || "")) freq.set(t, (freq.get(t) || 0) + 1);
  }
  return freq;
}

// Score one sentence = sum of frequencies of its content words.
function scoreSentence(sent, freq) {
  return tokenize(sent).reduce((sum, t) => sum + (freq.get(t) || 0), 0);
}

// Heuristic summary: top-N sentences by word-frequency score,
// returned in ORIGINAL order so the summary reads naturally.
function heuristicSummary(highlights, n) {
  const count = Math.max(1, Math.min(10, n | 0 || 3));
  const sentences = [];
  for (const h of highlights) {
    for (const s of splitSentences(h.text || "")) sentences.push({ text: s, src: h.source || "" });
  }
  if (!sentences.length) return [];
  const freq = wordFrequencies(highlights);
  const scored = sentences.map((s, i) => ({ ...s, score: scoreSentence(s.text, freq), idx: i }));
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  const top = scored.slice(0, count);
  top.sort((a, b) => a.idx - b.idx);
  return top;
}

// Validate a new highlight before saving.
function makeHighlight(source, text) {
  const t = (text || "").trim();
  if (!t) return { ok: false, error: "Highlight text is empty." };
  if (t.length > 4000) return { ok: false, error: "Highlight too long (max 4000 chars)." };
  const s = (source || "").trim().slice(0, 120);
  return { ok: true, item: { id: "h" + Date.now() + Math.floor(Math.random() * 1e4), source: s, text: t, savedAt: Date.now() } };
}

// Case-insensitive filter across source + text.
function filterHighlights(highlights, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return highlights;
  return highlights.filter(
    (h) => (h.source || "").toLowerCase().includes(q) || (h.text || "").toLowerCase().includes(q)
  );
}

// Markdown export: groups by source, then quotes each highlight.
function buildMarkdown(highlights) {
  if (!highlights.length) return "";
  const groups = new Map();
  for (const h of highlights) {
    const key = h.source || "Unsourced";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(h);
  }
  let md = "# Highlight Compiler export\n\n";
  for (const [src, items] of groups) {
    md += "## " + src.replace(/\n/g, " ") + "\n\n";
    for (const h of items) {
      md += "> " + h.text.replace(/\n/g, "\n> ") + "\n\n";
      md += "*" + new Date(h.savedAt).toLocaleDateString() + "*\n\n";
    }
  }
  return md;
}

// Validate an imported array of highlights.
function parseImport(raw) {
  let arr;
  try { arr = JSON.parse(raw); } catch { return { ok: false, error: "Not valid JSON." }; }
  if (!Array.isArray(arr)) return { ok: false, error: "JSON is not an array." };
  const items = [];
  for (const h of arr) {
    if (!h || typeof h.text !== "string" || !h.text.trim()) continue;
    items.push({ id: "h" + Math.floor(Math.random() * 1e9), source: String(h.source || "").slice(0, 120), text: h.text.trim().slice(0, 4000), savedAt: +h.savedAt || Date.now() });
  }
  return { ok: true, items };
}

function fmtWhen(ts) {
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
// ============ ENGINE-END ============

// ---------------- UI ----------------
const $ = (id) => document.getElementById(id);
const store = {
  async get() { return (await chrome.storage.local.get({ highlights: [] })).highlights; },
  async set(h) { await chrome.storage.local.set({ highlights: h }); },
};

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".pane").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $("pane-" + btn.dataset.tab).classList.add("active");
  });
});

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function renderList() {
  const all = await store.get();
  const shown = filterHighlights(all, $("search").value);
  $("count").textContent = shown.length + " of " + all.length + " saved";
  const list = $("list");
  list.innerHTML = "";
  for (const h of shown) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML =
      (h.source ? '<div class="src">' + esc(h.source) + "</div>" : "") +
      '<div class="body">' + esc(h.text) + "</div>" +
      '<div class="meta"><time>' + esc(fmtWhen(h.savedAt)) + "</time>" +
      '<button class="del" data-id="' + h.id + '">Delete</button></div>';
    list.appendChild(card);
  }
  list.querySelectorAll(".del").forEach((b) =>
    b.addEventListener("click", async () => {
      await store.set((await store.get()).filter((h) => h.id !== b.dataset.id));
      renderList();
    })
  );
}

$("save").addEventListener("click", async () => {
  const r = makeHighlight($("src").value, $("txt").value);
  if (!r.ok) { $("addMsg").textContent = r.error; return; }
  const all = await store.get();
  all.unshift(r.item);
  await store.set(all);
  $("src").value = ""; $("txt").value = "";
  $("addMsg").textContent = "Saved.";
  renderList();
});

$("search").addEventListener("input", renderList);

$("export").addEventListener("click", async () => {
  const md = buildMarkdown(await store.get());
  if (!md) return;
  const blob = new Blob([md], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "highlights.md";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("clear").addEventListener("click", async () => {
  if (confirm("Delete all saved highlights?")) { await store.set([]); renderList(); }
});

$("summarize").addEventListener("click", async () => {
  const all = await store.get();
  const out = $("summaryOut");
  out.innerHTML = "";
  if (!all.length) { $("sumMsg").textContent = "Save some highlights first."; return; }
  const top = heuristicSummary(all, parseInt($("nSent").value, 10));
  if (!top.length) { $("sumMsg").textContent = "No sentences found."; return; }
  $("sumMsg").textContent = "";
  for (const s of top) {
    const el = document.createElement("div");
    el.className = "sumline";
    el.innerHTML = '<span class="score">' + esc(s.src || "Unsourced") + " · score " + s.score + "</span><br>" + esc(s.text);
    out.appendChild(el);
  }
});

renderList();
