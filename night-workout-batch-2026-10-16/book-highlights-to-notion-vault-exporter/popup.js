// Highlight Vault — personal highlights vault + Notion-ready Markdown export.
// Honest scope: no Notion API. Export is Markdown you copy/download and import manually.
// All data lives in chrome.storage.local. Zero network calls.

// ============ ENGINE-START ============
const MAX_HIGHLIGHTS = 1000;      // safety cap on stored highlights
const MAX_QUOTE = 4000;           // quote length cap
const MAX_NOTE = 2000;            // note length cap

// Create a highlight record. Returns {ok, record} or {ok:false, error}.
function makeHighlight({ book, page, tag, quote, note }) {
  book = (book || "").trim();
  quote = (quote || "").trim();
  if (!book) return { ok: false, error: "Book title is required." };
  if (!quote) return { ok: false, error: "The quote is required." };
  if (quote.length > MAX_QUOTE) return { ok: false, error: `Quote is too long (max ${MAX_QUOTE} chars).` };
  note = (note || "").trim();
  if (note.length > MAX_NOTE) return { ok: false, error: `Note is too long (max ${MAX_NOTE} chars).` };
  let pageNum = null;
  if (page !== "" && page !== undefined && page !== null) {
    pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum < 1 || pageNum > 99999) {
      return { ok: false, error: "Page must be a whole number ≥ 1." };
    }
  }
  return {
    ok: true,
    record: {
      id: "h" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      book: book.slice(0, 200),
      page: pageNum,
      tag: (tag || "").trim().slice(0, 40) || null,
      quote,
      note: note || null,
      createdAt: Date.now()
    }
  };
}

// Newest-first, immutable sort.
function sortHighlights(list) {
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}

// Case-insensitive filter across book, quote, note, tag. Empty query -> all.
function filterHighlights(list, query) {
  query = (query || "").trim().toLowerCase();
  if (!query) return list;
  return list.filter(h =>
    h.book.toLowerCase().includes(query) ||
    h.quote.toLowerCase().includes(query) ||
    (h.note && h.note.toLowerCase().includes(query)) ||
    (h.tag && h.tag.toLowerCase().includes(query))
  );
}

// Group highlights by book for a readable export, preserving insertion order.
function groupByBook(list) {
  const groups = [];
  const seen = new Map();
  for (const h of list) {
    if (!seen.has(h.book)) { seen.set(h.book, []); groups.push(h.book); }
    seen.get(h.book).push(h);
  }
  return groups.map(book => ({ book, highlights: seen.get(book) }));
}

// Build Notion-ready Markdown. Export is deterministic given input order.
function buildMarkdown(list) {
  const lines = ["# Highlight Vault Export", ""];
  if (!list.length) {
    lines.push("_No highlights yet._", "");
    return lines.join("\n");
  }
  for (const { book, highlights } of groupByBook(list)) {
    lines.push(`## ${book}`, "");
    for (const h of highlights) {
      lines.push(`> ${h.quote.replace(/\n/g, "\n> ")}`);
      const meta = [];
      if (h.page !== null && h.page !== undefined) meta.push(`p. ${h.page}`);
      if (h.tag) meta.push(`#${h.tag}`);
      meta.push(new Date(h.createdAt).toISOString().slice(0, 10));
      lines.push("", `_${meta.join(" · ")}_`);
      if (h.note) lines.push("", `**Note:** ${h.note.replace(/\n/g, " ")}`);
      lines.push("");
    }
  }
  return lines.join("\n").trimEnd() + "\n";
}

// Safe import: validate a parsed array, skip invalid records, respect the cap.
function parseImport(value) {
  if (typeof value !== "string") return { ok: false, error: "Not text." };
  let arr;
  try { arr = JSON.parse(value); } catch { return { ok: false, error: "Invalid JSON." }; }
  if (!Array.isArray(arr)) return { ok: false, error: "JSON must be an array." };
  const kept = [];
  for (const raw of arr.slice(0, MAX_HIGHLIGHTS)) {
    if (!raw || typeof raw !== "object") continue;
    const res = makeHighlight({
      book: raw.book, page: raw.page, tag: raw.tag, quote: raw.quote, note: raw.note
    });
    if (res.ok) kept.push({ ...res.record, createdAt: Number(raw.createdAt) || Date.now() });
  }
  return { ok: true, records: kept };
}
// ============ ENGINE-END ============

// ============ UI ============
const $ = id => document.getElementById(id);
const els = {
  book: $("f-book"), page: $("f-page"), tag: $("f-tag"), quote: $("f-quote"),
  note: $("f-note"), add: $("btn-add"), error: $("form-error"),
  search: $("search"), list: $("list"), empty: $("empty"), count: $("count"),
  clear: $("btn-clear"), preview: $("preview"), copy: $("btn-copy"),
  download: $("btn-download"), exportMsg: $("export-msg")
};
let highlights = [];

async function load() {
  const data = await chrome.storage.local.get({ highlights: [] });
  highlights = sortHighlights(data.highlights || []);
  render();
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function render() {
  const query = els.search.value;
  const shown = filterHighlights(highlights, query);
  els.count.textContent = highlights.length;
  els.empty.hidden = shown.length > 0;
  els.list.innerHTML = shown.map(h => `
    <div class="item" data-id="${esc(h.id)}">
      <button class="del" data-del="${esc(h.id)}" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <p class="quote">&ldquo;${esc(h.quote)}&rdquo;</p>
      <div class="meta">
        <span class="book">${esc(h.book)}</span>
        ${h.page ? `<span>p. ${h.page}</span>` : ""}
        ${h.tag ? `<span class="tag">#${esc(h.tag)}</span>` : ""}
        <span>${new Date(h.createdAt).toLocaleDateString()}</span>
      </div>
      ${h.note ? `<p class="note">${esc(h.note)}</p>` : ""}
    </div>`).join("");
  els.list.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      highlights = highlights.filter(h => h.id !== btn.dataset.del);
      await chrome.storage.local.set({ highlights });
      render();
    });
  });
  // Export preview refreshes with the current data.
  els.preview.textContent = buildMarkdown(highlights);
}

els.add.addEventListener("click", async () => {
  els.error.hidden = true;
  const res = makeHighlight({
    book: els.book.value, page: els.page.value, tag: els.tag.value,
    quote: els.quote.value, note: els.note.value
  });
  if (!res.ok) { els.error.textContent = res.error; els.error.hidden = false; return; }
  if (highlights.length >= MAX_HIGHLIGHTS) {
    els.error.textContent = "Vault is full (1000 highlights). Delete some first.";
    els.error.hidden = false; return;
  }
  highlights = sortHighlights([...highlights, res.record]);
  await chrome.storage.local.set({ highlights });
  els.book.value = els.page.value = els.tag.value = els.quote.value = els.note.value = "";
  render();
});

els.search.addEventListener("input", render);

els.clear.addEventListener("click", async () => {
  if (!highlights.length) return;
  if (confirm("Delete all highlights? This cannot be undone.")) {
    highlights = [];
    await chrome.storage.local.set({ highlights });
    render();
  }
});

function flash(msg) {
  els.exportMsg.textContent = msg; els.exportMsg.hidden = false;
  setTimeout(() => { els.exportMsg.hidden = true; }, 2500);
}

els.copy.addEventListener("click", async () => {
  const md = buildMarkdown(highlights);
  try {
    await navigator.clipboard.writeText(md);
    flash("Markdown copied. Paste it into Notion.");
  } catch {
    flash("Copy failed — use Download instead.");
  }
});

els.download.addEventListener("click", () => {
  const md = buildMarkdown(highlights);
  const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "highlight-vault-" + new Date().toISOString().slice(0, 10) + ".md";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  flash("Downloaded. Import the .md file into Notion manually.");
});

load();
