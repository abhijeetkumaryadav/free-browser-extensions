/* WakeUp popup — schedule tab wakes backed by chrome.alarms. */
"use strict";

const STORAGE_KEY = "wakes";

const $ = (id) => document.getElementById(id);
const nameInput = $("nameInput");
const modeTab = $("modeTab");
const modeUrl = $("modeUrl");
const tabSelect = $("tabSelect");
const urlInput = $("urlInput");
const whenInput = $("whenInput");
const addBtn = $("addBtn");
const formError = $("formError");
const wakeList = $("wakeList");
const wakeEmpty = $("wakeEmpty");

let mode = "tab";

/* ---------- storage helpers ---------- */
async function loadWakes() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const wakes = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  return wakes.sort((a, b) => a.at - b.at);
}

async function saveWakes(wakes) {
  await chrome.storage.local.set({ [STORAGE_KEY]: wakes });
}

/* ---------- tab picker ---------- */
function shortTitle(tab) {
  const t = (tab.title || tab.url || "Untitled").trim() || "Untitled";
  return t.length > 46 ? t.slice(0, 45) + "…" : t;
}

async function refreshTabOptions() {
  const tabs = await chrome.tabs.query({});
  tabSelect.innerHTML = "";
  const current = tabs.filter((t) => !t.url.startsWith("chrome://"));
  if (current.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No eligible tabs open";
    tabSelect.appendChild(opt);
    return;
  }
  for (const tab of current) {
    const opt = document.createElement("option");
    opt.value = String(tab.id);
    opt.dataset.windowId = String(tab.windowId);
    opt.dataset.url = tab.url || "";
    opt.textContent = shortTitle(tab);
    tabSelect.appendChild(opt);
  }
}

/* ---------- mode toggle ---------- */
function setMode(next) {
  mode = next;
  modeTab.classList.toggle("active", mode === "tab");
  modeUrl.classList.toggle("active", mode === "url");
  tabSelect.hidden = mode !== "tab";
  urlInput.hidden = mode !== "url";
}
modeTab.addEventListener("click", () => setMode("tab"));
modeUrl.addEventListener("click", () => setMode("url"));

/* ---------- scheduling ---------- */
function showError(msg) {
  formError.textContent = msg;
  formError.hidden = false;
}
function clearError() {
  formError.hidden = true;
  formError.textContent = "";
}

function fmtWhen(at) {
  return new Date(at).toLocaleString([], {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

addBtn.addEventListener("click", async () => {
  clearError();
  const name = nameInput.value.trim() || "Wake up!";
  const when = whenInput.value ? new Date(whenInput.value).getTime() : NaN;
  if (!Number.isFinite(when)) return showError("Pick a date and time.");
  if (when <= Date.now() + 30_000) return showError("Pick a time at least a minute in the future.");

  let tabId = null, windowId = null, url = "";
  if (mode === "tab") {
    const opt = tabSelect.selectedOptions[0];
    if (!opt || !opt.value) return showError("Choose a tab first.");
    tabId = Number(opt.value);
    windowId = Number(opt.dataset.windowId);
    url = opt.dataset.url;
  } else {
    url = urlInput.value.trim();
    if (!/^https?:\/\//i.test(url)) return showError("Enter a full URL starting with http(s)://");
  }

  const id = "w" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const wakes = await loadWakes();
  wakes.push({ id, name, tabId, windowId, url, at: when });
  await saveWakes(wakes);
  await chrome.alarms.create("wake-" + id, { when });

  nameInput.value = "";
  urlInput.value = "";
  await renderList();
});

/* ---------- list + cancel ---------- */
async function cancelWake(id) {
  await chrome.alarms.clear("wake-" + id);
  const wakes = (await loadWakes()).filter((w) => w.id !== id);
  await saveWakes(wakes);
  await renderList();
}

async function renderList() {
  const wakes = await loadWakes();
  wakeList.innerHTML = "";
  wakeEmpty.style.display = wakes.length ? "none" : "block";
  for (const w of wakes) {
    const li = document.createElement("li");
    li.className = "wake-item";

    const icon = document.createElement("span");
    icon.className = "icon";
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 15 15"/></svg>';

    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = w.name;
    const target = document.createElement("div");
    target.className = "target";
    target.textContent = w.tabId != null ? "Tab: " + (w.url || "saved tab") : w.url;
    target.title = w.url || "";
    meta.append(name, target);

    const when = document.createElement("span");
    when.className = "when";
    when.textContent = fmtWhen(w.at);

    const btn = document.createElement("button");
    btn.className = "cancel-btn";
    btn.title = "Cancel wake";
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    btn.addEventListener("click", () => cancelWake(w.id));

    li.append(icon, meta, when, btn);
    wakeList.appendChild(li);
  }
}

/* ---------- init ---------- */
(async function init() {
  // Sensible default: one hour from now, rounded to the minute.
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  whenInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  await refreshTabOptions();
  await renderList();
})();
