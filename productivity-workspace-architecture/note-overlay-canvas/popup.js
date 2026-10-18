// Note Overlay Canvas — popup logic.
// Lists the sticky notes saved for the current site and relays
// commands (add / flash) to the content script living in the tab.

const STORE_KEY = "nuc-notes";
const $ = (id) => document.getElementById(id);

let tabId = null;
let siteOrigin = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("newNote").addEventListener("click", addNote);
  $("clearAll").addEventListener("click", clearAll);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id && tab.url && /^https?:\/\//i.test(tab.url)) {
      tabId = tab.id;
      siteOrigin = new URL(tab.url).origin;
      $("siteLabel").textContent = new URL(tab.url).hostname.replace(/^www\./, "");
    } else {
      $("siteLabel").textContent = "Not a web page";
      $("newNote").disabled = true;
      showHint("Notes work on regular http/https pages. Browser pages, the new-tab page, and store pages are protected by the browser.");
    }
  } catch (e) {
    $("siteLabel").textContent = "Not a web page";
    $("newNote").disabled = true;
  }

  render();
}

async function getNotes() {
  if (!siteOrigin) return [];
  const all = (await chrome.storage.local.get(STORE_KEY))[STORE_KEY] || {};
  return Array.isArray(all[siteOrigin]) ? all[siteOrigin] : [];
}

async function setNotes(notes) {
  const all = (await chrome.storage.local.get(STORE_KEY))[STORE_KEY] || {};
  all[siteOrigin] = notes;
  await chrome.storage.local.set({ [STORE_KEY]: all });
}

function fmtDate(ts) {
  return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function snippet(n) {
  const first = (n.text || "").split("\n").map((l) => l.trim()).find(Boolean);
  if (first) return first.length > 48 ? first.slice(0, 48) + "…" : first;
  return n.min ? "Minimized note" : "Empty note";
}

async function render() {
  const notes = await getNotes();
  const box = $("notes");
  box.innerHTML = "";
  $("count").textContent = notes.length ? notes.length : "";
  $("emptyNotes").hidden = notes.length > 0;

  const sorted = [...notes].sort((a, b) => b.ts - a.ts);
  for (const n of sorted) {
    const row = document.createElement("div");
    row.className = "note-row";
    row.title = "Click to highlight on page";

    const sw = document.createElement("div");
    sw.className = "swatch";
    sw.style.background = n.color || "#fef3c7";

    const txt = document.createElement("div");
    txt.className = "txt";
    const b = document.createElement("b");
    b.textContent = snippet(n);
    const s = document.createElement("span");
    s.textContent = fmtDate(n.ts);
    txt.append(b, s);

    const x = document.createElement("button");
    x.className = "x";
    x.textContent = "×";
    x.title = "Delete note";
    x.addEventListener("click", async (e) => {
      e.stopPropagation();
      await setNotes((await getNotes()).filter((i) => i.id !== n.id));
      render();
    });

    row.addEventListener("click", () => flashNote(n.id));
    row.append(sw, txt, x);
    box.appendChild(row);
  }
}

/** Ask the content script to create a note in the active tab. */
async function addNote() {
  if (tabId == null) return;
  hideHint();
  try {
    await chrome.tabs.sendMessage(tabId, { type: "nuc-add" });
    window.close(); // let the user place/edit the note immediately
  } catch (e) {
    showHint("Couldn’t reach this page — reload it once, then try again. (Some pages block overlays.)");
  }
}

/** Ask the content script to briefly highlight a note. */
async function flashNote(id) {
  if (tabId == null) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type: "nuc-flash", id });
  } catch (e) {
    showHint("Couldn’t reach this page — reload it once, then try again.");
  }
}

/** Two-step confirm for destructive clear-all. */
async function clearAll() {
  const btn = $("clearAll");
  if (!siteOrigin) return;
  if (!btn.classList.contains("confirm")) {
    btn.classList.add("confirm");
    btn.textContent = "Click again to confirm delete";
    setTimeout(() => {
      btn.classList.remove("confirm");
      btn.textContent = "Delete all notes on this site";
    }, 3000);
    return;
  }
  await setNotes([]);
  btn.classList.remove("confirm");
  btn.textContent = "Delete all notes on this site";
  render();
}

function showHint(text) {
  const h = $("hint");
  h.textContent = text;
  h.hidden = false;
}

function hideHint() {
  $("hint").hidden = true;
}
