/* popup.js — Form Vault popup logic.
   Modules: state (storage), rendering (entry list), actions (toggle, search,
   re-fill, clear). All data lives in chrome.storage.local; nothing leaves the browser. */

const $ = (id) => document.getElementById(id);
const listEl = $("list");
const searchEl = $("search");
const toggleEl = $("siteToggle");
const hostLabel = $("hostLabel");
const clearAllBtn = $("clearAll");
const toastEl = $("toast");

let currentHost = null;   // hostname of the active tab
let enabledSites = [];    // hosts the user opted in
let entries = [];         // all vault entries: {id, host, field, value, url, ts}
let query = "";

/* ---------- tiny helpers ---------- */
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove("show"), 1600);
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ---------- storage ---------- */
async function loadState() {
  const { enabledSites: en = [], entries: e = [] } = await chrome.storage.local.get(["enabledSites", "entries"]);
  enabledSites = en;
  entries = e;
}
async function saveEnabled() {
  await chrome.storage.local.set({ enabledSites });
}
async function saveEntries() {
  await chrome.storage.local.set({ entries });
}

/* ---------- current tab host ---------- */
async function detectHost() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && /^https?:\/\//i.test(tab.url)) {
      currentHost = new URL(tab.url).hostname;
    }
  } catch { /* non-http(s) tab: leave null */ }
  hostLabel.textContent = currentHost || "unsupported page";
  renderToggle();
}

function renderToggle() {
  const on = currentHost && enabledSites.includes(currentHost);
  toggleEl.classList.toggle("on", !!on);
  toggleEl.setAttribute("aria-checked", String(!!on));
}

/* ---------- rendering ---------- */
function filtered() {
  const q = query.trim().toLowerCase();
  return entries
    .filter((e) => !q || (e.value + " " + e.field + " " + e.host).toLowerCase().includes(q))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 200); // cap for performance
}

function render() {
  const rows = filtered();
  if (!rows.length) {
    listEl.innerHTML = `<div class="empty">No saved values yet.<br>Enable this site above, fill a form, and values are saved on submit.</div>`;
    return;
  }
  listEl.innerHTML = rows.map((e) => `
    <div class="entry" data-id="${e.id}">
      <div class="meta">
        <span class="site">${esc(e.host)}</span>
        <span>${esc(e.field)} · ${esc(fmtDate(e.ts))}</span>
      </div>
      <div class="value">${esc(e.value)}</div>
      <div class="actions">
        <button class="btn" data-act="refill" data-id="${e.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
          Re-fill
        </button>
        <button class="btn danger" data-act="del" data-id="${e.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Delete
        </button>
      </div>
    </div>`).join("");
}

/* ---------- actions ---------- */
async function toggleSite() {
  if (!currentHost) { toast("Not available on this page"); return; }
  const i = enabledSites.indexOf(currentHost);
  if (i >= 0) {
    enabledSites.splice(i, 1);
    toast("Disabled on " + currentHost);
  } else {
    enabledSites.push(currentHost);
    toast("Enabled on " + currentHost);
    // inject the capture script into the active tab right away
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    } catch { /* tab may not accept scripting */ }
  }
  await saveEnabled();
  renderToggle();
}

/** Ask the content script in the active tab to refill fields matching an entry. */
async function refill(entry) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [resp] = await chrome.tabs.sendMessage(tab.id, { type: "FV_REFILL", field: entry.field, value: entry.value });
    toast(resp && resp.filled ? "Field re-filled" : "No matching field on this page");
  } catch {
    toast("Open the matching page first");
  }
}

async function deleteEntry(id) {
  entries = entries.filter((e) => e.id !== id);
  await saveEntries();
  render();
}

async function clearAll() {
  if (!entries.length) return;
  if (!confirm("Delete ALL saved values in the vault? This cannot be undone.")) return;
  entries = [];
  await saveEntries();
  render();
  toast("Vault cleared");
}

/* ---------- events ---------- */
toggleEl.addEventListener("click", toggleSite);
toggleEl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSite(); } });
searchEl.addEventListener("input", () => { query = searchEl.value; render(); });
clearAllBtn.addEventListener("click", clearAll);
listEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const entry = entries.find((x) => x.id === btn.dataset.id);
  if (!entry) return;
  if (btn.dataset.act === "refill") refill(entry);
  else if (btn.dataset.act === "del") deleteEntry(entry.id);
});

/* ---------- init ---------- */
(async function init() {
  await loadState();
  await detectHost();
  render();
})();
