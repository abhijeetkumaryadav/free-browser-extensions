// popup.js — Read Aloud: drives speechSynthesis inside the popup page itself.
// TTS must run in a page context; the popup owns playback. Content script only
// supplies the text to read (page main text or the current selection).

const els = {
  voice: document.getElementById("voice"),
  rate: document.getElementById("rate"),
  rateVal: document.getElementById("rateVal"),
  pitch: document.getElementById("pitch"),
  pitchVal: document.getElementById("pitchVal"),
  source: document.getElementById("source"),
  speak: document.getElementById("speak"),
  pause: document.getElementById("pause"),
  stop: document.getElementById("stop"),
  status: document.getElementById("status"),
  statusText: document.getElementById("statusText"),
};

const synth = window.speechSynthesis;
let voices = [];
let paused = false;

function setStatus(mode, text) {
  els.status.className = "status" + (mode ? " " + mode : "");
  els.statusText.textContent = text;
}

function loadVoices() {
  voices = synth.getVoices().filter(v => v.localService || true);
  els.voice.innerHTML = "";
  if (!voices.length) {
    const o = document.createElement("option");
    o.textContent = "No voices available";
    els.voice.appendChild(o);
    return;
  }
  voices.forEach((v, i) => {
    const o = document.createElement("option");
    o.value = i;
    o.textContent = `${v.name} — ${v.lang}${v.localService ? " (local)" : ""}`;
    els.voice.appendChild(o);
  });
  // Prefer an English voice when present.
  const en = voices.findIndex(v => /^en/i.test(v.lang));
  if (en >= 0) els.voice.value = en;
}
if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;
loadVoices();

// ---- persisted preferences ----
chrome.storage.local.get({ rate: 1, pitch: 1, source: "page", voiceIdx: 0 }, (p) => {
  els.rate.value = p.rate; els.rateVal.textContent = Number(p.rate).toFixed(1) + "×";
  els.pitch.value = p.pitch; els.pitchVal.textContent = Number(p.pitch).toFixed(1);
  els.source.value = p.source;
  if (voices[p.voiceIdx]) els.voice.value = p.voiceIdx;
});
function savePrefs() {
  chrome.storage.local.set({
    rate: els.rate.value, pitch: els.pitch.value,
    source: els.source.value, voiceIdx: els.voice.value,
  });
}

els.rate.addEventListener("input", () => { els.rateVal.textContent = Number(els.rate.value).toFixed(1) + "×"; savePrefs(); });
els.pitch.addEventListener("input", () => { els.pitchVal.textContent = Number(els.pitch.value).toFixed(1); savePrefs(); });
els.voice.addEventListener("change", savePrefs);
els.source.addEventListener("change", savePrefs);

// ---- text extraction (runs in the tab) ----
async function getTextFromTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/.test(tab.url)) {
    setStatus("", "Open a regular web page first.");
    return null;
  }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (mode) => {
        if (mode === "selection") {
          const s = window.getSelection().toString().trim();
          return s || null;
        }
        // Prefer article-ish containers; fall back to body.
        const pick = document.querySelector("article, main, [role=main]") || document.body;
        const clone = pick.cloneNode(true);
        clone.querySelectorAll("script,style,nav,header,footer,aside,form,noscript").forEach(n => n.remove());
        const text = (clone.innerText || "").replace(/\s+/g, " ").trim();
        return text || null;
      },
      args: [els.source.value],
    });
    return result;
  } catch (e) {
    setStatus("", "Could not read this page.");
    return null;
  }
}

function updateButtons() {
  const speaking = synth.speaking;
  els.speak.disabled = speaking && !paused;
  els.pause.disabled = !speaking;
  els.stop.disabled = !speaking;
  els.pause.querySelector("span").textContent = paused ? "Resume" : "Pause";
}

els.speak.addEventListener("click", async () => {
  synth.cancel();
  const text = await getTextFromTab();
  if (!text) { setStatus("", "No text found to read."); return; }
  const u = new SpeechSynthesisUtterance(text.slice(0, 20000)); // sanity cap
  const v = voices[Number(els.voice.value)];
  if (v) u.voice = v;
  u.rate = Number(els.rate.value);
  u.pitch = Number(els.pitch.value);
  u.onstart = () => { paused = false; setStatus("speaking", "Reading…"); updateButtons(); };
  u.onend = () => { paused = false; setStatus("", "Idle"); updateButtons(); };
  u.onerror = () => { paused = false; setStatus("", "Speech failed."); updateButtons(); };
  synth.speak(u);
  updateButtons();
});

els.pause.addEventListener("click", () => {
  if (paused) { synth.resume(); paused = false; setStatus("speaking", "Reading…"); }
  else { synth.pause(); paused = true; setStatus("paused", "Paused"); }
  updateButtons();
});

els.stop.addEventListener("click", () => {
  synth.cancel(); paused = false; setStatus("", "Idle"); updateButtons();
});

updateButtons();
