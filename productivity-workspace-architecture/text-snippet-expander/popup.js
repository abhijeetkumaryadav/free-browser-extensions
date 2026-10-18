// Text Snippet Expander — popup UI.
// Manages the trigger → snippet library: add, edit, delete,
// enable toggle, expand-on setting, and JSON import/export.
// Storage shape: { snippets: {trigger: snippet}, enabled, expandOn }

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const enabledEl = $("enabled");
const trigInput = $("trigInput"), snipInput = $("snipInput"), addError = $("addError");
const snipList = $("snipList"), snipCount = $("snipCount");

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------------------------------------------------------------------------
// Library rendering
// ---------------------------------------------------------------------------
async function loadLibrary() {
  const { snippets = {} } = await chrome.storage.local.get("snippets");
  const keys = Object.keys(snippets).sort();
  snipCount.textContent = keys.length;
  snipList.innerHTML = "";

  if (!keys.length) {
    snipList.innerHTML = `<div class="empty">No snippets yet — add your first above, e.g. <b>;sig</b>.</div>`;
    return;
  }

  for (const trig of keys) {
    const row = document.createElement("div");
    row.className = "snip";
    row.innerHTML = `
      <div class="head">
        <span class="trig">${escapeHtml(trig)}</span>
        <span class="sp"></span>
        <button data-act="edit" title="Edit snippet">✎</button>
        <button data-act="del" class="del" title="Delete">×</button>
      </div>
      <p class="body">${escapeHtml(snippets[trig])}</p>
      <div class="edit-area">
        <textarea rows="3" maxlength="2000">${escapeHtml(snippets[trig])}</textarea>
        <div class="edit-row">
          <button class="ghost" data-act="save">Save</button>
          <button class="ghost" data-act="cancel">Cancel</button>
        </div>
      </div>`;

    row.querySelector('[data-act="edit"]').addEventListener("click", () => {
      row.classList.add("editing");
    });
    row.querySelector('[data-act="cancel"]').addEventListener("click", () => {
      row.classList.remove("editing");
    });
    row.querySelector('[data-act="save"]').addEventListener("click", async () => {
      const val = row.querySelector(".edit-area textarea").value;
      if (!val.trim()) { alert("Snippet text can't be empty."); return; }
      const cur = (await chrome.storage.local.get("snippets")).snippets || {};
      cur[trig] = val;
      await chrome.storage.local.set({ snippets: cur });
      await loadLibrary();
    });
    row.querySelector('[data-act="del"]').addEventListener("click", async () => {
      if (!confirm(`Delete snippet "${trig}"?`)) return;
      const cur = (await chrome.storage.local.get("snippets")).snippets || {};
      delete cur[trig];
      await chrome.storage.local.set({ snippets: cur });
      await loadLibrary();
    });

    snipList.appendChild(row);
  }
}

// ---------------------------------------------------------------------------
// Add
// ---------------------------------------------------------------------------
$("addBtn").addEventListener("click", async () => {
  const trig = trigInput.value.trim();
  const body = snipInput.value;
  addError.textContent = "";

  if (!trig) { addError.textContent = "Give the snippet a trigger first."; return; }
  if (/\s/.test(trig)) { addError.textContent = "Triggers can't contain spaces."; return; }
  if (!body.trim()) { addError.textContent = "Snippet text can't be empty."; return; }

  const cur = (await chrome.storage.local.get("snippets")).snippets || {};
  const existed = Object.prototype.hasOwnProperty.call(cur, trig);
  cur[trig] = body;
  await chrome.storage.local.set({ snippets: cur });
  trigInput.value = ""; snipInput.value = "";
  await loadLibrary();
  addError.textContent = existed ? `Updated existing trigger “${trig}”.` : "";
});

// ---------------------------------------------------------------------------
// Settings: enabled + expand-on
// ---------------------------------------------------------------------------
enabledEl.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: enabledEl.checked });
});

function paintSeg(value) {
  document.querySelectorAll("#expandOnSeg button").forEach((b) => {
    b.classList.toggle("on", b.dataset.v === value);
  });
}
document.querySelectorAll("#expandOnSeg button").forEach((b) => {
  b.addEventListener("click", async () => {
    await chrome.storage.local.set({ expandOn: b.dataset.v });
    paintSeg(b.dataset.v);
  });
});

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------
$("exportBtn").addEventListener("click", async () => {
  const s = await chrome.storage.local.get({ snippets: {}, expandOn: "tab" });
  if (!Object.keys(s.snippets).length) return;
  const blob = new Blob([JSON.stringify({
    app: "text-snippet-expander", version: 1,
    expandOn: s.expandOn, snippets: s.snippets,
  }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "snippets.json";
  a.click();                                   // user-initiated download of their own data
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

$("importBtn").addEventListener("click", () => $("importFile").click());

$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = data.snippets;
    if (!incoming || typeof incoming !== "object") throw new Error("bad format");

    // Keep only string→string pairs, cap trigger/body lengths.
    const clean = {};
    for (const [k, v] of Object.entries(incoming)) {
      if (typeof k === "string" && typeof v === "string" && k && !/\s/.test(k)) {
        clean[k.slice(0, 60)] = v.slice(0, 2000);
      }
    }
    const s = await chrome.storage.local.get({ snippets: {}, expandOn: "tab" });
    const merged = { ...s.snippets, ...clean };
    const patch = { snippets: merged };
    if (["tab", "space", "both"].includes(data.expandOn)) patch.expandOn = data.expandOn;
    await chrome.storage.local.set(patch);
    paintSeg(patch.expandOn || s.expandOn);
    await loadLibrary();
  } catch {
    alert("Could not import — the file is not a valid snippet export.");
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
(async () => {
  const s = await chrome.storage.local.get({ enabled: true, expandOn: "tab" });
  enabledEl.checked = s.enabled !== false;
  paintSeg(s.expandOn || "tab");
  await loadLibrary();
})();
