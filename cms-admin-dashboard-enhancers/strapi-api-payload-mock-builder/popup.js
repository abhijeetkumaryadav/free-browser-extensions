/* Strapi Mock Payload Builder — popup logic.
   Pure offline mock-data generator. All schemas + output stay on-device
   (chrome.storage.local). Never executes anything; it only builds JSON. */
"use strict";

/* ---------- field types ---------- */
const FIELD_TYPES = [
  "string", "text", "number", "integer", "float", "boolean",
  "date", "datetime", "email", "url", "enumeration", "array", "json", "relation", "media"
];

/* ---------- tiny word pools for realistic values ---------- */
const WORDS = ("lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor " +
  "incididunt labore dolore magna aliqua enim minim veniam quis nostrud exercitation ullamco").split(" ");
const FIRST = ["Ava", "Liam", "Maya", "Noah", "Zara", "Leo", "Ivy", "Kai", "Nora", "Ezra"];
const LAST = ["Sharma", "Khan", "Patel", "Iyer", "Das", "Mehta", "Rao", "Nair", "Singh", "Gupta"];
const DOMAINS = ["example.com", "acme.io", "mail.dev", "shop.co", "studio.app"];

/* ---------- helpers ---------- */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const words = (n) => Array.from({ length: n }, () => pick(WORDS)).join(" ");
const sentence = () => { const s = words(randInt(6, 14)); return s[0].toUpperCase() + s.slice(1) + "."; };
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Generate one mock value for a field type, aware of the field name. */
function mockValue(name, type, id) {
  const n = (name || "").toLowerCase();
  switch (type) {
    case "string":
      if (n.includes("title") || n.includes("name") && !n.includes("user")) return sentence().replace(/\.$/, "");
      if (n.includes("slug")) return slugify(sentence().replace(/\.$/, ""));
      if (n.includes("username") || n.includes("handle")) return pick(FIRST).toLowerCase() + randInt(10, 999);
      return words(randInt(1, 4));
    case "text": return sentence() + " " + sentence();
    case "number": case "float": return +(Math.random() * 1000).toFixed(2);
    case "integer": return randInt(0, 1000);
    case "boolean": return Math.random() > 0.5;
    case "date": { const d = new Date(Date.now() - randInt(0, 365) * 864e5); return d.toISOString().slice(0, 10); }
    case "datetime": { const d = new Date(Date.now() - randInt(0, 365) * 864e5); return d.toISOString(); }
    case "email": return `${pick(FIRST).toLowerCase()}.${pick(LAST).toLowerCase()}@${pick(DOMAINS)}`;
    case "url": return `https://www.${pick(DOMAINS)}/${slugify(words(2))}`;
    case "enumeration": return "option_a"; // user replaces with real enum values
    case "array": return [words(2), words(2), words(2)];
    case "json": return { key: words(2), count: randInt(1, 9) };
    case "relation": return { id: randInt(1, 100), documentId: `doc_${randInt(1000, 9999)}` };
    case "media": return {
      id: randInt(1, 100),
      name: `${slugify(words(2))}.jpg`,
      url: `/uploads/${slugify(words(2))}_${id}.jpg`,
      mime: "image/jpeg",
      width: 1200, height: 800
    };
    default: return words(2);
  }
}

/** Build one mock entry from the field list. */
function buildEntry(fields) {
  const entry = { id: 0, documentId: "" }; // placeholders, fixed below
  for (const f of fields) entry[f.name] = mockValue(f.name, f.type, entry.id);
  return entry;
}

/** Strapi v5-style response shape. */
function strapiWrap(entries, single) {
  const stamp = () => new Date().toISOString();
  const withMeta = (e, i) => ({
    id: i + 1,
    documentId: `mock_${Date.now().toString(36)}_${i}`,
    ...e, id: i + 1,
    createdAt: stamp(), updatedAt: stamp(), publishedAt: stamp()
  });
  if (single) return { data: withMeta(entries[0], 0), meta: {} };
  const data = entries.map(withMeta);
  return { data, meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } } };
}

/* ---------- state ---------- */
let fields = [];          // [{name, type}]
let lastPayload = null;   // last generated JSON string

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const fieldList = $("fieldList");

/** Render the field editor rows. */
function renderFields() {
  fieldList.innerHTML = "";
  if (!fields.length) {
    const p = document.createElement("p");
    p.className = "empty-note";
    p.textContent = "No fields yet — add your first field above.";
    fieldList.appendChild(p);
    return;
  }
  fields.forEach((f, i) => {
    const row = document.createElement("div");
    row.className = "field-row";
    const nameInput = document.createElement("input");
    nameInput.type = "text"; nameInput.placeholder = "field_name"; nameInput.value = f.name;
    nameInput.setAttribute("aria-label", "Field name");
    nameInput.addEventListener("input", () => { fields[i].name = nameInput.value.trim().replace(/\s+/g, "_"); });
    const typeSel = document.createElement("select");
    typeSel.setAttribute("aria-label", "Field type");
    for (const t of FIELD_TYPES) {
      const o = document.createElement("option");
      o.value = t; o.textContent = t; if (t === f.type) o.selected = true;
      typeSel.appendChild(o);
    }
    typeSel.addEventListener("change", () => { fields[i].type = typeSel.value; });
    const rm = document.createElement("button");
    rm.className = "rm"; rm.textContent = "✕"; rm.title = "Remove field";
    rm.addEventListener("click", () => { fields.splice(i, 1); renderFields(); });
    row.append(nameInput, typeSel, rm);
    fieldList.appendChild(row);
  });
}

/* ---------- saved schemas ---------- */
async function refreshSchemaList() {
  const { schemas = {} } = await chrome.storage.local.get("schemas");
  const sel = $("schemaSelect");
  sel.innerHTML = '<option value="">— choose a saved schema —</option>';
  for (const name of Object.keys(schemas).sort()) {
    const o = document.createElement("option");
    o.value = name; o.textContent = `${name} (${schemas[name].length} fields)`;
    sel.appendChild(o);
  }
}

async function saveSchema() {
  const name = $("schemaName").value.trim();
  if (!name) return flash($("saveSchemaBtn"), "Name required");
  if (!fields.length) return flash($("saveSchemaBtn"), "No fields");
  const { schemas = {} } = await chrome.storage.local.get("schemas");
  schemas[name] = fields.map(f => ({ name: f.name || "field", type: f.type }));
  await chrome.storage.local.set({ schemas });
  $("schemaName").value = "";
  await refreshSchemaList();
  flash($("saveSchemaBtn"), "Saved ✓");
}

async function loadSchema() {
  const name = $("schemaSelect").value;
  if (!name) return;
  const { schemas = {} } = await chrome.storage.local.get("schemas");
  if (schemas[name]) { fields = schemas[name].map(f => ({ ...f })); renderFields(); }
}

async function deleteSchema() {
  const name = $("schemaSelect").value;
  if (!name) return;
  const { schemas = {} } = await chrome.storage.local.get("schemas");
  delete schemas[name];
  await chrome.storage.local.set({ schemas });
  await refreshSchemaList();
}

/* ---------- generation ---------- */
function generate() {
  const clean = fields.filter(f => f.name);
  if (!clean.length) return flash($("generateBtn"), "Add at least one named field");
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const count = mode === "collection" ? Math.min(50, Math.max(1, +$("countInput").value || 5)) : 1;
  const entries = Array.from({ length: count }, () => buildEntry(clean));
  const payload = strapiWrap(entries, mode === "single");
  lastPayload = JSON.stringify(payload, null, 2);
  $("output").textContent = lastPayload;
  $("outputCard").hidden = false;
}

async function copyPayload() {
  if (!lastPayload) return;
  await navigator.clipboard.writeText(lastPayload);
  flash($("copyBtn"), "Copied ✓");
}

function downloadPayload() {
  if (!lastPayload) return;
  const blob = new Blob([lastPayload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "mock-payload.json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  flash($("downloadBtn"), "Saved ✓");
}

/** Temporary button label feedback. */
function flash(btn, msg) {
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = old; }, 1400);
}

/* ---------- wiring ---------- */
$("addFieldBtn").addEventListener("click", () => {
  fields.push({ name: "", type: "string" });
  renderFields();
});
$("saveSchemaBtn").addEventListener("click", saveSchema);
$("loadSchemaBtn").addEventListener("click", loadSchema);
$("deleteSchemaBtn").addEventListener("click", deleteSchema);
$("generateBtn").addEventListener("click", generate);
$("copyBtn").addEventListener("click", copyPayload);
$("downloadBtn").addEventListener("click", downloadPayload);
document.querySelectorAll('input[name="mode"]').forEach(r =>
  r.addEventListener("change", () => { $("countInput").disabled = document.querySelector('input[name="mode"]:checked').value !== "collection"; })
);

/* seed with a sensible starter schema on first run */
(async function init() {
  const { seeded } = await chrome.storage.local.get("seeded");
  if (!seeded) {
    fields = [
      { name: "title", type: "string" },
      { name: "slug", type: "string" },
      { name: "content", type: "text" },
      { name: "published", type: "boolean" },
      { name: "publishedAt", type: "datetime" },
      { name: "cover", type: "media" }
    ];
    await chrome.storage.local.set({ seeded: true });
  }
  renderFields();
  await refreshSchemaList();
})();
