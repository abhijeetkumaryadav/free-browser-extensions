"use strict";
/* Mode-S Hex Decoder — pure decode engine is headless-testable between the markers. */

// ENGINE-START
// Bundled ICAO 24-bit address allocations (selected country blocks, educational).
// Listed longest-prefix-first so more specific blocks match before general ones.
const COUNTRY_BLOCKS = [
  { prefix: "A",   country: "United States",  range: "A00000–AFFFFF", note: "US block — largest single allocation." },
  { prefix: "C2",  country: "Canada",         range: "C2A000–C2FFF8", note: "Canadian block within C2xxxx." },
  { prefix: "C",   country: "Canada",         range: "C00000–C3FFFF", note: "Canadian allocation." },
  { prefix: "43",  country: "United Kingdom", range: "430000–43FFFF", note: "UK block (G- registrations)." },
  { prefix: "4C",  country: "United Kingdom", range: "4C0000–4CFFFF", note: "UK overflow block." },
  { prefix: "4CA", country: "Ireland",        range: "4CA000–4CAFFF", note: "Irish block (EI- registrations)." },
  { prefix: "4B",  country: "Switzerland",    range: "4B0000–4BFFFF", note: "Swiss block (HB- registrations)." },
  { prefix: "4A",  country: "Sweden",         range: "4A0000–4AFFFF", note: "Swedish block (SE- registrations)." },
  { prefix: "44",  country: "Austria",        range: "440000–447FFF", note: "Austrian block (OE- registrations)." },
  { prefix: "45",  country: "Denmark",        range: "450000–457FFF", note: "Danish block (OY- registrations)." },
  { prefix: "47",  country: "Norway",         range: "478000–47FFFF", note: "Norwegian block (LN- registrations)." },
  { prefix: "48",  country: "Netherlands",    range: "480000–487FFF", note: "Dutch block (PH- registrations)." },
  { prefix: "3C",  country: "Germany",        range: "3C0000–3FFFFF", note: "German block (D- registrations)." },
  { prefix: "38",  country: "France",         range: "380000–39FFFF", note: "French block (F- registrations)." },
  { prefix: "34",  country: "Spain",          range: "340000–347FFF", note: "Spanish block (EC- registrations)." },
  { prefix: "30",  country: "Italy",          range: "300000–33FFFF", note: "Italian block (I- registrations)." },
  { prefix: "39",  country: "France",         range: "380000–39FFFF", note: "French block (F- registrations)." },
  { prefix: "7C",  country: "Australia",      range: "7C0000–7FFFFF", note: "Australian block (VH- registrations)." },
  { prefix: "78",  country: "China",          range: "780000–7BFFFF", note: "Chinese block (B- registrations)." },
  { prefix: "84",  country: "Japan",          range: "840000–87FFFF", note: "Japanese block (JA- registrations)." },
  { prefix: "80",  country: "India",          range: "800000–83FFFF", note: "Indian block (VT- registrations)." },
  { prefix: "E4",  country: "Brazil",         range: "E40000–E4FFFF", note: "Brazilian block (PT-/PR- registrations)." },
  { prefix: "10",  country: "Russia",         range: "100000–1FFFFF", note: "Russian block (RA- registrations)." },
];

// Strip junk, uppercase; returns null unless exactly 6 hex digits.
function normalizeHex(raw) {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toUpperCase().replace(/^0X/, "").replace(/[^0-9A-F]/g, "");
  return /^[0-9A-F]{6}$/.test(cleaned) ? cleaned : null;
}

function isValidHex(raw) { return normalizeHex(raw) !== null; }

// Longest-prefix match against COUNTRY_BLOCKS. Returns entry or null.
function countryFor(hex) {
  const code = normalizeHex(hex);
  if (!code) return null;
  let best = null;
  for (const b of COUNTRY_BLOCKS) {
    if (code.startsWith(b.prefix) && (!best || b.prefix.length > best.prefix.length)) best = b;
  }
  return best;
}

function decodeHex(hex) {
  const code = normalizeHex(hex);
  if (!code) return { ok: false, error: "Enter exactly 6 hex digits (0–9, A–F)." };
  const block = countryFor(code);
  if (!block) return { ok: true, code, country: "Unknown block", detail: "Prefix not in the bundled table — educational subset only." };
  return { ok: true, code, country: block.country, detail: block.note + " Range: " + block.range };
}
// ENGINE-END

/* ---------- Popup wiring (not part of the headless engine) ---------- */
const hexInput = document.getElementById("hexInput");
const decodeBtn = document.getElementById("decodeBtn");
const resultCard = document.getElementById("resultCard");
const resultCode = document.getElementById("resultCode");
const resultCountry = document.getElementById("resultCountry");
const resultDetail = document.getElementById("resultDetail");
const noteInput = document.getElementById("noteInput");
const saveBtn = document.getElementById("saveBtn");
const logList = document.getElementById("logList");

function render() {
  const r = decodeHex(hexInput.value);
  if (r.ok) {
    resultCard.classList.remove("hidden");
    resultCode.textContent = r.code;
    resultCountry.textContent = r.country;
    resultDetail.textContent = r.detail;
  } else {
    resultCard.classList.remove("hidden");
    resultCode.textContent = "———";
    resultCountry.textContent = "";
    resultDetail.textContent = r.error;
  }
}

hexInput.addEventListener("input", render);
decodeBtn.addEventListener("click", render);

async function loadLog() {
  const { log = [] } = await chrome.storage.local.get("log");
  logList.innerHTML = "";
  for (const [i, entry] of log.entries()) {
    const li = document.createElement("li");
    const left = document.createElement("span");
    left.innerHTML = '<span class="code-small">' + entry.code + "</span> · " +
      entry.country + (entry.note ? " — " + entry.note : "");
    const del = document.createElement("button");
    del.className = "del"; del.textContent = "×"; del.title = "Delete";
    del.addEventListener("click", async () => {
      const d = (await chrome.storage.local.get("log")).log || [];
      d.splice(i, 1);
      await chrome.storage.local.set({ log: d });
      loadLog();
    });
    li.append(left, del);
    logList.appendChild(li);
  }
}

saveBtn.addEventListener("click", async () => {
  const r = decodeHex(hexInput.value);
  if (!r.ok) { render(); return; }
  const d = (await chrome.storage.local.get("log")).log || [];
  if (!d.some((e) => e.code === r.code)) {
    d.unshift({ code: r.code, country: r.country, note: noteInput.value.trim().slice(0, 80), ts: Date.now() });
    await chrome.storage.local.set({ log: d.slice(0, 50) });
  }
  noteInput.value = "";
  loadLog();
});

render();
loadLog();
