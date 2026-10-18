/* Snippet Injector — personal user-script host (honestly narrowed).
   Chrome MV3 cannot host arbitrary userscripts, so this stores YOUR OWN
   snippets locally and injects them into the active tab on explicit click
   via chrome.scripting.executeScript. Snippets run with page privileges:
   review code before injecting. All local, zero network. */

"use strict";

const $ = (id) => document.getElementById(id);
const nameInput = $("nameInput");
const codeInput = $("codeInput");
const saveBtn = $("saveBtn");
const injectBtn = $("injectBtn");
const msg = $("msg");
const snippetList = $("snippetList");
const emptyState = $("emptyState");
const editorTitle = $("editorTitle");

let snippets = [];   // [{id, name, code, updated}]
let editingId = null; // null = new snippet

// ---------- storage ----------
async function loadSnippets() {
  const { snippets: s = [] } = await chrome.storage.local.get(["snippets"]);
  snippets = Array.isArray(s) ? s : [];
}
async function saveSnippets() {
  await chrome.storage.local.set({ snippets });
}

// ---------- messaging ----------
function showMsg(text, kind) {
  msg.textContent = text;
  msg.className = "msg " + kind;
  clearTimeout(showMsg._t);
  showMsg._t = setTimeout(() => msg.classList.add("hidden"), 5000);
  msg.classList.remove("hidden");
}

// ---------- editor ----------
function resetEditor() {
  editingId = null;
  editorTitle.textContent = "New snippet";
  nameInput.value = "";
  codeInput.value = "";
}

function loadIntoEditor(id) {
  const s = snippets.find((x) => x.id === id);
  if (!s) return;
  editingId = id;
  editorTitle.textContent = "Editing: " + s.name;
  nameInput.value = s.name;
  codeInput.value = s.code;
  codeInput.focus();
  showMsg("Loaded into editor — review before injecting.", "warn");
}

// ---------- actions ----------
async function saveSnippet() {
  const name = nameInput.value.trim().slice(0, 60);
  const code = codeInput.value;
  if (!name) return showMsg("Give the snippet a name first.", "err");
  if (!code.trim()) return showMsg("The snippet is empty — nothing to save.", "err");

  if (editingId) {
    const s = snippets.find((x) => x.id === editingId);
    if (s) {
      s.name = name;
      s.code = code;
      s.updated = Date.now();
    }
  } else {
    snippets.unshift({
      id: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name,
      code,
      updated: Date.now(),
    });
  }
  await saveSnippets();
  render();
  resetEditor();
  showMsg("Snippet saved locally.", "ok");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function blockedUrl(url) {
  return !url || !/^(https?|file):/.test(url);
}

async function injectCode(code, label) {
  const tab = await getActiveTab();
  if (!tab || blockedUrl(tab.url)) {
    showMsg("Cannot inject here (internal pages are off-limits).", "err");
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: (src) => {
        // eslint-disable-next-line no-eval
        (0, eval)(src);
      },
      args: [code],
    });
    showMsg(`Injected "${label}" into this tab.`, "ok");
  } catch (e) {
    showMsg("Injection failed: " + (e && e.message ? e.message : e), "err");
  }
}

async function injectEditor() {
  const code = codeInput.value;
  if (!code.trim()) return showMsg("Nothing to inject — editor is empty.", "err");
  const label = nameInput.value.trim() || "unsaved snippet";
  await injectCode(code, label);
}

// ---------- list ----------
function render() {
  snippetList.innerHTML = "";
  emptyState.style.display = snippets.length ? "none" : "block";
  for (const s of snippets) {
    const li = document.createElement("li");

    const name = document.createElement("span");
    name.className = "snip-name";
    name.textContent = s.name;
    name.title = s.name;
    li.appendChild(name);

    const len = document.createElement("span");
    len.className = "snip-len";
    len.textContent = s.code.length + " chars";
    li.appendChild(len);

    const edit = document.createElement("button");
    edit.className = "icon-btn";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => loadIntoEditor(s.id));
    li.appendChild(edit);

    const run = document.createElement("button");
    run.className = "icon-btn";
    run.textContent = "Inject";
    run.title = "Inject this snippet into the active tab";
    run.addEventListener("click", () => injectCode(s.code, s.name));
    li.appendChild(run);

    const del = document.createElement("button");
    del.className = "icon-btn danger";
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      snippets = snippets.filter((x) => x.id !== s.id);
      if (editingId === s.id) resetEditor();
      await saveSnippets();
      render();
    });
    li.appendChild(del);

    snippetList.appendChild(li);
  }
}

// ---------- wiring ----------
saveBtn.addEventListener("click", saveSnippet);
injectBtn.addEventListener("click", injectEditor);

// ---------- init ----------
(async function init() {
  await loadSnippets();
  render();
})();
