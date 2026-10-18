"use strict";
/* Mode-S Hex Explainer — educational ICAO 24-bit code guide + manual log.
 * No live tracking, no receiver: the country-block lookup is a static table. */

// ================= ENGINE-START =================
// Static lookup: known ICAO 24-bit allocation block prefixes -> registry.
// Longest-prefix match so "7C" beats "7".
const COUNTRY_BLOCKS = [
  ["7C", "Australia"], ["71", "Japan"], ["39", "Italy"], ["4B", "Germany"],
  ["38", "France"], ["40", "United Kingdom"], ["E4", "Spain"], ["48", "Netherlands"],
  ["A", "United States"], ["C", "Canada"], ["4", "Germany"], ["3", "Italy"],
  ["5", "Ireland / France range"], ["6", "Brazil / others"], ["7", "Japan / Australia range"],
  ["8", "various"], ["9", "various"], ["0", "various"], ["1", "various"], ["2", "various"],
  ["B", "China"], ["D", "various"], ["E", "Spain / others"], ["F", "various"]
];

function normalizeHex(s) {
  return (s || "").trim().toUpperCase().replace(/[^0-9A-F]/g, "");
}
function isValidHex(s) {
  return /^[0-9A-F]{6}$/.test(normalizeHex(s));
}
function countryFor(hex) {
  const h = normalizeHex(hex);
  for (const [prefix, name] of COUNTRY_BLOCKS) {
    if (h.startsWith(prefix)) return name;
  }
  return "Unknown block";
}
function makeEntry(hex, note) {
  const h = normalizeHex(hex);
  if (!isValidHex(h)) return null;
  return { hex: h, country: countryFor(h), note: (note || "").trim().slice(0, 200), ts: Date.now() };
}
// ================= ENGINE-END =================

// ---- UI ----
const hexInput = document.getElementById("hexInput");
const noteInput = document.getElementById("noteInput");
const hexHint = document.getElementById("hexHint");
const logList = document.getElementById("logList");
const countEl = document.getElementById("count");

let entries = [];

async function load() {
  const { entries: saved } = await chrome.storage.local.get("entries");
  entries = Array.isArray(saved) ? saved : [];
  render();
}
async function save() {
  await chrome.storage.local.set({ entries: entries.slice(0, 500) });
}

function render() {
  countEl.textContent = entries.length;
  logList.innerHTML = "";
  if (!entries.length) {
    const li = document.createElement("li");
    li.innerHTML = '<span class="empty">No codes logged yet.</span>';
    logList.appendChild(li);
    return;
  }
  for (const e of entries) {
    const li = document.createElement("li");
    const code = document.createElement("span");
    code.className = "hex";
    code.textContent = e.hex;
    const meta = document.createElement("span");
    meta.className = "country";
    meta.textContent = e.country + (e.note ? " · " + e.note : "");
    meta.title = meta.textContent;
    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "×";
    del.title = "Delete";
    del.addEventListener("click", async () => {
      entries = entries.filter((x) => x !== e);
      await save();
      render();
    });
    li.append(code, meta, del);
    logList.appendChild(li);
  }
}

hexInput.addEventListener("input", () => {
  const h = normalizeHex(hexInput.value);
  if (h.length === 0) {
    hexHint.textContent = "Type a 6-digit hex code — its country block is detected automatically.";
  } else if (isValidHex(h)) {
    hexHint.innerHTML = "";
    hexHint.append("Detected block: ");
    const strong = document.createElement("strong");
    strong.textContent = countryFor(h);
    hexHint.appendChild(strong);
  } else {
    hexHint.textContent = "Keep typing — needs exactly 6 hex digits (0–9, A–F).";
  }
});

async function add() {
  const e = makeEntry(hexInput.value, noteInput.value);
  if (!e) { hexHint.textContent = "Enter a valid 6-digit hex code first."; return; }
  if (entries.some((x) => x.hex === e.hex)) { hexHint.textContent = "That code is already in your log."; return; }
  entries.unshift(e);
  await save();
  hexInput.value = ""; noteInput.value = "";
  hexHint.textContent = "Type a 6-digit hex code — its country block is detected automatically.";
  render();
}
document.getElementById("addBtn").addEventListener("click", add);
noteInput.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
hexInput.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });

load();
