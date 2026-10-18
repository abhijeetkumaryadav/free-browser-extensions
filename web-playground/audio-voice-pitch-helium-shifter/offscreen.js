// offscreen.js — lives in the USER_MEDIA offscreen document so recording
// keeps working even if the popup is closed. Mic is only touched after an
// explicit user gesture in the popup (never auto-records).

let recorder = null;
let chunks = [];
let stream = null;
let startTime = 0;

async function startRecording() {
  if (recorder && recorder.state === 'recording') return;
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';
  recorder = new MediaRecorder(stream, { mimeType: mime });
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = async () => {
    const blob = new Blob(chunks, { type: recorder.mimeType });
    const reader = new FileReader();
    reader.onloadend = () => {
      chrome.runtime.sendMessage({
        type: 'helium-recording-done',
        dataUrl: reader.result,
        mimeType: recorder.mimeType,
        durationMs: Date.now() - startTime
      });
      cleanup();
    };
    reader.readAsDataURL(blob);
  };
  startTime = Date.now();
  recorder.start(250);
}

function stopRecording() {
  if (recorder && recorder.state === 'recording') recorder.stop();
  else cleanup();
}

function cleanup() {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  recorder = null;
  chunks = [];
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.target === 'helium-offscreen') {
    if (msg.type === 'start') startRecording().catch((e) => {
      chrome.runtime.sendMessage({ type: 'helium-error', message: String(e && e.message || e) });
      cleanup();
    });
    if (msg.type === 'stop') stopRecording();
  }
});
