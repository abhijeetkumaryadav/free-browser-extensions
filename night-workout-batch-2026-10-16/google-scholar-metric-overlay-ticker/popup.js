/* Scholar Metric Log — popup logic + pure engine (testable headless) */
// ===== ENGINE-START =====
// Pure engine: no chrome.* calls, safe to eval in node for tests.
const MAX_PAPERS = 500;

function cleanText(s, cap) {
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim().slice(0, cap);
}

// Validate a paper entry. Returns {ok, entry} or {ok:false, error}.
function makePaper({ title, authors, year, citations, notes }) {
  const t = cleanText(title, 300);
  if (!t) return { ok: false, error: "Title is required." };
  const y = year === "" || year == null ? null : Number(year);
  if (y !== null && (!Number.isInteger(y) || y < 1800 || y > 2100)) {
    return { ok: false, error: "Year must be between 1800 and 2100." };
  }
  const c = citations === "" || citations == null ? null : Number(citations);
  if (c !== null && (!Number.isInteger(c) || c < 0)) {
    return { ok: false, error: "Citations must be a non-negative integer." };
  }
  return {
    ok: true,
    entry: {
      id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      title: t,
      authors: cleanText(authors, 300),
      year: y,
      citations: c,
      notes: cleanText(notes, 2000),
      addedAt: new Date().toISOString(),
    },
  };
}

// Newest first, immutable.
function sortPapers(papers) {
  return [...papers].sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
}

// Case-insensitive search across title/authors/notes; empty query passes all.
function filterPapers(papers, q) {
  const query = cleanText(q, 300).toLowerCase();
  if (!query) return [...papers];
  return papers.filter((p) =>
    [p.title, p.authors, p.notes].some((f) => (f || "").toLowerCase().includes(query))
  );
}

// Aggregate stats over the collection.
function collectionStats(papers) {
  const n = papers.length;
  let totalCites = 0, withCites = 0, years = [];
  for (const p of papers) {
    if (typeof p.citations === "number") { totalCites += p.citations; withCites++; }
    if (typeof p.year === "number") years.push(p.year);
  }
  return {
    count: n,
    totalCitations: totalCites,
    papersWithCitations: withCites,
    oldestYear: years.length ? Math.min(...years) : null,
    newestYear: years.length ? Math.max(...years) : null,
  };
}

// Google Scholar search URL for a title. The extension never fetches this itself.
function scholarSearchUrl(title) {
  return "https://scholar.google.com/scholar?q=" + encodeURIComponent(title || "");
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
// ===== ENGINE-END =====

(function () {
  const $ = (id) => document.getElementById(id);
  const list = $("list"), stats = $("stats"), search = $("search");
  let papers = [];

  function render() {
    const s = collectionStats(papers);
    stats.innerHTML =
      `<div class="stat"><b>${s.count}</b><span>papers</span></div>` +
      `<div class="stat"><b>${s.totalCitations}</b><span>citations</span></div>` +
      `<div class="stat"><b>${s.oldestYear ? s.oldestYear + "–" + s.newestYear : "—"}</b><span>year range</span></div>`;
    const items = filterPapers(sortPapers(papers), search.value);
    $("count").textContent = items.length + " shown";
    list.innerHTML = items.length
      ? items.map((p) => `
        <div class="item" data-id="${esc(p.id)}">
          <h3>${esc(p.title)}</h3>
          <div class="meta">${p.authors ? esc(p.authors) + " · " : ""}${p.year ?? "no year"} · <span class="cites">${p.citations ?? "—"} citations</span></div>
          ${p.notes ? `<div class="notes">${esc(p.notes)}</div>` : ""}
          <div class="actions">
            <a class="scholar" href="${scholarSearchUrl(p.title)}" target="_blank" rel="noopener">Google Scholar ↗</a>
            <button class="link" data-del="${esc(p.id)}">Delete</button>
          </div>
        </div>`).join("")
      : `<div class="empty">No papers yet. Add your first one above.</div>`;
  }

  function save() {
    chrome.storage.local.set({ papers });
  }

  $("addForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const r = makePaper({
      title: $("fTitle").value, authors: $("fAuthors").value,
      year: $("fYear").value, citations: $("fCites").value, notes: $("fNotes").value,
    });
    if (!r.ok) { alert(r.error); return; }
    papers = [r.entry, ...papers].slice(0, MAX_PAPERS);
    e.target.reset();
    save(); render();
  });

  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;
    papers = papers.filter((p) => p.id !== btn.dataset.del);
    save(); render();
  });

  search.addEventListener("input", render);
  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(papers, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "scholar-metric-log.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });

  chrome.storage.local.get({ papers: [] }, (res) => {
    papers = Array.isArray(res.papers) ? res.papers : [];
    render();
  });
})();
