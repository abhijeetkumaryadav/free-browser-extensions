/* Idiom Vault popup logic.
   - Merges 150 bundled idioms with user-added ones (storage).
   - Search across title/meaning/example, category chips, favorites, copy-to-clipboard.
   - Everything local: chrome.storage.local only, zero network. */

const CATEGORIES = ["All", "Emotions", "Work & Money", "Communication", "Success & Failure", "Time & Patience", "General"];
const STORE_KEYS = { customs: "iv_custom_idioms", favs: "iv_favorites" };

let customIdioms = [];       // [{t, m, e, c, id}]
let favoriteSet = new Set(); // keys of "t|m"
let activeTab = "browse";
let activeCategory = "All";
let query = "";

const $ = (id) => document.getElementById(id);
const listEl = $("list");
const catRow = $("categoryRow");
const addPanel = $("addPanel");
const toastEl = $("toast");

/* ---------- storage ---------- */
async function loadState() {
  try {
    const data = await chrome.storage.local.get([STORE_KEYS.customs, STORE_KEYS.favs]);
    customIdioms = Array.isArray(data[STORE_KEYS.customs]) ? data[STORE_KEYS.customs] : [];
    favoriteSet = new Set(Array.isArray(data[STORE_KEYS.favs]) ? data[STORE_KEYS.favs] : []);
  } catch (err) {
    console.warn("Idiom Vault: storage unavailable", err);
  }
}

async function saveState() {
  try {
    await chrome.storage.local.set({
      [STORE_KEYS.customs]: customIdioms,
      [STORE_KEYS.favs]: [...favoriteSet],
    });
  } catch (err) {
    console.warn("Idiom Vault: could not save", err);
  }
}

/* ---------- data helpers ---------- */
function allIdioms() {
  return BUILT_IN_IDIOMS.map((x) => ({ ...x, builtin: true }))
    .concat(customIdioms.map((x) => ({ ...x, builtin: false })));
}

const favKey = (it) => `${it.t}|${it.m}`;

function filtered() {
  const q = query.trim().toLowerCase();
  return allIdioms().filter((it) => {
    if (activeTab === "favorites" && !favoriteSet.has(favKey(it))) return false;
    if (activeTab !== "favorites" && activeTab === "browse" && activeCategory !== "All" && it.c !== activeCategory) return false;
    if (activeTab === "favorites" && activeCategory !== "All" && it.c !== activeCategory) return false;
    if (!q) return true;
    return (it.t + " " + it.m + " " + (it.e || "")).toLowerCase().includes(q);
  });
}

/* ---------- rendering ---------- */
function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderCategories() {
  catRow.innerHTML = "";
  CATEGORIES.forEach((c) => {
    const b = document.createElement("button");
    b.className = "chip" + (c === activeCategory ? " active" : "");
    b.textContent = c;
    b.addEventListener("click", () => { activeCategory = c; renderCategories(); renderList(); });
    catRow.appendChild(b);
  });
}

function renderList() {
  const items = filtered();
  listEl.innerHTML = "";
  if (!items.length) {
    const d = document.createElement("div");
    d.className = "empty";
    d.textContent = activeTab === "favorites"
      ? "No favorites yet — tap the star on any idiom to save it here."
      : "No idioms match. Try a different search or category.";
    listEl.appendChild(d);
    return;
  }
  items.forEach((it) => {
    const card = document.createElement("div");
    card.className = "card";
    const isFav = favoriteSet.has(favKey(it));
    card.innerHTML = `
      <div class="card-head"><div class="idiom">${esc(it.t)}</div></div>
      <div class="meaning">${esc(it.m)}</div>
      ${it.e ? `<div class="example">“${esc(it.e)}”</div>` : ""}
      <div class="card-foot">
        <span class="cat">${esc(it.c)}${it.builtin ? "" : " · yours"}</span>
        <div class="icon-btns">
          <button class="icon-btn" data-act="copy" title="Copy idiom + meaning">Copy</button>
          <button class="icon-btn${isFav ? " faved" : ""}" data-act="fav" title="${isFav ? "Remove from favorites" : "Add to favorites"}">${isFav ? "★ Favorited" : "☆ Favorite"}</button>
          ${it.builtin ? "" : `<button class="icon-btn" data-act="del" title="Delete your idiom">Delete</button>`}
        </div>
      </div>`;
    card.querySelector('[data-act="copy"]').addEventListener("click", () => copyIdiom(it));
    card.querySelector('[data-act="fav"]').addEventListener("click", () => toggleFav(it));
    const del = card.querySelector('[data-act="del"]');
    if (del) del.addEventListener("click", () => deleteCustom(it));
    listEl.appendChild(card);
  });
}

function updateFavCount() {
  $("favCount").textContent = String(favoriteSet.size);
}

/* ---------- actions ---------- */
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove("show"), 1600);
}

async function copyIdiom(it) {
  const text = `${it.t} — ${it.m}${it.e ? `\nExample: ${it.e}` : ""}`;
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch (err) {
    // Fallback for older contexts
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); toast("Copied to clipboard"); }
    catch (e) { toast("Copy failed — select manually"); }
    ta.remove();
  }
}

async function toggleFav(it) {
  const k = favKey(it);
  if (favoriteSet.has(k)) favoriteSet.delete(k);
  else favoriteSet.add(k);
  await saveState();
  updateFavCount();
  renderList();
}

async function deleteCustom(it) {
  customIdioms = customIdioms.filter((x) => x.id !== it.id);
  favoriteSet.delete(favKey(it));
  await saveState();
  updateFavCount();
  renderList();
  toast("Idiom deleted");
}

/* ---------- wiring ---------- */
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const isAdd = tab === "add";
  addPanel.classList.toggle("hidden", !isAdd);
  addPanel.setAttribute("aria-hidden", String(!isAdd));
  listEl.classList.toggle("hidden", isAdd);
  catRow.classList.toggle("hidden", isAdd);
  if (!isAdd) renderList();
}

async function saveCustom() {
  const t = $("inIdiom").value.trim();
  const m = $("inMeaning").value.trim();
  if (!t || !m) { toast("Idiom and meaning are required"); return; }
  customIdioms.push({
    id: "u" + Date.now().toString(36),
    t, m,
    e: $("inExample").value.trim(),
    c: $("inCategory").value,
  });
  await saveState();
  $("inIdiom").value = ""; $("inMeaning").value = ""; $("inExample").value = "";
  toast("Idiom saved");
  switchTab("browse");
}

function init() {
  document.querySelectorAll(".tab").forEach((b) =>
    b.addEventListener("click", () => switchTab(b.dataset.tab)));
  $("search").addEventListener("input", (e) => { query = e.target.value; renderList(); });
  $("saveIdiom").addEventListener("click", saveCustom);
  renderCategories();
  renderList();
  updateFavCount();
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadState();
  init();
});
