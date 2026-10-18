/* Webhook Payload Sniffer — workbench logic.
 * Pasted payloads only: nothing is intercepted and nothing is sent
 * automatically. History stays in on-device storage. */

"use strict";

const $ = (id) => document.getElementById(id);
const HISTORY_KEY = "payloadHistory";
const MAX_HISTORY = 25;

/* ---------- JSON helpers ---------- */

/** Parse the textarea; returns {ok, data} or {ok:false, error}. */
function parsePayload() {
  const raw = $("payload").value.trim();
  if (!raw) return { ok: false, error: "Paste a JSON payload first." };
  try {
    return { ok: true, data: JSON.parse(raw), raw };
  } catch (e) {
    return { ok: false, error: "Invalid JSON: " + e.message };
  }
}

function showValidation(ok, text) {
  const box = $("validation");
  box.hidden = false;
  box.className = "validation " + (ok ? "ok" : "bad");
  box.textContent = text;
}

/** Summarize a payload for history labels, e.g. `object · 4 keys · 212 B`. */
function summarize(data, raw) {
  const bytes = new Blob([raw]).size;
  if (Array.isArray(data)) return `array · ${data.length} items · ${bytes} B`;
  if (data && typeof data === "object") {
    const keys = Object.keys(data).length;
    const ev = typeof data.event === "string" ? ` · ${data.event}` : "";
    return `object · ${keys} keys${ev} · ${bytes} B`;
  }
  return `${typeof data} · ${bytes} B`;
}

/* ---------- actions ---------- */

function onValidate() {
  const r = parsePayload();
  if (r.ok) showValidation(true, "Valid JSON — " + summarize(r.data, r.raw));
  else showValidation(false, r.error);
}

function onPretty() {
  const r = parsePayload();
  if (!r.ok) { showValidation(false, r.error); return; }
  $("payload").value = JSON.stringify(r.data, null, 2);
  showValidation(true, "Pretty-printed — " + summarize(r.data, $("payload").value));
}

function onClear() {
  $("payload").value = "";
  $("validation").hidden = true;
  $("curlWrap").hidden = true;
}

/** Escape a JSON body for safe embedding inside single quotes in curl. */
function shellEscape(json) {
  return json.replace(/'/g, `'\\''`);
}

function onGenerateCurl() {
  const r = parsePayload();
  if (!r.ok) { showValidation(false, r.error); return; }
  const url = $("endpoint").value.trim();
  if (!/^https?:\/\//i.test(url)) {
    showValidation(false, "Enter a valid http(s) endpoint URL first.");
    $("endpoint").focus();
    return;
  }
  const method = $("method").value;
  const compact = JSON.stringify(r.data);
  const curl = `curl -X ${method} ${JSON.stringify(url)} \\\n` +
               `  -H "Content-Type: application/json" \\\n` +
               `  -d '${shellEscape(compact)}'`;
  $("curlOut").textContent = curl;
  $("curlWrap").hidden = false;
  showValidation(true, "curl ready — copy it into your terminal to fire the test.");
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = orig; }, 1200);
  } catch (e) {
    showValidation(false, "Clipboard blocked — select the text manually.");
  }
}

/* ---------- history ---------- */

async function getHistory() {
  const { [HISTORY_KEY]: h } = await chrome.storage.local.get(HISTORY_KEY);
  return Array.isArray(h) ? h : [];
}

async function onSave() {
  const r = parsePayload();
  if (!r.ok) { showValidation(false, r.error); return; }
  const history = await getHistory();
  history.unshift({
    id: "p" + Date.now(),
    label: summarize(r.data, r.raw),
    payload: JSON.stringify(r.data, null, 2),
    at: Date.now(),
  });
  await chrome.storage.local.set({ [HISTORY_KEY]: history.slice(0, MAX_HISTORY) });
  renderHistory();
  showValidation(true, "Saved to history.");
}

async function onLoad(id) {
  const history = await getHistory();
  const item = history.find((h) => h.id === id);
  if (!item) return;
  $("payload").value = item.payload;
  $("validation").hidden = true;
  $("curlWrap").hidden = true;
}

async function onDelete(id) {
  const history = (await getHistory()).filter((h) => h.id !== id);
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
  renderHistory();
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

async function renderHistory() {
  const history = await getHistory();
  const box = $("history");
  box.innerHTML = "";
  $("historyEmpty").style.display = history.length ? "none" : "";
  for (const item of history) {
    const row = document.createElement("div");
    row.className = "hist-item";

    const meta = document.createElement("div");
    meta.className = "meta";
    const b = document.createElement("b");
    b.textContent = item.label;
    const span = document.createElement("span");
    span.textContent = timeAgo(item.at);
    meta.append(b, span);

    const preview = document.createElement("div");
    preview.className = "preview";
    preview.textContent = item.payload.replace(/\s+/g, " ").slice(0, 60);

    const loadBtn = document.createElement("button");
    loadBtn.className = "icon-btn";
    loadBtn.title = "Load into editor";
    loadBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="12" x2="12" y2="15"/></svg>';
    loadBtn.addEventListener("click", () => onLoad(item.id));

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.title = "Delete";
    delBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    delBtn.addEventListener("click", () => onDelete(item.id));

    row.append(meta, preview, loadBtn, delBtn);
    box.appendChild(row);
  }
}

/* ---------- init ---------- */

document.addEventListener("DOMContentLoaded", () => {
  $("btnValidate").addEventListener("click", onValidate);
  $("btnPretty").addEventListener("click", onPretty);
  $("btnSave").addEventListener("click", onSave);
  $("btnClear").addEventListener("click", onClear);
  $("btnCurl").addEventListener("click", onGenerateCurl);
  $("btnCopyCurl").addEventListener("click", (e) => copyText($("curlOut").textContent, e.currentTarget));
  renderHistory();
});
