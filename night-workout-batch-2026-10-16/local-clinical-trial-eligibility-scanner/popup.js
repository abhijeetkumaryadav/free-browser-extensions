/* Trial Notes — personal clinical-trial notes logbook.
 * Everything is user-entered and stored locally. The extension never
 * assesses, checks, or interprets trial eligibility. Not medical advice.
 */
"use strict";

const STORAGE_KEY = "trialNotesEntries";
const STATUSES = ["considering", "contacted", "enrolled", "declined"];

/* ---------- Storage helpers ---------- */
async function loadEntries() {
  const { [STORAGE_KEY]: entries } = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(entries) ? entries : [];
}

async function saveEntries(entries) {
  await chrome.storage.local.set({ [STORAGE_KEY]: entries });
}

/* ---------- DOM refs ---------- */
const nameInput = document.getElementById("name");
const sourceInput = document.getElementById("source");
const questionsInput = document.getElementById("questions");
const statusSelect = document.getElementById("status");
const addBtn = document.getElementById("add");
const searchInput = document.getElementById("search");
const entriesList = document.getElementById("entries");
const emptyState = document.getElementById("empty");
const countPill = document.getElementById("count");
const exportBtn = document.getElementById("export");
const clearBtn = document.getElementById("clear");

/* ---------- Rendering ---------- */
// Escape user text to prevent HTML injection in the popup.
function esc(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

function render(entries, query = "") {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? entries.filter((e) =>
        `${e.name} ${e.source} ${e.questions}`.toLowerCase().includes(q)
      )
    : entries;

  countPill.textContent = String(entries.length);
  entriesList.innerHTML = "";
  emptyState.style.display = filtered.length ? "none" : "block";

  for (const entry of filtered) {
    const li = document.createElement("li");
    li.className = "entry";

    // Status dropdown options, pre-selected to the entry's status.
    const statusOptions = STATUSES.map(
      (s) => `<option value="${s}"${s === entry.status ? " selected" : ""}>${s}</option>`
    ).join("");

    li.innerHTML = `
      <div class="row">
        <span class="name">${esc(entry.name)}</span>
        <button class="del" title="Delete entry" aria-label="Delete entry">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      <div class="row" style="margin-top:4px">
        <span class="status">${esc(entry.status || "considering")}</span>
        <span style="font-size:11px;color:var(--muted)">${esc(entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : "")}</span>
      </div>
      ${entry.source ? `<p class="meta">Source: ${esc(entry.source)}</p>` : ""}
      ${entry.questions ? `<p class="questions">${esc(entry.questions)}</p>` : ""}
      <div class="status-row">
        <label style="font-size:11px;color:var(--muted)">Status</label>
        <select class="status-edit">${statusOptions}</select>
      </div>
    `;

    // Delete handler.
    li.querySelector(".del").addEventListener("click", async () => {
      const all = await loadEntries();
      await saveEntries(all.filter((e) => e.id !== entry.id));
      render(await loadEntries(), searchInput.value);
    });

    // Inline status change handler.
    li.querySelector(".status-edit").addEventListener("change", async (e) => {
      const all = await loadEntries();
      const target = all.find((x) => x.id === entry.id);
      if (target) {
        target.status = e.target.value;
        await saveEntries(all);
      }
      render(all, searchInput.value);
    });

    entriesList.appendChild(li);
  }
}

/* ---------- Actions ---------- */
async function addEntry() {
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }
  const entries = await loadEntries();
  entries.unshift({
    id: `t${Date.now()}${Math.floor(Math.random() * 1e4)}`,
    name,
    source: sourceInput.value.trim(),
    questions: questionsInput.value.trim(),
    status: statusSelect.value,
    createdAt: new Date().toISOString(),
  });
  await saveEntries(entries);
  nameInput.value = "";
  sourceInput.value = "";
  questionsInput.value = "";
  statusSelect.value = "considering";
  nameInput.focus();
  render(entries, searchInput.value);
}

function exportJson(entries) {
  if (!entries.length) return;
  const blob = new Blob([JSON.stringify(entries, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trial-notes-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Wiring ---------- */
addBtn.addEventListener("click", addEntry);
[nameInput, sourceInput, questionsInput].forEach((el) =>
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target !== questionsInput) addEntry();
  })
);
searchInput.addEventListener("input", async () => {
  render(await loadEntries(), searchInput.value);
});
exportBtn.addEventListener("click", async () => exportJson(await loadEntries()));
clearBtn.addEventListener("click", async () => {
  if (confirm("Delete ALL trial entries? This cannot be undone.")) {
    await saveEntries([]);
    render([], searchInput.value);
  }
});

/* ---------- Init ---------- */
(async function init() {
  render(await loadEntries(), "");
})();
