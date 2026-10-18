// Popup logic: personal pharmacy stock diary.
// Stores ONLY what the user types. No network, no live pharmacy data.
(() => {
  "use strict";

  const KEY = "psa_entries";

  const form = document.getElementById("addForm");
  const itemEl = document.getElementById("item");
  const pharmacyEl = document.getElementById("pharmacy");
  const statusEl = document.getElementById("status");
  const noteEl = document.getElementById("note");
  const searchEl = document.getElementById("search");
  const listEl = document.getElementById("entries");
  const emptyEl = document.getElementById("empty");
  const exportBtn = document.getElementById("export");
  const clearBtn = document.getElementById("clear");

  let entries = [];
  let filter = "";

  const STATUS_LABEL = { in: "In stock", out: "Out of stock", low: "Low stock" };

  /** Escape HTML to keep user text safe in the DOM. */
  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function load() {
    chrome.storage.local.get([KEY], (res) => {
      entries = Array.isArray(res[KEY]) ? res[KEY] : [];
      render();
    });
  }

  function save() {
    chrome.storage.local.set({ [KEY]: entries });
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function render() {
    const q = filter.trim().toLowerCase();
    const shown = entries
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .filter((e) =>
        !q ||
        e.item.toLowerCase().includes(q) ||
        (e.pharmacy || "").toLowerCase().includes(q) ||
        (e.note || "").toLowerCase().includes(q)
      );

    listEl.innerHTML = "";
    emptyEl.style.display = shown.length ? "none" : "block";

    for (const e of shown) {
      const li = document.createElement("li");
      li.className = "entry";
      li.innerHTML = `
        <span class="dot ${esc(e.status)}" title="${esc(STATUS_LABEL[e.status] || "")}"></span>
        <div class="meta">
          <div class="item">${esc(e.item)}</div>
          <div class="sub">${esc(STATUS_LABEL[e.status] || "")} · ${esc(e.pharmacy || "—")} · ${esc(fmtDate(e.ts))}${e.note ? " · " + esc(e.note) : ""}</div>
        </div>
        <button class="del" aria-label="Delete entry" data-id="${e.id}">×</button>`;
      listEl.appendChild(li);
    }

    listEl.querySelectorAll(".del").forEach((btn) => {
      btn.addEventListener("click", () => {
        entries = entries.filter((e) => String(e.id) !== btn.dataset.id);
        save();
        render();
      });
    });
  }

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const item = itemEl.value.trim();
    if (!item) return;
    entries.push({
      id: Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      item,
      pharmacy: pharmacyEl.value.trim(),
      status: statusEl.value,
      note: noteEl.value.trim(),
      ts: Date.now(),
    });
    save();
    render();
    form.reset();
    itemEl.focus();
  });

  searchEl.addEventListener("input", () => {
    filter = searchEl.value;
    render();
  });

  exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: "pharmacy-stock-diary.json", saveAs: true }, () => {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  });

  clearBtn.addEventListener("click", () => {
    if (entries.length && confirm("Delete all diary entries? This cannot be undone.")) {
      entries = [];
      save();
      render();
    }
  });

  load();
})();
