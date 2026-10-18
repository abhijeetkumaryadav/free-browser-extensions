// MarkPad popup — opens the full-page editor, shows draft stats, starts a new doc.
const STORAGE_KEY = "mwypad.doc";

const openBtn = document.getElementById("openEditor");
const newBtn = document.getElementById("newDoc");
const wordCountEl = document.getElementById("wordCount");
const lastSavedEl = document.getElementById("lastSaved");

openBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
  window.close();
});

newBtn.addEventListener("click", async () => {
  if (!confirm("Start a new document? Your current draft will be discarded.")) return;
  await chrome.storage.local.remove(STORAGE_KEY);
  await refreshStats();
});

function countWords(text) {
  const t = (text || "").trim();
  return t ? t.split(/\s+/).length : 0;
}

async function refreshStats() {
  const { [STORAGE_KEY]: doc } = await chrome.storage.local.get(STORAGE_KEY);
  if (doc && doc.html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = doc.html;
    wordCountEl.textContent = countWords(tmp.textContent).toLocaleString();
    lastSavedEl.textContent = doc.updatedAt
      ? new Date(doc.updatedAt).toLocaleString()
      : "–";
  } else {
    wordCountEl.textContent = "0";
    lastSavedEl.textContent = "No draft yet";
  }
}

refreshStats();
