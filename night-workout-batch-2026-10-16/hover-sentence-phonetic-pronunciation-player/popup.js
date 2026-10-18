// popup.js — arms click-to-pronounce mode on the active tab and pushes
// voice/rate preferences to the injected content script.

const els = {
  voice: document.getElementById("voice"),
  rate: document.getElementById("rate"),
  rateVal: document.getElementById("rateVal"),
  arm: document.getElementById("arm"),
  clear: document.getElementById("clear"),
  status: document.getElementById("status"),
};

const synth = window.speechSynthesis;
let voices = [];

function setStatus(t) { els.status.textContent = t; }

function loadVoices() {
  voices = synth.getVoices();
  els.voice.innerHTML = "";
  if (!voices.length) {
    const o = document.createElement("option");
    o.textContent = "No voices available";
    els.voice.appendChild(o);
    return;
  }
  voices.forEach((v, i) => {
    const o = document.createElement("option");
    o.value = v.voiceURI;
    o.textContent = `${v.name} — ${v.lang}${v.localService ? " (local)" : ""}`;
    els.voice.appendChild(o);
  });
  const en = voices.findIndex(v => /^en/i.test(v.lang));
  if (en >= 0) els.voice.value = voices[en].voiceURI;
}
if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;
loadVoices();

chrome.storage.local.get({ rate: 1, voiceURI: "" }, (p) => {
  els.rate.value = p.rate; els.rateVal.textContent = Number(p.rate).toFixed(1) + "×";
  if (p.voiceURI && voices.some(v => v.voiceURI === p.voiceURI)) els.voice.value = p.voiceURI;
});
function savePrefs() {
  chrome.storage.local.set({ rate: els.rate.value, voiceURI: els.voice.value });
  pushPrefs();
}
els.rate.addEventListener("input", () => { els.rateVal.textContent = Number(els.rate.value).toFixed(1) + "×"; savePrefs(); });
els.voice.addEventListener("change", savePrefs);

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/.test(tab.url)) { setStatus("Open a regular web page first."); return null; }
  return tab.id;
}

async function pushPrefs() {
  const tabId = await activeTabId();
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "pronounce-set",
      prefs: { rate: Number(els.rate.value), pitch: 1, voiceURI: els.voice.value },
    });
  } catch { /* content script not armed yet — fine */ }
}

els.arm.addEventListener("click", async () => {
  const tabId = await activeTabId();
  if (!tabId) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await pushPrefs();
    els.clear.disabled = false;
    setStatus("Armed — hover sentences on the page, click to hear them. Esc clears.");
  } catch (e) {
    setStatus("Could not arm on this page.");
  }
});

els.clear.addEventListener("click", async () => {
  const tabId = await activeTabId();
  if (!tabId) return;
  try { await chrome.tabs.sendMessage(tabId, { type: "pronounce-clear" }); } catch { /* already cleared */ }
  els.clear.disabled = true;
  setStatus("Cleared.");
});
