/* Mailto Template Builder — popup logic.
   All local: templates live in chrome.storage.local. The extension only
   BUILDS mailto: links and opens them in the user's mail client.
   It never sends email itself. */

const $ = (id) => document.getElementById(id);
const STORE_KEY = "mailtoTemplates";

// ---- Storage ------------------------------------------------------------
async function loadTemplates() {
  const { [STORE_KEY]: t } = await chrome.storage.local.get(STORE_KEY);
  return Array.isArray(t) ? t : [];
}
async function saveTemplates(tpls) {
  await chrome.storage.local.set({ [STORE_KEY]: tpls });
}
const uid = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---- Placeholders -------------------------------------------------------
// Finds {{name}} tokens across subject+body, in first-seen order.
function findPlaceholders(tpl) {
  const seen = [];
  const re = /\{\{\s*([A-Za-z0-9_ ]+?)\s*\}\}/g;
  for (const src of [tpl.subject || "", tpl.body || ""]) {
    let m;
    while ((m = re.exec(src))) {
      const name = m[1].trim();
      if (name && !seen.includes(name)) seen.push(name);
    }
  }
  return seen;
}

function fill(tpl, values) {
  const sub = (s) =>
    (s || "").replace(/\{\{\s*([A-Za-z0-9_ ]+?)\s*\}\}/g, (_, n) => values[n.trim()] ?? "");
  return { to: tpl.to, cc: tpl.cc, bcc: tpl.bcc, subject: sub(tpl.subject), body: sub(tpl.body) };
}

// Builds a mailto: URL. Address fields are used as-is (user-typed);
// subject/body are percent-encoded.
function buildMailto(filled) {
  const params = new URLSearchParams();
  if (filled.subject) params.set("subject", filled.subject);
  if (filled.body) params.set("body", filled.body);
  if (filled.cc) params.set("cc", filled.cc);
  if (filled.bcc) params.set("bcc", filled.bcc);
  const q = params.toString();
  return `mailto:${filled.to || ""}${q ? "?" + q : ""}`;
}

// ---- Views ----------------------------------------------------------------
let templates = [];
let editingId = null;   // template being edited (null = new)
let usingId = null;     // template being used

function show(id) {
  for (const v of ["listView", "editView", "useView"]) $(v).classList.toggle("hidden", v !== id);
}

async function refresh() {
  templates = await loadTemplates();
  const list = $("tplList");
  list.innerHTML = "";
  $("empty").classList.toggle("hidden", templates.length > 0);
  for (const t of templates) {
    const li = document.createElement("li");
    const left = document.createElement("div");
    left.innerHTML = `<span class="nm"></span><span class="sub"></span>`;
    left.querySelector(".nm").textContent = t.name || "(unnamed)";
    left.querySelector(".sub").textContent = t.subject || "—";
    li.appendChild(left);
    li.addEventListener("click", () => openUse(t.id));
    list.appendChild(li);
  }
  show("listView");
}

// ---- Edit view --------------------------------------------------------------
function openEdit(id) {
  editingId = id || null;
  const t = id ? templates.find(x => x.id === id) : null;
  $("fName").value = t?.name || "";
  $("fTo").value = t?.to || "";
  $("fCc").value = t?.cc || "";
  $("fBcc").value = t?.bcc || "";
  $("fSubject").value = t?.subject || "";
  $("fBody").value = t?.body || "";
  show("editView");
}

$("newBtn").addEventListener("click", () => openEdit(null));
$("cancelEdit").addEventListener("click", refresh);
$("saveBtn").addEventListener("click", async () => {
  const data = {
    name: $("fName").value.trim(),
    to: $("fTo").value.trim(),
    cc: $("fCc").value.trim(),
    bcc: $("fBcc").value.trim(),
    subject: $("fSubject").value,
    body: $("fBody").value
  };
  if (!data.name) { alert("Give the template a name."); return; }
  if (editingId) {
    const i = templates.findIndex(x => x.id === editingId);
    if (i >= 0) templates[i] = { ...templates[i], ...data };
  } else {
    templates.push({ id: uid(), ...data });
  }
  await saveTemplates(templates);
  refresh();
});

// ---- Use view ---------------------------------------------------------------
function openUse(id) {
  usingId = id;
  const t = templates.find(x => x.id === id);
  if (!t) return refresh();
  $("useTitle").textContent = t.name || "(unnamed)";
  const fields = $("phFields");
  fields.innerHTML = "";
  const phs = findPlaceholders(t);
  if (phs.length === 0) {
    fields.innerHTML = `<p class="mut">No {{placeholders}} in this template — it opens as-is.</p>`;
  }
  for (const name of phs) {
    const row = document.createElement("div");
    row.className = "ph-row";
    const label = document.createElement("label");
    label.innerHTML = "";
    const code = document.createElement("code");
    code.textContent = `{{${name}}}`;
    label.appendChild(code);
    const inp = document.createElement("input");
    inp.className = "inp";
    inp.dataset.ph = name;
    inp.addEventListener("input", updatePreview);
    row.appendChild(label);
    row.appendChild(inp);
    fields.appendChild(row);
  }
  updatePreview();
  show("useView");
}

function currentValues() {
  const vals = {};
  for (const inp of document.querySelectorAll("#phFields input[data-ph]")) {
    vals[inp.dataset.ph] = inp.value;
  }
  return vals;
}

function updatePreview() {
  const t = templates.find(x => x.id === usingId);
  if (!t) return;
  const filled = fill(t, currentValues());
  $("preview").textContent =
    `To: ${filled.to || "—"}\n` +
    (filled.cc ? `Cc: ${filled.cc}\n` : "") +
    (filled.bcc ? `Bcc: ${filled.bcc}\n` : "") +
    `Subject: ${filled.subject || "—"}\n\n${filled.body || "—"}`;
}

$("openBtn").addEventListener("click", async () => {
  const t = templates.find(x => x.id === usingId);
  if (!t) return;
  const url = buildMailto(fill(t, currentValues()));
  // mailto: URLs are handed to the OS mail client; nothing is sent by us.
  await chrome.tabs.create({ url });
  window.close();
});
$("backBtn").addEventListener("click", refresh);
$("editTpl").addEventListener("click", () => openEdit(usingId));
$("delTpl").addEventListener("click", async () => {
  if (!confirm("Delete this template?")) return;
  templates = templates.filter(x => x.id !== usingId);
  await saveTemplates(templates);
  refresh();
});

refresh();
