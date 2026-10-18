// My Library Log — personal reading tracker. Fully local, zero network.
// ENGINE-START

const STATUSES = ["want", "reading", "finished"];
const STATUS_LABEL = { want: "Want to read", reading: "Reading", finished: "Finished" };

// Build a book entry; returns null when invalid.
function makeBook(title, author, status, progress, notes) {
  const t = String(title || "").trim().slice(0, 120);
  if (!t) return null;
  const st = STATUSES.includes(status) ? status : "want";
  let p = parseInt(progress, 10);
  if (isNaN(p)) p = 0;
  p = Math.max(0, Math.min(100, p));
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    title: t,
    author: String(author || "").trim().slice(0, 80),
    status: st,
    progress: st === "finished" ? 100 : p,
    notes: String(notes || "").trim().slice(0, 500)
  };
}

// Newest-first (insertion order reversed).
function sortBooks(books) {
  return [...books].reverse();
}

// Case-insensitive search across title, author, notes.
function filterBooks(books, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return books;
  return books.filter(b =>
    b.title.toLowerCase().includes(q) ||
    (b.author || "").toLowerCase().includes(q) ||
    (b.notes || "").toLowerCase().includes(q));
}

// Per-status counts for the header strip.
function statusCounts(books) {
  const c = { want: 0, reading: 0, finished: 0 };
  books.forEach(b => { if (c[b.status] !== undefined) c[b.status]++; });
  return c;
}

// Import validation: accepts arrays of book-shaped objects, sanitizes fields.
function parseImport(raw) {
  let arr;
  try { arr = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(arr)) return null;
  const books = [];
  for (const x of arr.slice(0, 500)) {
    const b = makeBook(x && x.title, x && x.author, x && x.status, x && x.progress, x && x.notes);
    if (b) books.push(b);
  }
  return books;
}

// ENGINE-END

// ---------- UI ----------
document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);

  const save = books => chrome.storage.local.set({ books });
  const load = cb => chrome.storage.local.get({ books: [] }, d => cb(d.books || []));

  const render = books => {
    const q = $("search").value;
    const shown = sortBooks(filterBooks(books, q));
    const c = statusCounts(books);
    $("counts").innerHTML =
      `Want: <b>${c.want}</b> Reading: <b>${c.reading}</b> Finished: <b>${c.finished}</b>`;
    $("bookList").innerHTML = "";
    shown.forEach(b => {
      const li = document.createElement("li");
      const del = document.createElement("button");
      del.className = "del"; del.textContent = "✕";
      del.title = "Delete";
      del.addEventListener("click", () => load(bs => { save(bs.filter(x => x.id !== b.id)); }));
      const t = document.createElement("div"); t.className = "t"; t.textContent = b.title;
      const badge = document.createElement("span");
      badge.className = "badge " + b.status; badge.textContent = STATUS_LABEL[b.status];
      t.append(badge);
      li.append(del, t);
      if (b.author) { const a = document.createElement("div"); a.className = "a"; a.textContent = b.author; li.append(a); }
      if (b.status !== "want") {
        const bar = document.createElement("div"); bar.className = "bar";
        const i = document.createElement("i"); i.style.width = b.progress + "%";
        bar.append(i); li.append(bar);
      }
      if (b.notes) { const n = document.createElement("div"); n.className = "n"; n.textContent = b.notes; li.append(n); }
      $("bookList").append(li);
    });
  };

  const refresh = () => load(render);

  $("addBtn").addEventListener("click", () => {
    const b = makeBook($("bTitle").value, $("bAuthor").value, $("bStatus").value, $("bProgress").value, $("bNotes").value);
    if (!b) return;
    load(bs => { save([...bs, b].slice(-500)); refresh(); });
    $("bTitle").value = ""; $("bAuthor").value = ""; $("bNotes").value = "";
    $("bProgress").value = "0"; $("bStatus").value = "want";
  });

  $("search").addEventListener("input", refresh);

  $("expBtn").addEventListener("click", () => {
    load(bs => {
      const blob = new Blob([JSON.stringify(bs, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "my-library-log.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
  });

  $("impFile").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const books = parseImport(String(r.result));
      if (books === null) { alert("Import failed: not a valid library JSON file."); return; }
      save(books); refresh();
    };
    r.readAsText(f);
  });

  chrome.storage.onChanged.addListener(ch => { if (ch.books) render(ch.books.newValue || []); });
  refresh();
});
