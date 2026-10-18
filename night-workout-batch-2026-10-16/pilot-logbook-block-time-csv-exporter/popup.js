/* Pilot Logbook — popup logic. Pure logbook engine between markers. */
"use strict";

// ENGINE-START
const CSV_HEADERS = ["date", "aircraft", "route", "block_hours", "landings", "notes"];

function makeEntry(date, aircraft, route, block, landings, notes) {
  const d = String(date || "").trim();
  const b = parseFloat(block);
  const l = parseInt(landings, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  if (!(b > 0 && b <= 24)) return null;
  if (!(l >= 0 && l <= 99)) return null;
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    date: d,
    aircraft: String(aircraft || "").trim().slice(0, 12),
    route: String(route || "").trim().slice(0, 20),
    block: Math.round(b * 10) / 10,
    landings: l,
    notes: String(notes || "").trim().slice(0, 60)
  };
}

function totalsOf(entries) {
  let hours = 0, land = 0;
  for (const e of entries) { hours += e.block; land += e.landings; }
  return { flights: entries.length, hours: Math.round(hours * 10) / 10, landings: land };
}

function sortEntries(entries) {
  return entries.slice().sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : 0));
}

function csvEscape(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv(entries) {
  const rows = [CSV_HEADERS.join(",")];
  for (const e of sortEntries(entries)) {
    rows.push([e.date, e.aircraft, e.route, e.block, e.landings, e.notes].map(csvEscape).join(","));
  }
  return rows.join("\n");
}

// Minimal CSV parse: handles quoted fields with embedded commas/quotes.
function parseCsv(text) {
  const rows = [];
  let row = [], cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some(v => v !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some(v => v !== "")) rows.push(row);
  return rows;
}

function fromCsv(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const head = rows[0].map(h => h.trim().toLowerCase());
  const idx = h => head.indexOf(h);
  const out = [];
  const start = (idx("date") >= 0 && idx("block_hours") >= 0) ? 1 : 0;
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const e = makeEntry(
      r[idx("date")] ?? r[0],
      idx("aircraft") >= 0 ? r[idx("aircraft")] : (r[1] || ""),
      idx("route") >= 0 ? r[idx("route")] : (r[2] || ""),
      idx("block_hours") >= 0 ? r[idx("block_hours")] : (r[3] || ""),
      idx("landings") >= 0 ? r[idx("landings")] : (r[4] || ""),
      idx("notes") >= 0 ? r[idx("notes")] : (r[5] || "")
    );
    if (e) out.push(e);
  }
  return out;
}
// ENGINE-END

/* ---------- UI wiring ---------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let entries = [];

function save() { chrome.storage.local.set({ entries }); }

function render() {
  const t = totalsOf(entries);
  document.getElementById("tFlights").textContent = t.flights;
  document.getElementById("tHours").textContent = t.hours.toFixed(1);
  document.getElementById("tLand").textContent = t.landings;
  const list = document.getElementById("list");
  if (entries.length === 0) {
    list.innerHTML = '<p class="empty">No flights yet — log your first one above.</p>';
    return;
  }
  list.innerHTML = sortEntries(entries).map(e =>
    '<div class="entry" data-id="' + esc(e.id) + '">' +
      '<div><div class="rt">' + esc(e.route || "—") + ' <span style="color:var(--muted);font-weight:400">' + esc(e.aircraft || "") + "</span></div>" +
      '<div class="meta">' + esc(e.date) + " · " + e.block + " h · " + e.landings + " landing" + (e.landings === 1 ? "" : "s") +
      (e.notes ? " · " + esc(e.notes) : "") + "</div></div>" +
      '<button class="del" data-id="' + esc(e.id) + '" title="Delete">×</button>' +
    "</div>"
  ).join("");
}

document.getElementById("form").addEventListener("submit", e => {
  e.preventDefault();
  const entry = makeEntry(
    document.getElementById("fDate").value,
    document.getElementById("fAc").value,
    document.getElementById("fRoute").value,
    document.getElementById("fBlock").value,
    document.getElementById("fLand").value,
    document.getElementById("fNotes").value
  );
  if (!entry) { alert("Check the date and block hours."); return; }
  entries.push(entry);
  save(); render();
  e.target.reset();
  document.getElementById("fLand").value = "1";
});

document.getElementById("list").addEventListener("click", e => {
  const btn = e.target.closest(".del");
  if (!btn) return;
  entries = entries.filter(x => x.id !== btn.dataset.id);
  save(); render();
});

document.getElementById("export").addEventListener("click", () => {
  const blob = new Blob([toCsv(entries)], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "pilot-logbook.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});

document.getElementById("import").addEventListener("change", e => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const got = fromCsv(String(reader.result || ""));
    if (got.length === 0) { alert("No valid flights found in that CSV."); return; }
    if (confirm("Import " + got.length + " flights? This appends to your logbook.")) {
      entries = entries.concat(got);
      save(); render();
    }
  };
  reader.readAsText(f);
  e.target.value = "";
});

chrome.storage.local.get("entries", d => {
  entries = Array.isArray(d.entries) ? d.entries : [];
  document.getElementById("fDate").value = new Date().toISOString().slice(0, 10);
  render();
});
