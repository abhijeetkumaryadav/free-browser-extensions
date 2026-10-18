/* Video Description Keyword Density — heuristic engine + UI.
   ENGINE: pure functions between // ENGINE-START and // ENGINE-END. */

// ENGINE-START

/* Words too common to be interesting as "keywords". */
const STOPWORDS = new Set([
  "a","an","the","and","or","but","of","to","in","on","for","with","at","by",
  "is","are","was","were","be","been","this","that","these","those","it","its",
  "i","you","we","they","he","she","my","your","our","their","his","her",
  "as","from","not","no","so","if","do","does","did","will","would","can","just",
  "how","what","when","where","who","why","all","also","out","up","about","into"
]);

/** Lowercase alphabetic tokens, dropping digits-only and 1-char noise. */
function tokenize(text) {
  return (text.toLowerCase().match(/[a-z][a-z'’-]*[a-z]|[a-z]/g) || [])
    .filter(t => t.length > 1 && !/^\d+$/.test(t));
}

/** Map of term -> count, stopwords excluded. */
function termCounts(tokens) {
  const map = new Map();
  for (const t of tokens) {
    if (STOPWORDS.has(t)) continue;
    map.set(t, (map.get(t) || 0) + 1);
  }
  return map;
}

/** Density of a count within a total word count, expressed per 100 words. */
function densityPer100(count, totalWords) {
  if (totalWords <= 0) return 0;
  return (count / totalWords) * 100;
}

/** Stuffing verdict for one density value (per 100 words). */
function densityVerdict(density) {
  if (density > 6) return { label: "High", cls: "high" };
  if (density > 3) return { label: "Elevated", cls: "warn" };
  return { label: "Normal", cls: "ok" };
}

/** Top N terms sorted by count desc, then alphabetically. */
function topTerms(countMap, n = 12) {
  return [...countMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([term, count]) => ({ term, count }));
}

/** Find repeated phrases: n-grams (2-4 words) occurring 2+ times. */
function duplicatePhrases(tokens, maxN = 4) {
  const seen = new Map();
  for (let n = 2; n <= maxN; n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      const phrase = tokens.slice(i, i + n).join(" ");
      if (!seen.has(phrase)) seen.set(phrase, { phrase, count: 0, words: n });
      seen.get(phrase).count++;
    }
  }
  // Keep only repeats; drop phrases fully contained in a longer repeat.
  const repeats = [...seen.values()].filter(r => r.count >= 2);
  const keep = repeats.filter(r =>
    !repeats.some(o => o !== r && o.count >= r.count && o.phrase.includes(r.phrase) && o.words > r.words)
  );
  return keep.sort((a, b) => b.count - a.count || b.words - a.words).slice(0, 8);
}

/** Full analysis result for a description string. */
function analyzeDescription(text) {
  const tokens = tokenize(text);
  const counts = termCounts(tokens);
  const top = topTerms(counts).map(t => ({
    ...t,
    density: densityPer100(t.count, tokens.length),
    verdict: densityVerdict(densityPer100(t.count, tokens.length))
  }));
  return {
    words: tokens.length,
    unique: counts.size,
    chars: text.length,
    terms: top,
    duplicates: duplicatePhrases(tokens)
  };
}

/** Build a personal note object (null when empty). */
function makeNote(title, body) {
  const t = (title || "").trim().slice(0, 120);
  const b = (body || "").trim().slice(0, 2000);
  if (!t && !b) return null;
  return { id: "n" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), title: t || "Untitled", body: b, ts: Date.now() };
}

/** Newest-first, non-mutating sort of notes. */
function sortNotes(notes) {
  return [...notes].sort((a, b) => b.ts - a.ts);
}

// ENGINE-END

/* ---------------- UI ---------------- */

const $ = id => document.getElementById(id);

// Tabs
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
    $("tab-" + tab.dataset.tab).classList.remove("hidden");
  });
});

// Restore last text
chrome.storage.local.get({ lastText: "", notes: [] }, d => {
  $("text").value = d.lastText;
  renderNotes(d.notes);
});

$("run").addEventListener("click", () => {
  const text = $("text").value;
  chrome.storage.local.set({ lastText: text.slice(0, 5000) });
  if (!text.trim()) {
    $("results").classList.add("hidden");
    $("empty").classList.remove("hidden");
    $("empty").textContent = "Paste a description first.";
    return;
  }
  const r = analyzeDescription(text);
  $("empty").classList.add("hidden");
  $("results").classList.remove("hidden");
  $("st-words").textContent = r.words;
  $("st-unique").textContent = r.unique;
  $("st-chars").textContent = r.chars;
  const max = Math.max(...r.terms.map(t => t.density), 0.01);
  $("terms-body").innerHTML = r.terms.map(t => `
    <tr>
      <td>${escapeHtml(t.term)}</td>
      <td>${t.count}</td>
      <td>${t.density.toFixed(1)}%</td>
      <td><div class="bar"><div class="fill" style="width:${(t.density / max * 100).toFixed(1)}%"></div></div></td>
      <td><span class="badge ${t.verdict.cls}">${t.verdict.label}</span></td>
    </tr>`).join("");
  $("dups").innerHTML = r.duplicates.length
    ? r.duplicates.map(d => `<div class="dup"><q>${escapeHtml(d.phrase)}</q> <span class="meta">×${d.count} · ${d.words} words — repeated phrasing</span></div>`).join("")
    : `<div class="note-empty">No repeated 2–4 word phrases found.</div>`;
});

$("clear").addEventListener("click", () => {
  $("text").value = "";
  chrome.storage.local.set({ lastText: "" });
  $("results").classList.add("hidden");
  $("empty").classList.remove("hidden");
  $("empty").textContent = "Paste a description and press Analyze to see term stats.";
});

// Notes
function renderNotes(notes) {
  const list = $("note-list");
  if (!notes.length) { list.innerHTML = `<div class="note-empty">No notes yet.</div>`; return; }
  list.innerHTML = sortNotes(notes).map(n => `
    <div class="note"><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.body)}</p>
    <button class="del" data-id="${n.id}">Delete</button></div>`).join("");
  list.querySelectorAll(".del").forEach(b => b.addEventListener("click", () => {
    chrome.storage.local.get({ notes: [] }, d => {
      const rest = d.notes.filter(n => n.id !== b.dataset.id);
      chrome.storage.local.set({ notes: rest });
      renderNotes(rest);
    });
  }));
}

$("note-add").addEventListener("click", () => {
  const n = makeNote($("note-title").value, $("note-body").value);
  if (!n) return;
  chrome.storage.local.get({ notes: [] }, d => {
    const notes = [...d.notes, n].slice(-200);
    chrome.storage.local.set({ notes });
    renderNotes(notes);
    $("note-title").value = ""; $("note-body").value = "";
  });
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
