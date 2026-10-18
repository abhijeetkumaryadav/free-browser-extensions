// Query Parameter Builder — popup logic. Everything stays on-device;
// the only permission is `storage`, used to remember your last draft.

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const saved = await chrome.storage.local.get({
    base: "",
    rows: [{ key: "q", value: "", include: true }],
  });
  $("base").value = saved.base || "";
  renderRows(Array.isArray(saved.rows) && saved.rows.length ? saved.rows : [{ key: "", value: "", include: true }]);

  $("base").addEventListener("input", onChange);
  $("add").addEventListener("click", () => {
    const rows = readRows();
    rows.push({ key: "", value: "", include: true });
    renderRows(rows);
    const keys = document.querySelectorAll("#rows .prow .key");
    keys[keys.length - 1].focus();
  });
  $("copy").addEventListener("click", copyUrl);
  $("openUrl").addEventListener("click", openUrl);
  $("parse").addEventListener("click", parseUrl);
  $("parseInput").addEventListener("keydown", (e) => { if (e.key === "Enter") parseUrl(); });
}

/* ---------- rows ---------- */

function rowEl(row) {
  const div = document.createElement("div");
  div.className = "prow" + (row.include === false ? " off" : "");
  const tgl = document.createElement("label");
  tgl.className = "tgl";
  tgl.title = "Include in URL";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = row.include !== false;
  const sw = document.createElement("span");
  tgl.append(cb, sw);
  const key = document.createElement("input");
  key.type = "text"; key.className = "key"; key.placeholder = "key"; key.maxLength = 200;
  key.value = row.key || "";
  const eq = document.createElement("span");
  eq.className = "eq"; eq.textContent = "=";
  const val = document.createElement("input");
  val.type = "text"; val.className = "val"; val.placeholder = "value"; val.maxLength = 1000;
  val.value = row.value || "";
  const del = document.createElement("button");
  del.className = "del"; del.textContent = "×"; del.title = "Remove";
  del.addEventListener("click", () => {
    const rows = readRows();
    const i = [...document.querySelectorAll("#rows .prow")].indexOf(div);
    if (i > -1) rows.splice(i, 1);
    renderRows(rows.length ? rows : [{ key: "", value: "", include: true }]);
  });
  const sync = () => {
    div.classList.toggle("off", !cb.checked);
    key.disabled = val.disabled = !cb.checked;
    onChange();
  };
  cb.addEventListener("change", sync);
  key.addEventListener("input", onChange);
  val.addEventListener("input", onChange);
  div.append(tgl, key, eq, val, del);
  key.disabled = val.disabled = !cb.checked;
  return div;
}

function renderRows(rows) {
  const box = $("rows");
  box.innerHTML = "";
  for (const r of rows.slice(0, 50)) box.appendChild(rowEl(r));
  updatePreview();
  persistSoon();
}

function readRows() {
  return [...document.querySelectorAll("#rows .prow")].map((d) => ({
    key: d.querySelector(".key").value,
    value: d.querySelector(".val").value,
    include: d.querySelector('input[type="checkbox"]').checked,
  }));
}

/* ---------- url building ---------- */

function currentUrl() {
  const rawBase = $("base").value.trim() || "https://example.com";
  const clean = rawBase.split("?")[0].split("#")[0].replace(/\/$/, "");
  const parts = [];
  for (const r of readRows()) {
    if (r.include && r.key.trim()) {
      parts.push(encodeURIComponent(r.key.trim()) + "=" + encodeURIComponent(r.value));
    }
  }
  return parts.length ? clean + "?" + parts.join("&") : clean;
}

function updatePreview() {
  const url = currentUrl();
  const box = $("preview");
  box.innerHTML = "";
  const q = url.indexOf("?");
  if (q === -1) {
    box.textContent = url;
    return;
  }
  const baseSpan = document.createElement("span");
  baseSpan.className = "dim";
  baseSpan.textContent = url.slice(0, q + 1);
  box.append(baseSpan, document.createTextNode(url.slice(q + 1)));
}

/* ---------- actions ---------- */

async function copyUrl() {
  const url = currentUrl();
  const btn = $("copy");
  try {
    await navigator.clipboard.writeText(url);
  } catch (e) {
    // fallback for older contexts
    const ta = document.createElement("textarea");
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const old = btn.textContent;
  btn.textContent = "Copied ✓";
  setTimeout(() => { btn.textContent = old; }, 1500);
}

function openUrl() {
  const url = currentUrl();
  try {
    new URL(url); // validate before opening
    chrome.tabs.create({ url });
  } catch (e) {
    const note = $("parseNote");
    note.textContent = "Enter a valid base URL (e.g. https://example.com) to open it.";
    note.className = "note err";
  }
}

function parseUrl() {
  const raw = $("parseInput").value.trim();
  const note = $("parseNote");
  note.className = "note";
  try {
    const u = new URL(raw);
    $("base").value = u.origin + u.pathname;
    const rows = [...u.searchParams.entries()].map(([k, v]) => ({ key: k, value: v, include: true }));
    renderRows(rows.length ? rows : [{ key: "", value: "", include: true }]);
    note.textContent = rows.length
      ? `Loaded ${rows.length} parameter${rows.length > 1 ? "s" : ""} — edit away.`
      : "No query params found — base URL loaded.";
    note.className = "note ok";
  } catch (e) {
    note.textContent = "That doesn't look like a valid URL.";
    note.className = "note err";
  }
  onChange();
}

/* ---------- persistence ---------- */

let saveTimer = null;
function onChange() {
  updatePreview();
  persistSoon();
}
function persistSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({ base: $("base").value, rows: readRows().slice(0, 50) });
  }, 400);
}
