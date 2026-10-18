/* popup.js — builds Markdown and plain-text signatures from user fields. Local only. */
const $ = (id) => document.getElementById(id);
const FIELDS = ["fName","fRole","fCompany","fPhone","fEmail","fSite","fSocials","fDivider"];
const statusEl = $("status");
let mode = "md"; // "md" | "txt"

/** Read current field values. */
function readFields(){
  const v = {};
  for (const id of FIELDS){
    const el = $(id);
    v[id] = el.type === "checkbox" ? el.checked : el.value.trim();
  }
  return v;
}

/** Parse "Label, URL" lines into [{label, url}]. */
function parseSocials(raw){
  const out = [];
  for (const line of raw.split("\n")){
    const t = line.trim();
    if (!t) continue;
    const comma = t.indexOf(",");
    if (comma > 0){
      out.push({ label: t.slice(0, comma).trim(), url: t.slice(comma + 1).trim() });
    } else {
      out.push({ label: t, url: "" });
    }
  }
  return out;
}

/** Build the Markdown signature. */
function buildMarkdown(f){
  const lines = [];
  if (f.fDivider) lines.push("--");
  if (f.fName) lines.push(`**${f.fName}**`);
  const roleLine = [f.fRole, f.fCompany].filter(Boolean).join(" · ");
  if (roleLine) lines.push(roleLine);
  const contacts = [];
  if (f.fPhone) contacts.push(`📞 ${f.fPhone}`);
  if (f.fEmail) contacts.push(`[${f.fEmail}](mailto:${f.fEmail})`);
  if (f.fSite) contacts.push(`[${f.fSite}](${f.fSite})`);
  if (contacts.length) lines.push(contacts.join(" · "));
  for (const s of parseSocials(f.fSocials)){
    lines.push(s.url ? `[${s.label}](${s.url})` : s.label);
  }
  return lines.join("\n");
}

/** Build the plain-text signature. */
function buildPlain(f){
  const lines = [];
  if (f.fDivider) lines.push("--");
  if (f.fName) lines.push(f.fName);
  const roleLine = [f.fRole, f.fCompany].filter(Boolean).join(" | ");
  if (roleLine) lines.push(roleLine);
  if (f.fPhone) lines.push(`Phone: ${f.fPhone}`);
  if (f.fEmail) lines.push(`Email: ${f.fEmail}`);
  if (f.fSite) lines.push(`Web: ${f.fSite}`);
  for (const s of parseSocials(f.fSocials)){
    lines.push(s.url ? `${s.label}: ${s.url}` : s.label);
  }
  return lines.join("\n");
}

/** Re-render the preview and autosave the draft. */
function refresh(){
  const f = readFields();
  const out = mode === "md" ? buildMarkdown(f) : buildPlain(f);
  $("previewOut").textContent = out || "(fill in fields to preview)";
  chrome.storage.local.set({ sigDraft: f });
}

/** Switch preview tab. */
function setMode(m){
  mode = m;
  $("tabMd").classList.toggle("active", m === "md");
  $("tabTxt").classList.toggle("active", m === "txt");
  refresh();
}

$("tabMd").addEventListener("click", () => setMode("md"));
$("tabTxt").addEventListener("click", () => setMode("txt"));

$("copyBtn").addEventListener("click", async () => {
  const text = $("previewOut").textContent;
  if (!text || text.startsWith("(fill")){ statusEl.textContent = "Nothing to copy yet."; return; }
  try {
    await navigator.clipboard.writeText(text);
    statusEl.textContent = `Copied ${mode === "md" ? "Markdown" : "plain-text"} signature.`;
  } catch (_e) {
    // Fallback: select the text so the user can copy manually.
    const range = document.createRange();
    range.selectNodeContents($("previewOut"));
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
    statusEl.textContent = "Text selected — press Ctrl/Cmd+C to copy.";
  }
});

$("resetBtn").addEventListener("click", () => {
  for (const id of FIELDS){
    const el = $(id);
    if (el.type === "checkbox") el.checked = true; else el.value = "";
  }
  chrome.storage.local.remove("sigDraft");
  refresh();
  statusEl.textContent = "Reset to a blank signature.";
});

// Autosave + live preview on every change.
for (const id of FIELDS){
  const el = $(id);
  el.addEventListener("input", refresh);
  el.addEventListener("change", refresh);
}

// Restore saved draft.
chrome.storage.local.get("sigDraft", (res) => {
  const f = res.sigDraft;
  if (f){
    for (const id of FIELDS){
      if (!(id in f)) continue;
      const el = $(id);
      if (el.type === "checkbox") el.checked = !!f[id]; else el.value = f[id] || "";
    }
  }
  refresh();
});
