// Loan Tracker — personal book-loan log with overdue date math and manual reminders.
// Honest scope: no emails, no push notifications, no calendar events. Overdue flags
// are pure date comparison; the "reminder" is the count you see when you open the popup.
// All data lives in chrome.storage.local. Zero network calls.

// ============ ENGINE-START ============
const MAX_LOANS = 500;    // storage safety cap
const MS_PER_DAY = 86400000;

// Start-of-today (local) timestamp, so day math ignores time-of-day.
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Create a loan record. Returns {ok, record} or {ok:false, error}.
function makeLoan({ book, borrower, due, note }) {
  book = (book || "").trim();
  borrower = (borrower || "").trim();
  if (!book) return { ok: false, error: "Book title is required." };
  if (!borrower) return { ok: false, error: "Borrower name is required." };
  let dueTs = null;
  if (due) {
    // Parse YYYY-MM-DD as a local date (avoid UTC-shift issues).
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(due));
    if (!m) return { ok: false, error: "Due date is not a valid date." };
    dueTs = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
    if (Number.isNaN(dueTs)) return { ok: false, error: "Due date is not a valid date." };
  }
  note = (note || "").trim();
  if (note.length > 1000) return { ok: false, error: "Note is too long (max 1000 chars)." };
  return {
    ok: true,
    record: {
      id: "l" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      book: book.slice(0, 200),
      borrower: borrower.slice(0, 100),
      due: dueTs,
      note: note || null,
      returned: false,
      createdAt: Date.now()
    }
  };
}

// Whole days until due date from a reference timestamp (defaults to start of today).
// Positive = days left, 0 = due today, negative = days overdue. Null = no due date.
function daysUntil(dueTs, refTs = startOfToday()) {
  if (dueTs === null || dueTs === undefined) return null;
  return Math.round((dueTs - refTs) / MS_PER_DAY);
}

// Status bucket for an active loan: "overdue" | "due-today" | "due-soon" | "ok" | "no-date".
function loanStatus(loan, refTs = startOfToday()) {
  if (loan.returned) return "returned";
  const d = daysUntil(loan.due, refTs);
  if (d === null) return "no-date";
  if (d < 0) return "overdue";
  if (d === 0) return "due-today";
  if (d <= 3) return "due-soon";
  return "ok";
}

// Counters for the stat row.
function loanCounts(loans, refTs = startOfToday()) {
  let active = 0, overdue = 0, returned = 0;
  for (const l of loans) {
    if (l.returned) { returned++; continue; }
    active++;
    if (loanStatus(l, refTs) === "overdue") overdue++;
  }
  return { active, overdue, returned };
}

// Sort: overdue first, then soonest due, then newest. Returned loans by newest first.
function sortLoans(loans, refTs = startOfToday()) {
  const rank = s => ({ overdue: 0, "due-today": 1, "due-soon": 2, ok: 3, "no-date": 4 }[s] ?? 5);
  return [...loans].sort((a, b) => {
    if (a.returned !== b.returned) return a.returned ? 1 : -1;
    const r = rank(loanStatus(a, refTs)) - rank(loanStatus(b, refTs));
    if (r !== 0) return r;
    const da = a.due ?? Infinity, db = b.due ?? Infinity;
    if (da !== db) return da - db;
    return b.createdAt - a.createdAt;
  });
}

// Case-insensitive search across book and borrower. Empty query -> all.
function filterLoans(loans, query) {
  query = (query || "").trim().toLowerCase();
  if (!query) return loans;
  return loans.filter(l =>
    l.book.toLowerCase().includes(query) ||
    l.borrower.toLowerCase().includes(query));
}

function fmtDate(ts) {
  if (ts === null || ts === undefined) return "No due date";
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
// ============ ENGINE-END ============

// ============ UI ============
const $ = id => document.getElementById(id);
const els = {
  book: $("f-book"), borrower: $("f-borrower"), due: $("f-due"), note: $("f-note"),
  add: $("btn-add"), error: $("form-error"), search: $("search"),
  list: $("list"), empty: $("empty"),
  statActive: $("stat-active"), statOverdue: $("stat-overdue"), statReturned: $("stat-returned")
};
let loans = [];
let tab = "active";

async function load() {
  const data = await chrome.storage.local.get({ loans: [] });
  loans = data.loans || [];
  render();
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function dueBadge(l) {
  const d = daysUntil(l.due);
  if (d === null) return `<span class="badge ok">no date</span>`;
  if (d < 0) return `<span class="badge overdue">overdue ${-d}d</span>`;
  if (d === 0) return `<span class="badge overdue">due today</span>`;
  if (d <= 3) return `<span class="badge duesoon">due in ${d}d</span>`;
  return `<span class="badge ok">due in ${d}d</span>`;
}

function render() {
  const counts = loanCounts(loans);
  els.statActive.textContent = counts.active;
  els.statOverdue.textContent = counts.overdue;
  els.statReturned.textContent = counts.returned;

  const inTab = loans.filter(l => tab === "active" ? !l.returned : l.returned);
  const shown = sortLoans(filterLoans(inTab, els.search.value));
  els.empty.hidden = shown.length > 0;
  els.list.innerHTML = shown.map(l => {
    const st = loanStatus(l);
    return `
    <div class="item${st === "overdue" || st === "due-today" ? " overdue" : ""}" data-id="${esc(l.id)}">
      <p class="title">${esc(l.book)}</p>
      <div class="meta">
        <span class="borrower">${esc(l.borrower)}</span>
        <span>${esc(fmtDate(l.due))}</span>
        ${l.returned ? `<span class="badge returned">returned</span>` : dueBadge(l)}
      </div>
      ${l.note ? `<p class="note">${esc(l.note)}</p>` : ""}
      <div class="actions">
        ${l.returned
          ? `<button class="btn-small" data-unreturn="${esc(l.id)}">Mark not returned</button>`
          : `<button class="btn-small" data-return="${esc(l.id)}">Mark returned</button>`}
        <button class="btn-small danger" data-del="${esc(l.id)}">Delete</button>
      </div>
    </div>`;
  }).join("");

  els.list.querySelectorAll("[data-return]").forEach(b =>
    b.addEventListener("click", () => setReturned(b.dataset.return, true)));
  els.list.querySelectorAll("[data-unreturn]").forEach(b =>
    b.addEventListener("click", () => setReturned(b.dataset.unreturn, false)));
  els.list.querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", async () => {
      if (!confirm("Delete this loan record?")) return;
      loans = loans.filter(l => l.id !== b.dataset.del);
      await chrome.storage.local.set({ loans });
      render();
    }));
}

async function setReturned(id, val) {
  loans = loans.map(l => l.id === id ? { ...l, returned: val } : l);
  await chrome.storage.local.set({ loans });
  render();
}

els.add.addEventListener("click", async () => {
  els.error.hidden = true;
  const res = makeLoan({
    book: els.book.value, borrower: els.borrower.value, due: els.due.value, note: els.note.value
  });
  if (!res.ok) { els.error.textContent = res.error; els.error.hidden = false; return; }
  if (loans.length >= MAX_LOANS) {
    els.error.textContent = "Log is full (500 loans). Delete some first.";
    els.error.hidden = false; return;
  }
  loans = [...loans, res.record];
  await chrome.storage.local.set({ loans });
  els.book.value = els.borrower.value = els.due.value = els.note.value = "";
  tab = "active"; syncTabs(); render();
});

function syncTabs() {
  document.querySelectorAll(".tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === tab));
}
document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
  tab = t.dataset.tab; syncTabs(); render();
}));

els.search.addEventListener("input", render);
load();
