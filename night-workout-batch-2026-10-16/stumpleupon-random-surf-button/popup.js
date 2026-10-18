/* Stumble Button — retro random surfer over YOUR curated site list.
   Storage schema:
     { sites: [{url, cat}], history: [{url, ts}] }
   History capped at 20 entries. All local, zero network. */

"use strict";

// ---------- storage helpers ----------
async function loadState() {
  const { sites = [], history = [] } = await chrome.storage.local.get(["sites", "history"]);
  return { sites, history };
}
async function saveState(sites, history) {
  await chrome.storage.local.set({ sites, history });
}

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const stumbleBtn = $("stumbleBtn");
const filterSel = $("filterSel");
const urlInput = $("urlInput");
const catInput = $("catInput");
const addBtn = $("addBtn");
const addErr = $("addErr");
const siteList = $("siteList");
const histList = $("histList");
const emptyState = $("emptyState");
const countLine = $("countLine");
const catList = $("catList");

let sites = [];
let history = [];
let activeFilter = "";

// ---------- rendering ----------
function categories() {
  const set = new Set(sites.map((s) => s.cat).filter(Boolean));
  return [...set].sort((a, b) => a.localeCompare(b));
}

function renderFilter() {
  const cats = categories();
  filterSel.innerHTML = "";
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "All categories";
  filterSel.appendChild(all);
  for (const c of cats) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    filterSel.appendChild(o);
  }
  filterSel.value = activeFilter;
}

function renderDatalist() {
  catList.innerHTML = "";
  for (const c of categories()) {
    const o = document.createElement("option");
    o.value = c;
    catList.appendChild(o);
  }
}

function filteredSites() {
  if (!activeFilter) return sites;
  return sites.filter((s) => s.cat === activeFilter);
}

function renderSites() {
  siteList.innerHTML = "";
  const list = filteredSites();
  emptyState.classList.toggle("hidden", sites.length > 0);
  countLine.textContent = sites.length
    ? `${list.length} shown · ${sites.length} total in your list`
    : "";
  stumbleBtn.disabled = list.length === 0;
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    if (activeFilter && s.cat !== activeFilter) continue;
    const li = document.createElement("li");
    const info = document.createElement("div");
    info.className = "site-info";
    const a = document.createElement("a");
    a.className = "site-url";
    a.href = s.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = s.url;
    a.title = s.url;
    info.appendChild(a);
    li.appendChild(info);
    if (s.cat) {
      const chip = document.createElement("span");
      chip.className = "site-cat";
      chip.textContent = s.cat;
      li.appendChild(chip);
    }
    const del = document.createElement("button");
    del.className = "del-btn";
    del.title = "Remove";
    del.textContent = "×";
    del.addEventListener("click", async () => {
      sites.splice(i, 1);
      await saveState(sites, history);
      render();
    });
    li.appendChild(del);
    siteList.appendChild(li);
  }
}

function renderHistory() {
  histList.innerHTML = "";
  if (!history.length) {
    const li = document.createElement("li");
    li.innerHTML = '<span class="hist-time">Nothing stumbled yet.</span>';
    histList.appendChild(li);
    return;
  }
  for (const h of history) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "site-url";
    a.href = h.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = h.url;
    li.appendChild(a);
    const t = document.createElement("span");
    t.className = "hist-time";
    t.textContent = new Date(h.ts).toLocaleString();
    li.appendChild(t);
    histList.appendChild(li);
  }
}

function render() {
  renderFilter();
  renderDatalist();
  renderSites();
  renderHistory();
}

// ---------- actions ----------
function normalizeUrl(raw) {
  let u = raw.trim();
  if (!u) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(u)) u = "https://" + u;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function addSite() {
  const url = normalizeUrl(urlInput.value);
  addErr.classList.add("hidden");
  if (!url) {
    addErr.textContent = "Enter a valid http(s) URL.";
    addErr.classList.remove("hidden");
    return;
  }
  if (sites.some((s) => s.url === url)) {
    addErr.textContent = "That URL is already in your list.";
    addErr.classList.remove("hidden");
    return;
  }
  sites.push({ url, cat: catInput.value.trim().slice(0, 40) });
  urlInput.value = "";
  catInput.value = "";
  await saveState(sites, history);
  render();
}

async function stumble() {
  const pool = filteredSites();
  if (!pool.length) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  history.unshift({ url: pick.url, ts: Date.now() });
  history = history.slice(0, 20);
  await saveState(sites, history);
  renderHistory();
  chrome.tabs.create({ url: pick.url });
}

// ---------- wiring ----------
addBtn.addEventListener("click", addSite);
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSite();
});
stumbleBtn.addEventListener("click", stumble);
filterSel.addEventListener("change", () => {
  activeFilter = filterSel.value;
  render();
});
$("clearFilter").addEventListener("click", () => {
  activeFilter = "";
  render();
});
$("clearHist").addEventListener("click", async () => {
  history = [];
  await saveState(sites, history);
  renderHistory();
});

// ---------- init ----------
(async function init() {
  ({ sites, history } = await loadState());
  render();
})();
