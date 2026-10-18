/* Medicine Notes — personal medicine notebook.
 * Everything is user-entered and stored locally. The extension never
 * looks up, verifies, or recommends medicines. Not medical advice.
 */
"use strict";

const STORAGE_KEY = "medicineNotesEntries";

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
const formulaInput = document.getElementById("formula");
const notesInput = document.getElementById("notes");
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
        `${e.name} ${e.formula} ${e.notes}`.toLowerCase().includes(q)
      )
    : entries;

  countPill.textContent = String(entries.length);
  entriesList.innerHTML = "";
  emptyState.style.display = filtered.length ? "none" : "block";

  for (const entry of filtered) {
    const li = document.createElement("li");
    li.className = "entry";
    li.innerHTML = `
      <div class="row">
        <span class="name">${esc(entry.name)}</span>
        <button class="del" title="Delete entry" aria-label="Delete entry">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      <div class="row" style="margin-top:4px">
        <span class="formula">${esc(entry.formula || "—")}</span>
        <span style="font-size:11px;color:var(--muted)">${esc(entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : "")}</span>
      </div>
      ${entry.notes ? `<p class="notes">${esc(entry.notes)}</p>` : ""}
    `;
    li.querySelector(".del").addEventListener("click", async () => {
      const all = await loadEntries();
      await saveEntries(all.filter((e) => e.id !== entry.id));
      render(await loadEntries(), searchInput.value);
    });
    entriesList.appendChild(li);
  }
}

/* ---------- Actions ---------- */
async function addEntry() {
  const name = nameInput.value.trim();
  const formula = formulaInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }
  const entries = await loadEntries();
  entries.unshift({
    id: `n${Date.now()}${Math.floor(Math.random() * 1e4)}`,
    name,
    formula,
    notes: notesInput.value.trim(),
    createdAt: new Date().toISOString(),
  });
  await saveEntries(entries);
  nameInput.value = "";
  formulaInput.value = "";
  notesInput.value = "";
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
  a.download = `medicine-notes-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Wiring ---------- */
addBtn.addEventListener("click", addEntry);
[nameInput, formulaInput, notesInput].forEach((el) =>
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target !== notesInput) addEntry();
  })
);
searchInput.addEventListener("input", async () => {
  render(await loadEntries(), searchInput.value);
});
exportBtn.addEventListener("click", async () => exportJson(await loadEntries()));
clearBtn.addEventListener("click", async () => {
  if (confirm("Delete ALL entries? This cannot be undone.")) {
    await saveEntries([]);
    render([], searchInput.value);
  }
});

/* ---------- Init ---------- */
(async function init() {
  render(await loadEntries(), "");
})();
