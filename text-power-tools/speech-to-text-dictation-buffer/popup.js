/* DictatePad — press-and-hold dictation via the browser's built-in Web Speech API.
 * The mic listens ONLY while the talk button is held. Interim results stream
 * live; final results are appended to the buffer. Buffer autosaves locally. */
'use strict';

const talkBtn    = document.getElementById('talkBtn');
const buffer     = document.getElementById('buffer');
const interimEl  = document.getElementById('interim');
const statusEl   = document.getElementById('status');
const statusText = document.getElementById('statusText');
const copyBtn    = document.getElementById('copyBtn');
const clearBtn   = document.getElementById('clearBtn');
const wordCount  = document.getElementById('wordCount');
const toast      = document.getElementById('toast');
const warn       = document.getElementById('warn');

// Web Speech API is exposed as SpeechRecognition or webkitSpeechRecognition
// (Chrome / Edge). Firefox does not implement it.
const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;   // active recognizer, null when not listening
let isHeld = false;       // physical hold state of the talk button
let saveTimer = null;

function showToast(msg) {
  toast.textContent = msg;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.textContent = ''; }, 2200);
}

function setStatus(state, label) {
  statusEl.classList.toggle('listening', state === 'listening');
  statusText.textContent = label;
}

/** Live word count of the buffer. */
function updateCount() {
  const n = (buffer.value.match(/[a-z0-9']+/gi) || []).length;
  wordCount.textContent = n.toLocaleString('en-US');
}

/** Debounced autosave of the buffer. */
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({ dictBuffer: buffer.value });
  }, 500);
}

/** Insert a final transcript chunk at the caret, with spacing. */
function insertText(chunk) {
  chunk = chunk.trim();
  if (!chunk) return;
  const start = buffer.selectionStart;
  const end = buffer.selectionEnd;
  const before = buffer.value.slice(0, start);
  const after = buffer.value.slice(end);
  const needsSpace = before.length > 0 && !/\s$/.test(before);
  buffer.value = before + (needsSpace ? ' ' : '') + chunk + ' ' + after;
  const caret = before.length + (needsSpace ? 1 : 0) + chunk.length + 1;
  buffer.selectionStart = buffer.selectionEnd = caret;
  updateCount();
  scheduleSave();
}

/** Start a fresh recognition session (called when the hold begins). */
function startListening() {
  if (!SpeechAPI || recognition) return;
  recognition = new SpeechAPI();
  recognition.continuous = true;      // keep listening across pauses
  recognition.interimResults = true;  // stream partial transcripts
  recognition.lang = navigator.language || 'en-US';

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) {
        insertText(r[0].transcript);
        interim = ''; // final replaces the interim display
      } else {
        interim += r[0].transcript;
      }
    }
    if (interim) {
      interimEl.hidden = false;
      interimEl.textContent = '… ' + interim;
    } else {
      interimEl.hidden = true;
    }
  };

  recognition.onerror = (event) => {
    // 'no-speech' and 'aborted' are normal when the hold is released.
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showToast('Microphone blocked — allow mic access and try again.');
    } else if (event.error === 'network') {
      showToast('Speech service unreachable — check your connection.');
    }
  };

  recognition.onend = () => {
    recognition = null;
    interimEl.hidden = true;
    setStatus('idle', 'Idle');
    talkBtn.classList.remove('held');
    // If the button is still held (e.g. the recognizer timed out), restart.
    if (isHeld) startListening();
  };

  try {
    recognition.start();
    setStatus('listening', 'Listening…');
  } catch (e) {
    recognition = null; // start() throws if called twice quickly
  }
}

/** Stop the current recognition session (called when the hold ends). */
function stopListening() {
  if (recognition) {
    try { recognition.stop(); } catch (e) { /* already stopped */ }
  }
  interimEl.hidden = true;
  talkBtn.classList.remove('held');
}

// --- Hold-to-dictate (pointer events cover mouse + touch) ------------------
talkBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  talkBtn.setPointerCapture(e.pointerId);
  isHeld = true;
  talkBtn.classList.add('held');
  startListening();
});

function releaseHold() {
  isHeld = false;
  stopListening();
}
talkBtn.addEventListener('pointerup', releaseHold);
talkBtn.addEventListener('pointercancel', releaseHold);
// Safety: stop if the popup loses focus while held.
window.addEventListener('blur', releaseHold);

// --- Buffer actions ---------------------------------------------------------
copyBtn.addEventListener('click', async () => {
  if (!buffer.value) { showToast('Nothing to copy.'); return; }
  try {
    await navigator.clipboard.writeText(buffer.value);
    showToast('Copied to clipboard.');
  } catch (e) {
    // Fallback for contexts where the Clipboard API is unavailable.
    buffer.select();
    document.execCommand('copy');
    showToast('Copied to clipboard.');
  }
});

clearBtn.addEventListener('click', () => {
  if (!buffer.value) return;
  buffer.value = '';
  updateCount();
  chrome.storage.local.set({ dictBuffer: '' });
  showToast('Buffer cleared.');
});

buffer.addEventListener('input', () => {
  updateCount();
  scheduleSave();
});

// --- Init -------------------------------------------------------------------
if (!SpeechAPI) {
  warn.hidden = false;
  talkBtn.disabled = true;
} else {
  talkBtn.disabled = false;
}

chrome.storage.local.get({ dictBuffer: '' }, (data) => {
  buffer.value = data.dictBuffer || '';
  updateCount();
});
