/* ============================================================
   Etymology Hover — personal word-etymology dictionary.
   Entries (word → etymology note) are user-created and stored
   locally. The content script wraps page matches in highlighted
   spans; hovering shows a tooltip with YOUR note.
   Honest scope: your entries only — NOT a real etymology
   dictionary. Nothing leaves the browser.
   ============================================================ */
"use strict";

/* // ENGINE-START */

/** Normalize a dictionary word key. */
function normKey(w) { return (w || "").trim().toLowerCase(); }

/** Validate an entry: word 1–60 chars, note 1–500 chars. */
function validateEntry(word, note) {
  const w = normKey(word);
  if (!w) return "Enter a word.";
  if (w.length > 60) return "Word is too long (max 60 characters).";
  if (!note || !note.trim()) return "Enter an etymology note.";
  if (note.trim().length > 500) return "Note is too long (max 500 characters).";
  return null;
}

/** Escape a string for RegExp use. */
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/** Build a whole-word, case-insensitive pattern from entry keys. Longest first. */
function buildPattern(entries) {
  const keys = Object.keys(entries).sort((a, b) => b.length - a.length);
  if (!keys.length) return null;
  return new RegExp("(?<!\\w)(" + keys.map(escapeRe).join("|") + ")(?!\\w)", "gi");
}

/* // ENGINE-END */

/* ---------------- popup UI ---------------- */

const $ = id => document.getElementById(id);
const KEY = "entries";

async function loadEntries() {
  const { [KEY]: e } = await chrome.storage.local.get(KEY);
  return e || {};
}
async function saveEntries(e) { await chrome.storage.local.set({ [KEY]: e }); }

async function refreshList() {
  const entries = await loadEntries();
  const keys = Object.keys(entries).sort();
  $("count").textContent = keys.length;
  const list = $("list");
  list.innerHTML = "";
  if (!keys.length) {
    list.innerHTML = '<div class="empty">No entries yet — add your first word above.</div>';
    return;
  }
  keys.forEach(k => {
    const div = document.createElement("div");
    div.className = "entry";
    const del = document.createElement("button");
    del.className = "del"; del.textContent = "Delete";
    del.addEventListener("click", async () => {
      const e = await loadEntries(); delete e[k]; await saveEntries(e); refreshList();
    });
    const w = document.createElement("div"); w.className = "ew"; w.textContent = k;
    const n = document.createElement("div"); n.className = "en"; n.textContent = entries[k];
    div.appendChild(del); div.appendChild(w); div.appendChild(n);
    list.appendChild(div);
  });
}

$("add").addEventListener("click", async () => {
  const err = $("addErr");
  const word = $("wWord").value, note = $("wNote").value.trim();
  const problem = validateEntry(word, note);
  if (problem) { err.hidden = false; err.textContent = problem; return; }
  const entries = await loadEntries();
  const k = normKey(word);
  if (entries[k]) { err.hidden = false; err.textContent = "That word already has an entry."; return; }
  entries[k] = note;
  await saveEntries(entries);
  $("wWord").value = ""; $("wNote").value = "";
  err.hidden = true;
  refreshList();
});

/* Toggle hover tooltips on the active tab (click-only injection). */
$("enabled").addEventListener("change", async (e) => {
  const on = e.target.checked;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || /^chrome:|^edge:|^about:/.test(tab.url || "")) {
      e.target.checked = false;
      return;
    }
    if (on) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      const entries = await loadEntries();
      await chrome.tabs.sendMessage(tab.id, { type: "ETYM_APPLY", entries });
    } else {
      try { await chrome.tabs.sendMessage(tab.id, { type: "ETYM_REMOVE" }); }
      catch (_) { /* content script not present */ }
    }
  } catch (err) {
    e.target.checked = false;
  }
});

refreshList();
