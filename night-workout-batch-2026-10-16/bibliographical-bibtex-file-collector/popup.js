/* BibTeX Collector — popup logic + pure engine (testable headless) */
// ===== ENGINE-START =====
// Pure engine: no chrome.* calls, safe to eval in node for tests.
const MAX_ENTRIES = 1000;
const VALID_TYPES = ["article","book","inproceedings","misc","phdthesis","mastersthesis","techreport","incollection","inbook","manual","proceedings","unpublished"];

// BibTeX citation keys: letters, digits and :._-+/
const KEY_RE = /^[A-Za-z0-9:._+\-\/]+$/;

function cleanText(s, cap) {
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim().slice(0, cap);
}

// Parse "field = value" lines from the extra-fields textarea.
function parseExtraLines(text) {
  const fields = {};
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim().replace(/,$/, "");
    if (!line) continue;
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(.+)$/);
    if (m) fields[m[1].toLowerCase()] = m[2].trim();
  }
  return fields;
}

// Validate + build an entry. existing = array of entries for duplicate-key check.
function makeEntry({ type, key, title, author, year, journal, extra }, existing) {
  const t = cleanText(type, 40).toLowerCase();
  if (!VALID_TYPES.includes(t)) return { ok: false, error: "Unknown entry type: " + type };
  const k = cleanText(key, 120);
  if (!k) return { ok: false, error: "Citation key is required." };
  if (!KEY_RE.test(k)) return { ok: false, error: "Key may only use letters, digits and : . _ + - /" };
  if ((existing || []).some((e) => e.key.toLowerCase() === k.toLowerCase())) {
    return { ok: false, error: "Duplicate citation key: " + k };
  }
  const y = year === "" || year == null ? null : Number(year);
  if (y !== null && (!Number.isInteger(y) || y < 1800 || y > 2100)) {
    return { ok: false, error: "Year must be between 1800 and 2100." };
  }
  const fields = {};
  const ti = cleanText(title, 500); if (ti) fields.title = ti;
  const au = cleanText(author, 500); if (au) fields.author = au;
  if (y !== null) fields.year = String(y);
  const jo = cleanText(journal, 300); if (jo) fields.journal = jo;
  Object.assign(fields, parseExtraLines(extra));
  return { ok: true, entry: { id: "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), type: t, key: k, fields, addedAt: new Date().toISOString() } };
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
}

function filterEntries(entries, q) {
  const query = cleanText(q, 300).toLowerCase();
  if (!query) return [...entries];
  return entries.filter((e) => {
    const hay = [e.key, e.type, ...Object.values(e.fields || {})].join(" ").toLowerCase();
    return hay.includes(query);
  });
}

// Escape a value for .bib output: wrap in braces.
function bibValue(v) {
  return "{" + String(v).replace(/[{]/g, "\\{").replace(/[}]/g, "\\}") + "}";
}

// Serialize entries to a .bib string.
function serializeBib(entries) {
  return entries.map((e) => {
    const lines = Object.entries(e.fields || {}).map(([f, v]) => `  ${f} = ${bibValue(v)},`);
    return `@${e.type}{${e.key},\n${lines.join("\n")}\n}`;
  }).join("\n\n");
}

// Strip one layer of braces/quotes from a raw field value.
function unquote(v) {
  v = v.trim();
  if ((v.startsWith("{") && v.endsWith("}")) || (v.startsWith('"') && v.endsWith('"'))) {
    return v.slice(1, -1).trim();
  }
  return v;
}

// Split top-level comma-separated field assignments, respecting braces/quotes.
function splitFields(body) {
  const parts = [];
  let depth = 0, inQuote = false, cur = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' && depth === 0) inQuote = !inQuote;
    else if (!inQuote && c === "{") depth++;
    else if (!inQuote && c === "}") depth--;
    if (c === "," && depth === 0 && !inQuote) { parts.push(cur); cur = ""; }
    else cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

// Basic .bib parser. Returns {entries:[{type,key,fields}], errors:[...]}.
function parseBib(text) {
  const entries = [], errors = [];
  const re = /@(\w+)\s*\{\s*([^,{}]+?)\s*,/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const type = m[1].toLowerCase(), key = m[2];
    // find matching close brace for the entry body
    let depth = 1, i = re.lastIndex, inQuote = false;
    while (i < text.length && depth > 0) {
      const c = text[i];
      if (c === '"' && depth === 1) inQuote = !inQuote;
      else if (!inQuote && c === "{") depth++;
      else if (!inQuote && c === "}") depth--;
      i++;
    }
    const body = text.slice(re.lastIndex, i - 1);
    re.lastIndex = i;
    if (!VALID_TYPES.includes(type)) { errors.push(`Skipped @${type} (unknown type)`); continue; }
    if (!KEY_RE.test(key)) { errors.push(`Skipped key "${key}" (invalid characters)`); continue; }
    const fields = {};
    for (const part of splitFields(body)) {
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      const fname = part.slice(0, eq).trim().toLowerCase();
      if (!/^[a-z][a-z0-9_-]*$/.test(fname)) continue;
      fields[fname] = unquote(part.slice(eq + 1));
    }
    entries.push({ type, key, fields });
  }
  if (!entries.length && !errors.length) errors.push("No @type{key, ...} entries found.");
  return { entries, errors };
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
// ===== ENGINE-END =====

(function () {
  const $ = (id) => document.getElementById(id);
  const list = $("list"), stats = $("stats"), search = $("search");
  let entries = [];

  function render() {
    const types = new Set(entries.map((e) => e.type));
    stats.innerHTML =
      `<div class="stat"><b>${entries.length}</b><span>entries</span></div>` +
      `<div class="stat"><b>${types.size}</b><span>types</span></div>`;
    const items = filterEntries(sortEntries(entries), search.value);
    $("count").textContent = items.length + " shown";
    list.innerHTML = items.length
      ? items.map((e) => {
          const f = e.fields || {};
          return `<div class="item" data-id="${esc(e.id)}">
            <span class="key">${esc(e.key)}</span><span class="type">@${esc(e.type)}</span>
            ${f.title ? `<h3>${esc(f.title)}</h3>` : ""}
            <div class="meta">${f.author ? esc(f.author) + " · " : ""}${f.year ?? ""}${f.journal ? " · " + esc(f.journal) : ""}</div>
            <div class="actions">
              <button class="link" data-copy="${esc(e.id)}">Copy .bib</button>
              <button class="link danger" data-del="${esc(e.id)}">Delete</button>
            </div>
          </div>`;
        }).join("")
      : `<div class="empty">No entries yet. Add your first one above.</div>`;
  }

  function save() { chrome.storage.local.set({ entries }); }

  $("addForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const r = makeEntry({
      type: $("fType").value, key: $("fKey").value, title: $("fTitle").value,
      author: $("fAuthor").value, year: $("fYear").value, journal: $("fJournal").value,
      extra: $("fExtra").value,
    }, entries);
    if (!r.ok) { $("formError").textContent = r.error; return; }
    $("formError").textContent = "";
    entries = [r.entry, ...entries].slice(0, MAX_ENTRIES);
    e.target.reset();
    save(); render();
  });

  list.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      entries = entries.filter((x) => x.id !== del.dataset.del);
      save(); render(); return;
    }
    const cp = e.target.closest("[data-copy]");
    if (cp) {
      const entry = entries.find((x) => x.id === cp.dataset.copy);
      if (entry) navigator.clipboard.writeText(serializeBib([entry])).catch(() => {});
    }
  });

  search.addEventListener("input", render);

  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([serializeBib(entries)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "library.bib";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });

  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      const { entries: parsed, errors } = parseBib(String(rd.result || ""));
      let added = 0, skipped = 0;
      for (const p of parsed) {
        const r = makeEntry({ type: p.type, key: p.key, title: p.fields.title || "", author: p.fields.author || "", year: p.fields.year || "", journal: p.fields.journal || p.fields.booktitle || "", extra: Object.entries(p.fields).filter(([k]) => !["title","author","year","journal","booktitle"].includes(k)).map(([k,v]) => `${k} = ${v}`).join("\n") }, entries);
        if (r.ok) { entries.unshift(r.entry); added++; } else skipped++;
      }
      entries = entries.slice(0, MAX_ENTRIES);
      save(); render();
      alert(`Imported ${added} entr${added === 1 ? "y" : "ies"}. Skipped ${skipped}.${errors.length ? "\n" + errors.slice(0, 5).join("\n") : ""}`);
    };
    rd.readAsText(file);
    e.target.value = "";
  });

  chrome.storage.local.get({ entries: [] }, (res) => {
    entries = Array.isArray(res.entries) ? res.entries : [];
    render();
  });
})();
