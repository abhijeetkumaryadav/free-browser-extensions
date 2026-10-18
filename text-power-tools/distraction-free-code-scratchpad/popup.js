// ScratchCode popup — opens the full-page scratchpad, shows stats, creates new pads.
const STORAGE_KEY = "codescratch.pads";

const openBtn = document.getElementById("openPad");
const newBtn = document.getElementById("newPad");
const padCountEl = document.getElementById("padCount");
const lastEditedEl = document.getElementById("lastEdited");

openBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("pad.html") });
  window.close();
});

newBtn.addEventListener("click", async () => {
  const { [STORAGE_KEY]: pads = [] } = await chrome.storage.local.get(STORAGE_KEY);
  pads.unshift({
    id: "pad-" + Date.now().toString(36),
    name: "Untitled " + (pads.length + 1),
    lang: "javascript",
    code: "",
    updatedAt: Date.now(),
  });
  await chrome.storage.local.set({ [STORAGE_KEY]: pads });
  chrome.tabs.create({ url: chrome.runtime.getURL("pad.html") });
  window.close();
});

async function refreshStats() {
  const { [STORAGE_KEY]: pads = [] } = await chrome.storage.local.get(STORAGE_KEY);
  padCountEl.textContent = String(pads.length);
  if (pads.length) {
    const latest = Math.max(...pads.map((p) => p.updatedAt || 0));
    lastEditedEl.textContent = new Date(latest).toLocaleString();
  } else {
    lastEditedEl.textContent = "No pads yet";
  }
}

refreshStats();
