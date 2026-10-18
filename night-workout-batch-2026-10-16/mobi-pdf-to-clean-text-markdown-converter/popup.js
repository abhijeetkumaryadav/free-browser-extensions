// Text Cleaner → Markdown — local text cleanup + heuristic Markdown conversion.
// Zero network. Everything runs locally; notes kept in chrome.storage.local.
// ENGINE-START

// Replace typographic ("smart") punctuation with plain ASCII equivalents.
function smartToPlain(text) {
  return String(text)
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ");
}

// Collapse runs of blank lines and trailing whitespace, normalize line endings.
function cleanWhitespace(text) {
  return smartToPlain(text)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")           // trailing whitespace per line
    .replace(/\n{3,}/g, "\n\n")          // >2 blank lines → paragraph break
    .trim();
}

// Heuristic: short, mostly-title-case lines that stand alone are probably headings.
function isHeadingLine(line, idx, lines) {
  const t = line.trim();
  if (!t) return false;
  if (t.length > 80 || t.length < 2) return false;
  if (/[.!?:;,]$/.test(t)) return false; // sentences aren't headings
  const prevBlank = idx === 0 || !lines[idx - 1].trim();
  const words = t.split(/\s+/);
  const titled = words.filter(w => /^[A-Z0-9]/.test(w)).length;
  return prevBlank && titled >= Math.max(2, words.length * 0.6);
}

// Full pipeline: clean → detect headings → Markdown with # prefixes.
function toMarkdown(raw) {
  const cleaned = cleanWhitespace(raw);
  if (!cleaned) return { markdown: "", lines: 0, headings: 0, charsIn: raw.length, charsOut: 0 };
  const lines = cleaned.split("\n");
  let headings = 0;
  const out = lines.map((line, i) => {
    if (isHeadingLine(line, i, lines)) {
      headings++;
      return "# " + line.trim();
    }
    return line.trim();
  });
  const markdown = out.join("\n");
  return { markdown, lines: lines.length, headings, charsIn: raw.length, charsOut: markdown.length };
}

// Sanitize a title into a safe .md download filename.
function downloadName(title) {
  const base = String(title || "").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return (base || "cleaned-text") + ".md";
}

// Notes engine: newest-first, per-note delete.
function makeNote(title, body) {
  const t = String(title || "").trim().slice(0, 80);
  const b = String(body || "").trim().slice(0, 2000);
  if (!t || !b) return null;
  return { id: Date.now(), title: t, body: b };
}
function sortNotes(notes) {
  return [...notes].sort((a, b) => b.id - a.id);
}

// ENGINE-END

// ---------- UI ----------
document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);

  // Tabs
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tabpane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      $("tab-" + btn.dataset.tab).classList.add("active");
    });
  });

  let lastMd = "";
  $("convertBtn").addEventListener("click", () => {
    const r = toMarkdown($("src").value);
    lastMd = r.markdown;
    $("out").value = lastMd;
    $("stats").innerHTML = r.lines
      ? `Lines: <b>${r.lines}</b> · Headings: <b>${r.headings}</b> · ${r.charsIn} → ${r.charsOut} chars`
      : "Nothing to convert.";
    chrome.storage.local.set({ lastSrc: $("src").value });
  });

  $("copyBtn").addEventListener("click", async () => {
    if (!lastMd) return;
    try { await navigator.clipboard.writeText(lastMd); $("copyBtn").textContent = "Copied ✓"; }
    catch { $("copyBtn").textContent = "Copy failed"; }
    setTimeout(() => $("copyBtn").textContent = "Copy Markdown", 1500);
  });

  $("dlBtn").addEventListener("click", () => {
    if (!lastMd) return;
    const blob = new Blob([lastMd], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = downloadName(lastMd.split("\n").find(l => l.startsWith("# ")) || "");
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });

  $("file").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { $("src").value = String(r.result).slice(0, 200000); };
    r.readAsText(f);
  });

  // Notes
  const renderNotes = notes => {
    $("noteList").innerHTML = "";
    sortNotes(notes).forEach(n => {
      const li = document.createElement("li");
      const del = document.createElement("button");
      del.className = "del"; del.textContent = "✕";
      del.addEventListener("click", () => {
        chrome.storage.local.get({ notes: [] }, d =>
          chrome.storage.local.set({ notes: d.notes.filter(x => x.id !== n.id) }, loadNotes));
      });
      const t = document.createElement("div"); t.className = "t"; t.textContent = n.title;
      const b = document.createElement("div"); b.className = "b"; b.textContent = n.body;
      li.append(del, t, b);
      $("noteList").append(li);
    });
  };
  const loadNotes = () => chrome.storage.local.get({ notes: [], lastSrc: "" }, d => {
    renderNotes(d.notes);
    if (d.lastSrc) $("src").value = d.lastSrc;
  });
  $("addNote").addEventListener("click", () => {
    const n = makeNote($("noteTitle").value, $("noteBody").value);
    if (!n) return;
    chrome.storage.local.get({ notes: [] }, d => {
      chrome.storage.local.set({ notes: [...d.notes, n] }, () => {
        $("noteTitle").value = ""; $("noteBody").value = ""; loadNotes();
      });
    });
  });
  loadNotes();
});
