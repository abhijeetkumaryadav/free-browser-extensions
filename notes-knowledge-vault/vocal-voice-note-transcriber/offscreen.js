/* VocalNote — offscreen recorder (reason: USER_MEDIA).
 * Runs MediaRecorder + optional live SpeechRecognition here so recording
 * survives the popup closing. Audio is saved to IndexedDB locally.
 * Transcription uses the browser's built-in Web Speech API, which in Chrome
 * may send audio to Google's speech servers — the user can disable it and
 * record offline-only.
 */
'use strict';

let recorder = null;
let stream = null;
let chunks = [];
let startedAt = 0;
let recognizer = null;
let transcript = '';
let wantTranscript = true;
let liveTimer = null;

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

function setBadge(rec) {
  chrome.action.setBadgeText({ text: rec ? 'REC' : '' });
  chrome.action.setBadgeBackgroundColor({ text: '', color: '#f43f5e' });
}

function startRecognition() {
  if (!SR || !wantTranscript) return;
  try {
    recognizer = new SR();
    recognizer.lang = 'en-US';
    recognizer.interimResults = true;
    recognizer.continuous = true;
    recognizer.onresult = ev => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) transcript += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      broadcast({ type: 'VN_TRANSCRIPT', final: transcript.trim(), interim: interim.trim() });
    };
    recognizer.onerror = () => {}; // keep recording even if STT fails
    recognizer.start();
  } catch { recognizer = null; }
}

function broadcast(msg) {
  // Popup may be closed — failure is fine.
  chrome.runtime.sendMessage(msg).catch(() => {});
}

async function startRecording(opts) {
  if (recorder) return { ok: false, error: 'already' };
  wantTranscript = opts.transcript !== false;
  transcript = '';
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return { ok: false, error: 'mic-denied' };
  }
  chunks = [];
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus' : 'audio/webm';
  recorder = new MediaRecorder(stream, { mimeType: mime });
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = saveNote;
  recorder.start(250);
  startedAt = Date.now();
  startRecognition();
  setBadge(true);
  // Live elapsed-time ticks for the popup.
  liveTimer = setInterval(() => broadcast({
    type: 'VN_TICK', elapsed: Math.floor((Date.now() - startedAt) / 1000)
  }), 1000);
  return { ok: true, stt: !!SR };
}

async function stopRecording(title) {
  if (!recorder) return { ok: false };
  clearInterval(liveTimer);
  try { recognizer && recognizer.stop(); } catch {}
  recognizer = null;
  const p = new Promise(res => { recorder.onstop = () => saveNote(title).then(res); });
  recorder.stop();
  return p;
}

async function saveNote(title) {
  const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
  const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const note = {
    id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title: (title && title.trim()) || ('Note — ' + new Date().toLocaleString()),
    createdAt: Date.now(),
    durationSec,
    mime: blob.type || 'audio/webm',
    audio: blob,
    transcript: transcript.trim()
  };
  await NotesDB.put(note);
  stream && stream.getTracks().forEach(t => t.stop());
  stream = null; recorder = null; chunks = [];
  setBadge(false);
  broadcast({ type: 'VN_SAVED', id: note.id });
  return { ok: true, id: note.id };
}

async function cancelRecording() {
  if (!recorder) return { ok: false };
  clearInterval(liveTimer);
  try { recognizer && recognizer.stop(); } catch {}
  recognizer = null;
  recorder.onstop = null;
  recorder.stop();
  stream.getTracks().forEach(t => t.stop());
  stream = null; recorder = null; chunks = [];
  setBadge(false);
  broadcast({ type: 'VN_CANCELLED' });
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg, _s, respond) => {
  (async () => {
    if (msg.type === 'VN_START') respond(await startRecording(msg));
    else if (msg.type === 'VN_STOP') respond(await stopRecording(msg.title));
    else if (msg.type === 'VN_CANCEL') respond(await cancelRecording());
    else if (msg.type === 'VN_STATUS') respond({ recording: !!recorder, stt: !!SR });
    else respond({ ok: false });
  })();
  return true; // async respond
});
