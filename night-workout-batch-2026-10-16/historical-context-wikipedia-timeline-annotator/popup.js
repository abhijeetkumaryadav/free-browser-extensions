// ============================================================================
// TIMELINE ENGINE — pure event logic between ENGINE markers.
// Headless-testable in Node; browser wiring below.
// ============================================================================
// ENGINE-START
// Create a timeline event. Returns null when invalid.
function makeEvent(dateStr, title, notes) {
  const d = String(dateStr || "").trim();
  const t = String(title || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d))) return null;
  if (!t) return null;
  return {
    id: "ev_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    date: d,
    title: t.slice(0, 120),
    notes: String(notes || "").trim().slice(0, 500)
  };
}

// Sort events by date ascending (oldest first), stable by id.
function sortEvents(events) {
  return [...events].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Filter events by a search query across title + notes (case-insensitive).
function filterEvents(events, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return events;
  return events.filter(
    (e) => e.title.toLowerCase().includes(q) || (e.notes || "").toLowerCase().includes(q)
  );
}

// Wikipedia search URL for a title (opened by the user; no network by us).
function wikiSearchUrl(title) {
  return "https://en.wikipedia.org/wiki/Special:Search?search=" + encodeURIComponent(title);
}

// Human-friendly date: "9 Nov 1989".
function fmtDate(iso) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [y, m, d] = iso.split("-").map(Number);
  return d + " " + months[m - 1] + " " + y;
}
// ENGINE-END
// ============================================================================

// --- Popup wiring (browser only) ---------------------------------------------
(function () {
  if (typeof document === "undefined") return;

  const form = document.getElementById("addForm");
  const dateInput = document.getElementById("date");
  const titleInput = document.getElementById("title");
  const notesInput = document.getElementById("notes");
  const searchInput = document.getElementById("search");
  const timelineEl = document.getElementById("timeline");
  const emptyEl = document.getElementById("empty");
  const countEl = document.getElementById("count");
  const clearBtn = document.getElementById("clearBtn");

  let events = [];

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function save() {
    try { chrome.storage.local.set({ events }); } catch (e) { /* ignore */ }
  }

  function render() {
    const list = sortEvents(filterEvents(events, searchInput.value));
    timelineEl.innerHTML = "";
    emptyEl.style.display = list.length ? "none" : "block";
    countEl.textContent = events.length + (events.length === 1 ? " event" : " events");
    clearBtn.classList.toggle("hidden", events.length === 0);
    for (const ev of list) {
      const div = document.createElement("div");
      div.className = "event";
      const notesHtml = ev.notes ? '<div class="event-notes">' + esc(ev.notes) + "</div>" : "";
      div.innerHTML =
        '<div class="event-date">' + esc(fmtDate(ev.date)) + "</div>" +
        '<div class="event-title">' + esc(ev.title) + "</div>" +
        notesHtml +
        '<div class="event-actions">' +
          '<a class="wiki-link" href="' + esc(wikiSearchUrl(ev.title)) + '" target="_blank" rel="noopener">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14L21 3"/></svg>' +
            'Wikipedia</a>' +
          '<button class="delete-btn" data-id="' + esc(ev.id) + '">Delete</button>' +
        "</div>";
      timelineEl.appendChild(div);
    }
  }

  timelineEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".delete-btn");
    if (!btn) return;
    events = events.filter((ev) => ev.id !== btn.dataset.id);
    save();
    render();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const ev = makeEvent(dateInput.value, titleInput.value, notesInput.value);
    if (!ev) return;
    events.push(ev);
    save();
    render();
    titleInput.value = "";
    notesInput.value = "";
    titleInput.focus();
  });

  searchInput.addEventListener("input", render);

  clearBtn.addEventListener("click", () => {
    if (confirm("Delete all timeline events?")) {
      events = [];
      save();
      render();
    }
  });

  // Load saved events.
  try {
    chrome.storage.local.get(["events"], (d) => {
      if (Array.isArray(d.events)) events = d.events.filter((e) => e && e.id && e.date && e.title);
      render();
    });
  } catch (e) {
    render();
  }
})();
