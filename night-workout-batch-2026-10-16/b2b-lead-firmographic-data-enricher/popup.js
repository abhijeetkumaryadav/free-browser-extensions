/* Lead Record Keeper — popup logic.
 * Honest scope: manual record keeping only. Nothing is enriched, fetched,
 * or looked up from any source — all data is typed or imported by the user
 * and stored locally in chrome.storage.local. */
"use strict";

const KEY = "b2b_leads_v1";
const HEADERS = ["company", "size", "industry", "revenue", "location",
  "contactName", "contactEmail", "notes"];

/* ---------- storage ---------- */
async function loadLeads() {
  const data = await chrome.storage.local.get(KEY);
  return data[KEY] || [];
}
async function saveLeads(items) {
  await chrome.storage.local.set({ [KEY]: items });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- tabs ---------- */
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tabpane").forEach((p) => p.classList.add("hidden"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.remove("hidden");
  });
});

/* ---------- list / search ---------- */
const leadsEl = document.getElementById("leads");
const searchEl = document.getElementById("search");

async function renderList() {
  const items = await loadLeads();
  const f = searchEl.value.trim().toLowerCase();
  const shown = items.filter((it) =>
    !f || ["company", "contactName", "contactEmail", "industry", "location", "notes"]
      .some((k) => (it[k] || "").toLowerCase().includes(f)));
  leadsEl.innerHTML = "";
  if (!shown.length) {
    leadsEl.innerHTML = `<li class="empty">No leads yet. Add one, or import CSV.</li>`;
    return;
  }
  for (const it of shown) {
    const li = document.createElement("li");
    const tags = ["size", "industry", "revenue", "location"]
      .filter((k) => it[k])
      .map((k) => `<span class="tag">${escapeHtml(it[k])}</span>`)
      .join("");
    li.innerHTML =
      `<div class="co">${escapeHtml(it.company)}</div>` +
      (tags ? `<div class="tags">${tags}</div>` : "") +
      (it.contactName || it.contactEmail
        ? `<div class="sub">${escapeHtml(it.contactName)}${it.contactName && it.contactEmail ? " · " : ""}${escapeHtml(it.contactEmail)}</div>`
        : "") +
      (it.notes ? `<div class="note">${escapeHtml(it.notes)}</div>` : "") +
      `<div class="actions"><button class="danger" data-id="${it.id}">Delete</button></div>`;
    leadsEl.appendChild(li);
  }
  leadsEl.querySelectorAll("button.danger").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await saveLeads((await loadLeads()).filter((it) => it.id !== btn.dataset.id));
      renderList();
    });
  });
}
searchEl.addEventListener("input", renderList);

/* ---------- add form ---------- */
document.getElementById("lead-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const lead = { id: Date.now().toString(36) };
  for (const h of HEADERS) lead[h] = form.elements[h].value.trim();
  if (!lead.company) return;
  const items = await loadLeads();
  items.unshift(lead);
  await saveLeads(items);
  form.reset();
  document.querySelector('.tab[data-tab="list"]').click();
  renderList();
});

/* ---------- CSV import/export ---------- */
function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

document.getElementById("export-btn").addEventListener("click", async () => {
  const items = await loadLeads();
  const lines = [HEADERS.join(",")];
  for (const it of items) lines.push(HEADERS.map((h) => csvEscape(it[h])).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leads.csv";
  a.click();
  URL.revokeObjectURL(url);
});

/** Minimal CSV row parser handling quotes. Returns array of cells. */
function parseRow(row) {
  const cells = [];
  let cur = "", inQ = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (inQ) {
      if (c === '"') {
        if (row[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { cells.push(cur); cur = ""; }
    else cur += c;
  }
  cells.push(cur);
  return cells;
}

document.getElementById("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const msg = document.getElementById("io-msg");
  msg.className = "msg";
  if (!file) return;
  const text = await file.text();
  const rows = text.split(/\r?\n/).filter((r) => r.trim());
  if (!rows.length) { msg.textContent = "CSV file is empty."; return; }
  const headers = parseRow(rows[0]).map((h) => h.trim());
  const idx = {};
  headers.forEach((h, i) => { if (HEADERS.includes(h)) idx[h] = i; });
  if (!("company" in idx)) {
    msg.textContent = "Missing required 'company' header. See expected headers above.";
    return;
  }
  const items = await loadLeads();
  let count = 0;
  for (const r of rows.slice(1)) {
    const cells = parseRow(r);
    if (!cells.every((c) => c === "")) {
      const lead = { id: Date.now().toString(36) + count };
      for (const h of HEADERS) lead[h] = (cells[idx[h]] ?? "").trim();
      if (lead.company) { items.unshift(lead); count++; }
    }
  }
  await saveLeads(items);
  e.target.value = "";
  msg.textContent = `Imported ${count} lead${count === 1 ? "" : "s"}.`;
  msg.className = "msg ok";
  renderList();
});

document.getElementById("clear-btn").addEventListener("click", async () => {
  if (!confirm("Delete ALL leads? This cannot be undone.")) return;
  await saveLeads([]);
  renderList();
});

renderList();
