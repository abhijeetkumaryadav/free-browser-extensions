/* CachePurge popup logic.
 * - Storage estimates come from navigator.storage.estimate() run in the
 *   target origin's context (only possible for the active tab, via
 *   scripting.executeScript with world: "MAIN").
 * - Purging uses chrome.browsingData.remove() scoped to selected origins
 *   and only fires after explicit user confirmation in the modal. */

const DATA_TYPE_LABELS = {
  cache: "Cache",
  cookies: "Cookies",
  localStorage: "Local storage",
  indexedDB: "IndexedDB",
  serviceWorkers: "Service workers",
  cacheStorage: "Cache storage",
};

const els = {
  currentOrigin: document.getElementById("currentOrigin"),
  currentFill: document.getElementById("currentFill"),
  currentUsage: document.getElementById("currentUsage"),
  scanCurrent: document.getElementById("scanCurrent"),
  originInput: document.getElementById("originInput"),
  addOrigin: document.getElementById("addOrigin"),
  originList: document.getElementById("originList"),
  originCount: document.getElementById("originCount"),
  emptyState: document.getElementById("emptyState"),
  purgeBtn: document.getElementById("purgeBtn"),
  selCount: document.getElementById("selCount"),
  modal: document.getElementById("modal"),
  modalList: document.getElementById("modalList"),
  cancelPurge: document.getElementById("cancelPurge"),
  confirmPurge: document.getElementById("confirmPurge"),
  toast: document.getElementById("toast"),
};

let origins = []; // [{ origin, usage, quota, addedAt }]
let currentTabOrigin = null;

/* ---------- helpers ---------- */

function showToast(msg, kind = "") {
  els.toast.textContent = msg;
  els.toast.className = "toast " + kind;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.add("hidden"), 2600);
}

function formatBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function normalizeOrigin(input) {
  let s = (input || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch { return null; }
}

async function loadOrigins() {
  const data = await chrome.storage.local.get({ purgeOrigins: [] });
  origins = data.purgeOrigins;
}

async function saveOrigins() {
  await chrome.storage.local.set({ purgeOrigins: origins });
}

/* ---------- current tab estimate ---------- */

async function initCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) { els.currentOrigin.textContent = "—"; return; }
    const u = new URL(tab.url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      els.currentOrigin.textContent = "Not available on this page";
      els.scanCurrent.disabled = true;
      return;
    }
    currentTabOrigin = u.origin;
    els.currentOrigin.textContent = currentTabOrigin;
  } catch (e) {
    els.currentOrigin.textContent = "—";
  }
}

async function scanCurrentOrigin() {
  els.scanCurrent.disabled = true;
  els.currentUsage.textContent = "Measuring…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: async () => {
        const est = await navigator.storage.estimate();
        return { usage: est.usage || 0, quota: est.quota || 0 };
      },
    });
    const { usage, quota } = results[0].result;
    const pct = quota > 0 ? Math.min(100, (usage / quota) * 100) : 0;
    els.currentFill.style.width = pct + "%";
    els.currentUsage.textContent = `${formatBytes(usage)} of ${formatBytes(quota)} (${pct.toFixed(1)}%)`;
    // Offer to track this origin
    if (!origins.some(o => o.origin === currentTabOrigin)) {
      origins.unshift({ origin: currentTabOrigin, usage, quota, addedAt: Date.now() });
      await saveOrigins();
      renderList();
      showToast("Origin added to tracked list", "success");
    }
  } catch (e) {
    els.currentUsage.textContent = "Could not measure (page may block injection)";
  } finally {
    els.scanCurrent.disabled = false;
  }
}

/* ---------- origin list ---------- */

function renderList() {
  els.originList.innerHTML = "";
  els.originCount.textContent = origins.length;
  els.emptyState.style.display = origins.length ? "none" : "block";

  origins.forEach((o, idx) => {
    const item = document.createElement("div");
    item.className = "origin-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!o.selected;
    cb.setAttribute("aria-label", "Select " + o.origin);
    cb.addEventListener("change", () => { o.selected = cb.checked; updatePurgeBtn(); });

    const meta = document.createElement("div");
    meta.className = "origin-meta";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = o.origin;
    const usage = document.createElement("div");
    usage.className = "usage";
    usage.textContent = o.usage != null
      ? `${formatBytes(o.usage)}${o.quota ? " of " + formatBytes(o.quota) : ""}`
      : "usage unknown — scan from the tab itself";
    meta.append(name, usage);

    const del = document.createElement("button");
    del.className = "icon-btn";
    del.setAttribute("aria-label", "Remove " + o.origin);
    del.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    del.addEventListener("click", async () => {
      origins.splice(idx, 1);
      await saveOrigins();
      renderList();
      updatePurgeBtn();
    });

    item.append(cb, meta, del);
    els.originList.appendChild(item);
  });
}

async function addOriginFromInput() {
  const origin = normalizeOrigin(els.originInput.value);
  if (!origin) { showToast("Enter a valid http(s) URL", "error"); return; }
  if (origins.some(o => o.origin === origin)) { showToast("Origin already tracked", "error"); return; }
  origins.unshift({ origin, usage: null, quota: null, addedAt: Date.now() });
  await saveOrigins();
  els.originInput.value = "";
  renderList();
  updatePurgeBtn();
  showToast("Origin added", "success");
}

/* ---------- purge flow ---------- */

function selectedOrigins() {
  return origins.filter(o => o.selected);
}

function selectedDataTypes() {
  return [...document.querySelectorAll('#dataTypes input:checked')].map(i => i.dataset.type);
}

function updatePurgeBtn() {
  const n = selectedOrigins().length;
  els.selCount.textContent = n;
  els.purgeBtn.disabled = n === 0;
}

function openConfirm() {
  const sel = selectedOrigins();
  const types = selectedDataTypes();
  if (!sel.length) return;
  if (!types.length) { showToast("Select at least one data type", "error"); return; }

  els.modalList.innerHTML = "";
  sel.forEach(o => {
    const div = document.createElement("div");
    div.className = "modal-item";
    const name = document.createElement("div");
    name.className = "o";
    name.textContent = o.origin;
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = types.map(t2 => DATA_TYPE_LABELS[t2]).join(" · ");
    div.append(name, t);
    els.modalList.appendChild(div);
  });
  els.modal.classList.remove("hidden");
}

async function doPurge() {
  const sel = selectedOrigins();
  const types = selectedDataTypes();
  const dataToRemove = {};
  types.forEach(t => { dataToRemove[t] = true; });

  els.confirmPurge.disabled = true;
  let ok = 0, failed = 0;
  for (const o of sel) {
    try {
      await chrome.browsingData.remove({ origins: [o.origin] }, dataToRemove);
      ok++;
    } catch (e) { failed++; }
  }
  els.confirmPurge.disabled = false;
  els.modal.classList.add("hidden");

  // Clear selection after purge
  origins.forEach(o => { o.selected = false; });
  await saveOrigins();
  renderList();
  updatePurgeBtn();

  if (failed === 0) showToast(`Purged ${ok} origin${ok === 1 ? "" : "s"}`, "success");
  else showToast(`Purged ${ok}, failed ${failed}`, "error");
}

/* ---------- events ---------- */

els.scanCurrent.addEventListener("click", scanCurrentOrigin);
els.addOrigin.addEventListener("click", addOriginFromInput);
els.originInput.addEventListener("keydown", e => { if (e.key === "Enter") addOriginFromInput(); });
els.purgeBtn.addEventListener("click", openConfirm);
els.cancelPurge.addEventListener("click", () => els.modal.classList.add("hidden"));
els.modal.addEventListener("click", e => { if (e.target === els.modal) els.modal.classList.add("hidden"); });
els.confirmPurge.addEventListener("click", doPurge);
document.addEventListener("keydown", e => { if (e.key === "Escape") els.modal.classList.add("hidden"); });

/* ---------- init ---------- */

(async function init() {
  await loadOrigins();
  renderList();
  updatePurgeBtn();
  await initCurrentTab();
})();
