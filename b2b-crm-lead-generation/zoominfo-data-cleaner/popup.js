// ZoomInfo Data Cleaner — popup logic.
// Parses pasted CSV/TSV contact data, normalizes fields, dedupes,
// flags incomplete rows, and exports a clean CSV. All on-device.

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  $("cleanBtn").addEventListener("click", clean);
  $("copyBtn").addEventListener("click", copyCsv);
  $("dlBtn").addEventListener("click", downloadCsv);
  // restore last session (options + cleaned result) from on-device storage
  chrome.storage.local.get(["zdc"], (s) => {
    if (!s.zdc) return;
    $("optDedupe").checked = s.zdc.dedupe !== false;
    $("optIncomplete").checked = s.zdc.incomplete !== false;
    if (s.zdc.rows && s.zdc.rows.length) {
      cleanRows = s.zdc.rows;
      renderResult(s.zdc.in, cleanRows.length, s.zdc.dupes, s.zdc.flagged);
    }
  });
});

let cleanRows = [];   // last cleaned result for export/copy

/* ---------- CSV parsing ---------- */

function splitLine(line, delim) {
  // quote-aware split for simple CSV/TSV
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === delim && !inQ) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function detectDelim(lines) {
  const first = lines[0] || "";
  if (first.includes("\t")) return "\t";
  if (first.includes(";") && !first.includes(",")) return ";";
  return ",";
}

// Map messy header names to canonical fields
function canonHeader(h) {
  const k = h.trim().toLowerCase().replace(/[^a-z]/g, "");
  const map = {
    name: "name", fullname: "name", contactname: "name", contact: "name",
    firstname: "first", fname: "first", givenname: "first",
    lastname: "last", lname: "last", surname: "last", familyname: "last",
    email: "email", emailaddress: "email", mail: "email",
    phone: "phone", phonenumber: "phone", tel: "phone", telephone: "phone", mobile: "phone",
    company: "company", companyname: "company", organization: "company", org: "company", employer: "company",
    title: "title", jobtitle: "title", position: "title", role: "title",
  };
  return map[k] || null;
}

/* ---------- normalizers ---------- */

function titleCaseName(s) {
  return s.trim().toLowerCase().split(/\s+/)
    .map((w) => {
      if (/^o'/.test(w)) return "O'" + w.slice(2, 3).toUpperCase() + w.slice(3);
      if (/^mc/.test(w) && w.length > 2) return "Mc" + w[2].toUpperCase() + w.slice(3);
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

function cleanPhone(s) {
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return "+" + digits;   // keep other country formats intact, normalized
}

function cleanEmail(s) {
  const e = s.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : "";
}

function cleanCompany(s) {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (/^[A-Z0-9&.\- ]+$/.test(t) && t.length <= 8) return t;  // keep acronyms: IBM, 3M
  return t.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/* ---------- main clean ---------- */

function clean() {
  const raw = $("raw").value.trim();
  if (!raw) return;
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return;

  const delim = detectDelim(lines);
  const headers = splitLine(lines[0], delim);
  const idx = {};   // canonical field -> column index
  headers.forEach((h, i) => {
    const c = canonHeader(h);
    if (c && !(c in idx)) idx[c] = i;
  });

  const rows = [];
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, delim);
    const get = (f) => (idx[f] != null ? (cells[idx[f]] || "").trim() : "");
    let name = get("name");
    if (!name && (get("first") || get("last"))) {
      name = [get("first"), get("last")].filter(Boolean).join(" ");
    }
    const email = cleanEmail(get("email"));
    const phone = cleanPhone(get("phone"));
    const company = cleanCompany(get("company"));
    const title = get("title").trim().replace(/\s+/g, " ");
    rows.push({
      name: titleCaseName(name),
      email, phone, company, title,
      incomplete: !(name.trim() && email && phone),
    });
  }

  // dedupe: by email, else name+company
  const dedupe = $("optDedupe").checked;
  const seen = new Set();
  let dupeCount = 0;
  const deduped = [];
  for (const r of rows) {
    const key = r.email
      ? "e:" + r.email
      : "n:" + (r.name + "|" + r.company).toLowerCase();
    if (dedupe && seen.has(key)) { dupeCount++; continue; }
    seen.add(key);
    deduped.push(r);
  }

  const keepIncomplete = $("optIncomplete").checked;
  const beforeFlag = deduped.length;
  const final = keepIncomplete ? deduped : deduped.filter((r) => !r.incomplete);
  const flagged = final.filter((r) => r.incomplete).length;

  cleanRows = final;
  renderResult(rows.length, final.length, dupeCount + (beforeFlag - final.length), flagged);
  // persist session on-device so results survive popup close
  chrome.storage.local.set({
    zdc: {
      dedupe, incomplete: keepIncomplete,
      rows: final, in: rows.length,
      dupes: dupeCount + (beforeFlag - final.length), flagged,
    },
  });
}

function renderResult(nIn, nOut, nDupes, nFlagged) {
  $("resultCard").hidden = false;
  $("stIn").textContent = nIn;
  $("stOut").textContent = nOut;
  $("stDupes").textContent = nDupes;
  $("stFlag").textContent = nFlagged;

  const prev = $("preview");
  prev.innerHTML = "";
  if (!cleanRows.length) {
    prev.textContent = "No rows left after cleaning.";
    return;
  }
  const t = document.createElement("table");
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  ["Name", "Email", "Phone", "Company", "Title"].forEach((h) => {
    const th = document.createElement("th"); th.textContent = h; hr.appendChild(th);
  });
  thead.appendChild(hr); t.appendChild(thead);
  const tb = document.createElement("tbody");
  for (const r of cleanRows.slice(0, 200)) {
    const tr = document.createElement("tr");
    if (r.incomplete) tr.className = "flagged";
    [r.name, r.email, r.phone, r.company, r.title].forEach((v) => {
      const td = document.createElement("td"); td.textContent = v; tr.appendChild(td);
    });
    tb.appendChild(tr);
  }
  t.appendChild(tb);
  prev.appendChild(t);
}

function toCsv() {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [["name", "email", "phone", "company", "title", "incomplete"]];
  for (const r of cleanRows) {
    lines.push([r.name, r.email, r.phone, r.company, r.title, r.incomplete ? "yes" : "no"]);
  }
  return lines.map((l) => l.map(esc).join(",")).join("\n");
}

function copyCsv() {
  if (!cleanRows.length) return;
  navigator.clipboard.writeText(toCsv()).then(() => {
    $("copyBtn").textContent = "Copied ✓";
    setTimeout(() => { $("copyBtn").textContent = "Copy CSV"; }, 1500);
  });
}

function downloadCsv() {
  if (!cleanRows.length) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([toCsv()], { type: "text/csv" }));
  a.download = "cleaned-contacts.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
