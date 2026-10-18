/**
 * popup.js — Tab Recorder popup controller.
 *
 * - Start/Stop buttons talk to the background service worker.
 * - While recording, a 500 ms poll refreshes the timer and status pill.
 * - The "last recording" card renders the metadata the worker persisted.
 */

const $ = (id) => document.getElementById(id);

const startBtn = $('startBtn');
const stopBtn = $('stopBtn');
const audioToggle = $('audioToggle');
const timerEl = $('timer');
const pill = $('statusPill');
const errorEl = $('error');
const lastCard = $('lastCard');

let pollId = null;

/** mm:ss (or h:mm:ss) for a millisecond duration. */
function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return (h > 0 ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
}

/** 1.2 MB / 340 KB style formatting. */
function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return value.toFixed(value >= 100 || unit === 0 ? 0 : 1) + ' ' + units[unit];
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

/** Render recording state into the pill, timer and buttons. */
function renderState(state) {
  const isRecording = !!(state && state.recording);
  pill.textContent = isRecording ? 'Recording' : 'Idle';
  pill.classList.toggle('live', isRecording);
  timerEl.classList.toggle('live', isRecording);
  startBtn.disabled = isRecording;
  stopBtn.disabled = !isRecording;
  audioToggle.disabled = isRecording;

  if (isRecording && state.startedAt) {
    timerEl.textContent = formatDuration(Date.now() - state.startedAt);
  } else if (!isRecording) {
    timerEl.textContent = '00:00';
  }

  const last = state && state.lastRecording;
  if (last) {
    lastCard.hidden = false;
    $('lastName').textContent = last.filename || '—';
    $('lastDur').textContent = last.durationMs ? formatDuration(last.durationMs) : '—';
    $('lastSize').textContent = formatBytes(last.bytes);
  }

  if (isRecording && !pollId) {
    pollId = setInterval(refresh, 500);
  } else if (!isRecording && pollId) {
    clearInterval(pollId);
    pollId = null;
  }
}

async function refresh() {
  try {
    const state = await chrome.runtime.sendMessage({ type: 'get-state' });
    renderState(state);
  } catch (e) {
    /* worker asleep; try again next tick */
  }
}

startBtn.addEventListener('click', async () => {
  clearError();
  startBtn.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'start-recording', audio: audioToggle.checked
    });
    if (!result || !result.ok) {
      showError((result && result.error) || 'Could not start recording.');
      startBtn.disabled = false;
      return;
    }
    // Close the popup so the user can interact with the tab being recorded.
    window.close();
  } catch (e) {
    showError(String((e && e.message) || e));
    startBtn.disabled = false;
  }
});

stopBtn.addEventListener('click', async () => {
  clearError();
  stopBtn.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: 'stop-recording' });
    if (!result || !result.ok) {
      showError((result && result.error) || 'Could not stop recording.');
    }
    // Give the offscreen doc a moment to ship bytes, then refresh.
    setTimeout(refresh, 1500);
  } catch (e) {
    showError(String((e && e.message) || e));
  } finally {
    refresh();
  }
});

// Initial paint.
refresh();
