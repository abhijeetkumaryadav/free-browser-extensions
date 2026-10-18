/* CatalogCross popup — manual two-list cross-checker. All data in chrome.storage.local. */
"use strict";

/* ---------- State ---------- */

const state = {
  listA: [], // "My Plex" — array of { id, title, addedAt }
  listB: [], // "My Stremio"
  view: "overlap", // overlap | onlyA | onlyB | manage
  search: "",
};

const $ = (id) => document.getElementById(id);
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/* ---------- Normalization ---------- */

/** Normalize a title for comparison: lowercase, strip year in parens, punctuation, extra spaces. */
function norm(title) {
  return title
    .toLowerCase()
    .replace(/\(\d{4}\)/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- Set algebra ---------- */

function computeSets() {
  const mapA = new Map(state.listA.map((t) => [norm(t.title), t]));
  const mapB = new Map(state.listB.map((t) => [norm(t.title), t]));
  const overlap = [], onlyA = [], onlyB = [];
  for (const [key, item] of mapA) {
    (mapB.has(key) ? overlap : onlyA).push(item);
  }
  for (const [key, item] of mapB) {
    if (!mapA.has(key)) onlyB.push(item);
  }
  const byTitle = (a, b) => a.title.localeCompare(b.title);
  overlap.sort(byTitle); onlyA.sort(byTitle); onlyB.sort(byTitle);
  return { overlap, onlyA, onlyB };
}

/* ---------- Persistence ---------- */

async function load() {
  const { catalogcross } = await chrome.storage.local.get("catalogcross");
  if (catalogcross) {
    state.listA = catalogcross.listA || [];
    state.listB = catalogcross.listB || [];
  }
}

function save() {
  return chrome.storage.local.set({
    catalogcross: { listA: state.listA, listB: state.listB },
  });
}

/* ---------- Rendering ---------- */

function badgeFor(view) {
  if (view === "overlap") return '<span class="badge both">BOTH</span>';
  if (view === "onlyA") return '<span class="badge a">PLEX</span>';
  return '<span class="badge b">STREMIO</span>';
}

function render() {
  const { overlap, onlyA, onlyB } = computeSets();
  $("statOverlap").textContent = overlap.length;
  $("statOnlyA").textContent = onlyA.length;
  $("statOnlyB").textContent = onlyB.length;
  $("countA").textContent = state.listA.length;
  $("countB").textContent = state.listB.length;

  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.view === state.view));

  const isManage = state.view === "manage";
  $("managePanel").classList.toggle("hidden", !isManage);
  $("searchRow").classList.toggle("hidden", isManage);
  $("titleList").classList.toggle("hidden", isManage);
  $("emptyState").classList.toggle("hidden", isManage);

  if (isManage) return;

  const q = state.search.trim().toLowerCase();
  const items = { overlap, onlyA, onlyB }[state.view]
    .filter((t) => !q || t.title.toLowerCase().includes(q));

  const list = $("titleList");
  list.innerHTML = "";
  $("emptyState").classList.toggle("hidden", items.length > 0);

  for (const item of items) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = item.title; // textContent: no HTML injection
    name.title = item.title;
    li.appendChild(name);
    li.insertAdjacentHTML("beforeend", badgeFor(state.view));
    const del = document.createElement("button");
    del.className = "del-btn";
    del.textContent = "×";
    del.title = "Remove from its list";
    del.addEventListener("click", () => removeItem(item.id));
    li.appendChild(del);
    list.appendChild(li);
  }
}

/* ---------- Mutations ---------- */

async function addTitle(listKey, inputEl) {
  const title = inputEl.value.trim();
  if (!title) return;
  const list = listKey === "A" ? state.listA : state.listB;
  const key = norm(title);
  if (list.some((t) => norm(t.title) === key)) {
    inputEl.value = "";
    inputEl.placeholder = "Already in this list";
    setTimeout(() => { inputEl.placeholder = listKey === "A" ? "Add title to Plex list…" : "Add title to Stremio list…"; }, 1500);
    return;
  }
  list.push({ id: uid(), title, addedAt: Date.now() });
  inputEl.value = "";
  await save();
  render();
}

async function removeItem(id) {
  state.listA = state.listA.filter((t) => t.id !== id);
  state.listB = state.listB.filter((t) => t.id !== id);
  await save();
  render();
}

/* ---------- Export / import ---------- */

function exportJSON() {
  const data = {
    app: "catalogcross",
    version: 1,
    exportedAt: new Date().toISOString(),
    plex: state.listA.map((t) => t.title),
    stremio: state.listB.map((t) => t.title),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "catalogcross-lists.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function importJSON(file) {
  try {
    const data = JSON.parse(await file.text());
    const plex = Array.isArray(data.plex) ? data.plex : [];
    const stremio = Array.isArray(data.stremio) ? data.stremio : [];
    const merge = (existing, titles) => {
      const seen = new Set(existing.map((t) => norm(t.title)));
      for (const raw of titles) {
        const title = String(raw).trim();
        if (!title || seen.has(norm(title))) continue;
        seen.add(norm(title));
        existing.push({ id: uid(), title, addedAt: Date.now() });
      }
    };
    merge(state.listA, plex);
    merge(state.listB, stremio);
    await save();
    render();
  } catch {
    // Invalid file — ignore silently, user can retry
  }
}

/* ---------- Init ---------- */

document.addEventListener("DOMContentLoaded", async () => {
  await load();

  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => { state.view = t.dataset.view; render(); }));

  $("searchInput").addEventListener("input", (e) => {
    state.search = e.target.value;
    render();
  });

  $("addA").addEventListener("click", () => addTitle("A", $("inputA")));
  $("addB").addEventListener("click", () => addTitle("B", $("inputB")));
  $("inputA").addEventListener("keydown", (e) => { if (e.key === "Enter") addTitle("A", $("inputA")); });
  $("inputB").addEventListener("keydown", (e) => { if (e.key === "Enter") addTitle("B", $("inputB")); });

  $("exportBtn").addEventListener("click", exportJSON);
  $("importFile").addEventListener("change", (e) => {
    if (e.target.files[0]) importJSON(e.target.files[0]);
    e.target.value = "";
  });

  $("clearAllBtn").addEventListener("click", async () => {
    if (!confirm("Remove all titles from both lists?")) return;
    state.listA = [];
    state.listB = [];
    await save();
    render();
  });

  render();
});
