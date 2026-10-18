// TabCast — records the visible tab as a WebM video via chrome.tabCapture
// + MediaRecorder. Strictly user-gesture-driven: Start and Stop are both
// explicit clicks. Honest scope: video only, NO GIF encoding.
// Keep the popup open while recording — closing it ends the stream.

"use strict";

const $ = (id) => document.getElementById(id);

let stream = null;       // MediaStream from chrome.tabCapture
let recorder = null;     // MediaRecorder
let chunks = [];         // recorded data
let timerId = null;      // elapsed-time interval
let stopAt = 0;          // auto-stop deadline
let startedAt = 0;
let lastBlobUrl = null;
let lastFileName = "tabcast.webm";

function fmt(sec) {
  sec = Math.floor(sec);
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const c of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

async function init() {
  const saved = await chrome.storage.local.get({ maxdur: 60, audio: true });
  $("maxdur").value = String(saved.maxdur);
  $("audio").checked = saved.audio !== false;
  $("maxdur").addEventListener("change", (e) =>
    chrome.storage.local.set({ maxdur: Number(e.target.value) })
  );
  $("audio").addEventListener("change", (e) =>
    chrome.storage.local.set({ audio: e.target.checked })
  );
  $("start").addEventListener("click", startRecording);
  $("stop").addEventListener("click", stopRecording);
  $("download").addEventListener("click", () => {
    if (lastBlobUrl) {
      const a = document.createElement("a");
      a.href = lastBlobUrl;
      a.download = lastFileName;
      a.click();
    }
  });
  // Safety net: stop the capture if the popup closes mid-recording.
  window.addEventListener("beforeunload", () => {
    try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch (e) { /* noop */ }
    if (stream) stream.getTracks().forEach((t) => t.stop());
  });
}

function startRecording() {
  $("start").classList.add("hidden");
  $("result").classList.add("hidden");
  lastBlobUrl = null;

  const withAudio = $("audio").checked;
  // chrome.tabCapture.capture must run in a user gesture — this click is it.
  chrome.tabCapture.capture({ audio: withAudio, video: true }, (captured) => {
    if (chrome.runtime.lastError || !captured) {
      const msg = chrome.runtime.lastError ? chrome.runtime.lastError.message : "Capture failed.";
      alert(`Could not start recording: ${msg}\n\nTab capture is not allowed on browser-restricted pages (chrome://, web store, etc.).`);
      resetUi();
      return;
    }
    stream = captured;
    const mimeType = pickMimeType();
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 5_000_000 } : undefined);
    } catch (e) {
      alert(`Recording not supported in this browser: ${e.message}`);
      stream.getTracks().forEach((t) => t.stop());
      resetUi();
      return;
    }
    chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = onRecorderStopped;
    recorder.start(250);

    const maxSec = Number($("maxdur").value);
    startedAt = Date.now();
    stopAt = startedAt + maxSec * 1000;
    $("limit").textContent = `/ ${fmt(maxSec)} max`;
    $("timer").classList.remove("hidden");
    $("stop").classList.remove("hidden");
    $("stop").disabled = false;
    timerId = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      $("elapsed").textContent = fmt(elapsed);
      if (Date.now() >= stopAt) stopRecording(); // hard cap
    }, 500);
  });
}

function stopRecording() {
  $("stop").disabled = true;
  if (timerId) { clearInterval(timerId); timerId = null; }
  if (recorder && recorder.state !== "inactive") {
    try { recorder.stop(); } catch (e) { onRecorderStopped(); }
  } else {
    onRecorderStopped();
  }
}

function onRecorderStopped() {
  if (timerId) { clearInterval(timerId); timerId = null; }
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }

  const blob = new Blob(chunks, { type: recorder && recorder.mimeType ? recorder.mimeType : "video/webm" });
  const durSec = (Date.now() - startedAt) / 1000;
  if (blob.size === 0) {
    alert("No video data was recorded.");
    resetUi();
    return;
  }
  lastBlobUrl = URL.createObjectURL(blob);
  lastFileName = `tabcast-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
  $("preview").src = lastBlobUrl;
  $("meta").textContent = `${fmt(durSec)} · ${(blob.size / 1024 / 1024).toFixed(2)} MB · WebM`;
  $("result").classList.remove("hidden");
  resetUi();
}

function resetUi() {
  $("timer").classList.add("hidden");
  $("stop").classList.add("hidden");
  $("start").classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", init);
