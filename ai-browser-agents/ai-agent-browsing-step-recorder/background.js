/* StepLog — background service worker.
 * Holds recording state, logs navigation steps, relays content-script events,
 * persists sessions, and drives the red REC badge. */

'use strict';

const MAX_SESSIONS = 50;   // keep newest N sessions
const MAX_STEPS = 500;     // cap steps per session
const STEP_VALUE_LEN = 140; // truncate typed values in logs

let state = { recording: false, sessionId: null, sessions: [] };

/* ---------------- storage helpers ---------------- */
async function loadState() {
  try {
    const d = await chrome.storage.local.get(['stepLogSessions']);
    state.sessions = Array.isArray(d.stepLogSessions) ? d.stepLogSessions : [];
  } catch { state.sessions = []; }
}

async function persist() {
  try {
    await chrome.storage.local.set({
      stepLogSessions: state.sessions.slice(-MAX_SESSIONS),
    });
  } catch { /* storage full — keep memory copy */ }
}

/* ---------------- badge ---------------- */
function updateBadge() {
  if (state.recording) {
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' }).catch(() => {});
    chrome.action.setBadgeText({ text: 'REC' }).catch(() => {});
  } else {
    chrome.action.setBadgeText({ text: '' }).catch(() => {});
  }
}

/* ---------------- step logging ---------------- */
function currentSession() {
  return state.sessions.find((s) => s.id === state.sessionId) || null;
}

function addStep(step) {
  if (!state.recording) return;
  const s = currentSession();
  if (!s) return;
  if (s.steps.length >= MAX_STEPS) return; // drop extras, keep recorder bounded
  s.steps.push({ ts: Date.now(), note: '', ...step });
  s.stepCount = s.steps.length;
  persist(); // fire-and-forget
}

/* ---------------- recording control ---------------- */
async function startRecording() {
  await loadState();
  const session = {
    id: 's' + Date.now().toString(36),
    title: 'Session ' + new Date().toLocaleString(),
    startedAt: Date.now(),
    endedAt: null,
    steps: [],
    stepCount: 0,
  };
  state.sessions.push(session);
  state.sessionId = session.id;
  state.recording = true;
  updateBadge();
  await persist();
  broadcastState();
  // Log the currently active tab as step 1
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab && tab.url && /^https?:/.test(tab.url)) {
      addStep({ type: 'navigation', url: tab.url, title: tab.title || tab.url });
    }
  } catch { /* ignore */ }
  return session;
}

async function stopRecording() {
  const s = currentSession();
  if (s) s.endedAt = Date.now();
  state.recording = false;
  state.sessionId = null;
  updateBadge();
  await persist();
  broadcastState();
  return s;
}

function broadcastState() {
  chrome.tabs.query({}).then((tabs) => {
    for (const t of tabs) {
      chrome.tabs.sendMessage(t.id, { kind: 'stepLog:state', recording: state.recording }).catch(() => {});
    }
  }).catch(() => {});
}

/* ---------------- events ---------------- */
// Navigation steps while recording
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!state.recording) return;
  if (changeInfo.status === 'complete' && tab.url && /^https?:/.test(tab.url)) {
    addStep({ type: 'navigation', url: tab.url, title: tab.title || tab.url });
  }
});

// Messages from content scripts + popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg && msg.kind) {
      case 'stepLog:getState':
        sendResponse({ recording: state.recording, sessionId: state.sessionId });
        break;
      case 'stepLog:event': // click / fill from content script
        addStep({
          type: msg.eventType, // 'click' | 'fill'
          url: sender.tab ? sender.tab.url : '',
          selector: msg.selector || '',
          label: msg.label || '',
          value: msg.eventType === 'fill' && msg.isPassword ? '(password field — value not recorded)' : (msg.value || '').slice(0, STEP_VALUE_LEN),
        });
        sendResponse({ ok: true });
        break;
      case 'stepLog:start':
        sendResponse({ session: await startRecording() });
        break;
      case 'stepLog:stop':
        sendResponse({ session: await stopRecording() });
        break;
      case 'stepLog:list':
        await loadState();
        sendResponse({
          recording: state.recording,
          sessionId: state.sessionId,
          sessions: state.sessions.slice().reverse(), // newest first
        });
        break;
      case 'stepLog:getSession':
        await loadState();
        sendResponse({ session: state.sessions.find((s) => s.id === msg.id) || null });
        break;
      case 'stepLog:annotate': {
        await loadState();
        const s = state.sessions.find((x) => x.id === msg.sessionId);
        if (s && s.steps[msg.index]) { s.steps[msg.index].note = String(msg.note || '').slice(0, 500); await persist(); }
        sendResponse({ ok: true });
        break;
      }
      case 'stepLog:delete':
        await loadState();
        state.sessions = state.sessions.filter((x) => x.id !== msg.id);
        await persist();
        sendResponse({ ok: true });
        break;
      case 'stepLog:clearAll':
        state.sessions = [];
        await persist();
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ ok: false, error: 'unknown message' });
    }
  })();
  return true; // async response
});

// Init: never resume recording across restarts (explicit user start only)
loadState().then(() => { state.recording = false; state.sessionId = null; updateBadge(); });
