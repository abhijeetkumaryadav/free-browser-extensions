// Macro Recorder — popup logic. Coordinates recording sessions with the
// content script and stores named macros locally.

const STORAGE_KEY = "macroRecorder.macros.v1";

const $ = id => document.getElementById(id);
const els = { toggle: $("toggleRec"), recLabel: $("recLabel"), recCount: $("recCount"),
  name: $("macroName"), save: $("saveMacro"), list: $("macros"), status: $("status") };

let recording = false;
let liveSteps = [];

function setStatus(m) { els.status.textContent = m; }

async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

async function sendToTab(kind, payload = {}) {
  const tab = await activeTab();
  if (!tab || !tab.id || /^chrome:|^edge:|^about:/.test(tab.url || "")) {
    throw new Error("Recording only works on regular web pages.");
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  return chrome.tabs.sendMessage(tab.id, { kind, ...payload });
}

async function getMacros() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}
async function setMacros(list) {
  await chrome.storage.local.set({ [STORAGE_KEY]: list });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

async function render() {
  const macros = await getMacros();
  els.list.innerHTML = "";
  if (macros.length === 0) {
    els.list.innerHTML = '<p class="empty">No macros yet — record your first one above.</p>';
    return;
  }
  for (const m of macros) {
    const div = document.createElement("div");
    div.className = "macro";
    div.innerHTML =
      `<div class="head"><span class="name">${escapeHtml(m.name)}</span>` +
      `<span class="meta">${m.steps.length} step${m.steps.length === 1 ? "" : "s"}</span></div>` +
      `<div class="actions">
         <button class="icon play">Replay</button>
         <button class="icon danger del">Delete</button>
       </div>`;
    div.querySelector(".play").addEventListener("click", async () => {
      try {
        const res = await sendToTab("MACRO_PLAY", { steps: m.steps });
        setStatus(`Replayed ${res.done}/${m.steps.length} steps of “${m.name}”.`);
      } catch (e) { setStatus(e.message); }
    });
    div.querySelector(".del").addEventListener("click", async () => {
      await setMacros((await getMacros()).filter(x => x.id !== m.id));
      setStatus(`Deleted “${m.name}”.`);
      render();
    });
    els.list.appendChild(div);
  }
}

els.toggle.addEventListener("click", async () => {
  try {
    if (!recording) {
      await sendToTab("MACRO_START_RECORD");
      recording = true; liveSteps = [];
      els.toggle.classList.add("live");
      els.recLabel.textContent = "Stop recording";
      els.recCount.textContent = "0 steps";
      setStatus("Recording… click and type in the page, then stop.");
    } else {
      const res = await sendToTab("MACRO_STOP_RECORD");
      recording = false;
      liveSteps = res.steps || [];
      els.toggle.classList.remove("live");
      els.recLabel.textContent = "Start recording";
      els.recCount.textContent = `${liveSteps.length} step${liveSteps.length === 1 ? "" : "s"} captured`;
      els.save.disabled = liveSteps.length === 0;
      setStatus(liveSteps.length ? "Name it and save, or record again." : "No steps captured.");
    }
  } catch (e) { setStatus(e.message); }
});

chrome.runtime.onMessage.addListener(msg => {
  if (msg.kind === "MACRO_STEP" && recording) {
    els.recCount.textContent = `${msg.count} step${msg.count === 1 ? "" : "s"}`;
  }
});

els.save.addEventListener("click", async () => {
  const name = els.name.value.trim() || `Macro ${new Date().toLocaleString()}`;
  const macros = await getMacros();
  macros.unshift({ id: "m" + Date.now(), name, steps: liveSteps, created: Date.now() });
  await setMacros(macros);
  els.name.value = ""; liveSteps = []; els.save.disabled = true;
  els.recCount.textContent = "";
  setStatus(`Saved “${name}”.`);
  render();
});

render();
