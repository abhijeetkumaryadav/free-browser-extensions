// Dictation Pad popup logic.
// Uses the browser's built-in Web Speech API (window.SpeechRecognition /
// webkitSpeechRecognition). No API keys, no remote code — but the browser
// itself sends audio to its own speech service, which is disclosed in the UI.

const DRAFT_KEY = "dict_draft_v1";
const PREFS_KEY = "dict_prefs_v1";

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const recState = document.getElementById("recState");
const buffer = document.getElementById("buffer");
const interimEl = document.getElementById("interim");
const statusEl = document.getElementById("status");
const punctChk = document.getElementById("punctCmds");
const interimChk = document.getElementById("interimChk");
const langSel = document.getElementById("langSel");

let recognition = null;
let listening = false;
let baseText = ""; // finalized text before the current recognition session

function setStatus(msg, kind = "") {
  statusEl.textContent = msg;
  statusEl.className = "status " + kind;
}

function setRecState(on) {
  recState.textContent = on ? "● Recording" : "● Idle";
  recState.className = on ? "rec-on" : "rec-off";
  startBtn.disabled = on;
  stopBtn.disabled = !on;
}

/** Spoken punctuation commands, applied to final transcripts. */
function applyPunctuationCommands(text) {
  const map = [
    [/^period$/i, "."], [/^comma$/i, ","], [/^question mark$/i, "?"],
    [/^exclamation point$/i, "!"], [/^exclamation mark$/i, "!"],
    [/^colon$/i, ":"], [/^semicolon$/i, ";"],
    [/^new paragraph$/i, "\n\n"], [/^new line$/i, "\n"],
    [/^open quote$/i, "\u201C"], [/^close quote$/i, "\u201D"],
  ];
  const trimmed = text.trim();
  for (const [re, out] of map) {
    if (re.test(trimmed)) return out;
  }
  // Inline replacements for commands embedded in longer sentences.
  return text
    .replace(/\bperiod\b/gi, ".")
    .replace(/\bcomma\b/gi, ",")
    .replace(/\bquestion mark\b/gi, "?")
    .replace(/\bnew paragraph\b/gi, "\n\n")
    .replace(/\bnew line\b/gi, "\n");
}

function getRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function startDictation() {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    setStatus("Speech recognition isn't available in this browser. Try Chrome.", "err");
    return;
  }
  baseText = buffer.value;
  recognition = new Ctor();
  recognition.lang = langSel.value;
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let interim = "";
    let finals = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finals += punctChk.checked ? applyPunctuationCommands(transcript) : transcript;
      } else {
        interim += transcript;
      }
    }
    if (finals) {
      const sep = buffer.value && !buffer.value.endsWith(" ") && !buffer.value.endsWith("\n") ? " " : "";
      buffer.value = buffer.value + sep + finals;
      interimEl.textContent = "";
    } else if (interimChk.checked) {
      interimEl.textContent = "…" + interim;
    }
    autoSaveDraft();
  };

  recognition.onerror = (event) => {
    const why = event.error || "unknown error";
    if (why === "not-allowed" || why === "service-not-allowed") {
      setStatus("Microphone blocked — allow mic access for this extension.", "err");
    } else if (why === "network") {
      setStatus("Speech service unreachable (Chrome's recognizer needs internet).", "err");
    } else if (why !== "aborted") {
      setStatus("Recognition error: " + why, "err");
    }
    stopDictation();
  };

  recognition.onend = () => {
    // Chrome may auto-stop after silence; keep session alive if user didn't stop.
    if (listening) {
      try { recognition.start(); } catch (e) { stopDictation(); }
    }
  };

  try {
    recognition.start();
    listening = true;
    setRecState(true);
    setStatus("Listening… speak now.");
  } catch (e) {
    setStatus("Could not start: " + e.message, "err");
    listening = false;
    setRecState(false);
  }
}

function stopDictation() {
  listening = false;
  if (recognition) {
    try { recognition.stop(); } catch (e) {}
    recognition = null;
  }
  interimEl.textContent = "";
  setRecState(false);
  autoSaveDraft();
  setStatus("Stopped.");
}

let draftTimer = null;
function autoSaveDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    chrome.storage.local.set({ [DRAFT_KEY]: buffer.value }).catch(() => {});
  }, 500);
}

async function savePrefs() {
  await chrome.storage.local.set({
    [PREFS_KEY]: { punct: punctChk.checked, interim: interimChk.checked, lang: langSel.value }
  });
}

async function loadPrefs() {
  const { [PREFS_KEY]: prefs } = await chrome.storage.local.get(PREFS_KEY);
  if (prefs) {
    if (typeof prefs.punct === "boolean") punctChk.checked = prefs.punct;
    if (typeof prefs.interim === "boolean") interimChk.checked = prefs.interim;
    if (prefs.lang) langSel.value = prefs.lang;
  }
  const { [DRAFT_KEY]: draft } = await chrome.storage.local.get(DRAFT_KEY);
  if (typeof draft === "string" && draft) buffer.value = draft;
}

startBtn.addEventListener("click", startDictation);
stopBtn.addEventListener("click", stopDictation);
buffer.addEventListener("input", autoSaveDraft);
[punctChk, interimChk, langSel].forEach(el =>
  el.addEventListener("change", savePrefs)
);

document.getElementById("clearBuf").addEventListener("click", async () => {
  buffer.value = "";
  await chrome.storage.local.remove(DRAFT_KEY);
  setStatus("Buffer cleared.");
});

document.getElementById("copyBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(buffer.value);
    setStatus("Copied to clipboard.", "ok");
  } catch (e) {
    setStatus("Copy failed: " + e.message, "err");
  }
});

document.getElementById("dlBtn").addEventListener("click", () => {
  const blob = new Blob([buffer.value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dictation.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  setStatus("Exported as dictation.txt.", "ok");
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  await chrome.storage.local.set({ [DRAFT_KEY]: buffer.value });
  await savePrefs();
  setStatus("Draft saved locally.", "ok");
});

// Stop recognition if the popup closes.
window.addEventListener("unload", () => {
  listening = false;
  if (recognition) { try { recognition.stop(); } catch (e) {} }
});

loadPrefs();
