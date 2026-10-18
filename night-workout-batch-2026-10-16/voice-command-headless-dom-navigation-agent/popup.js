// ─── Voice Command Navigator — popup controller ─────────────────────────────
// Speech capture via the Web Speech API (webkitSpeechRecognition in Chrome).
// Recognition runs entirely in the browser; no audio leaves the machine.
// Each final transcript is matched against COMMANDS, then routed to the
// background worker which performs the tab action.

// ─── Command patterns ───────────────────────────────────────────────────────
/**
 * Ordered matcher table. Each entry: regexes → {action, phraseFn}.
 * First match wins; `phrase` is only used by the click-text action.
 */
const COMMANDS = [
  { re: /\bscroll\s+down\b/i, action: 'scroll-down', label: 'Scroll down' },
  { re: /\bscroll\s+up\b/i, action: 'scroll-up', label: 'Scroll up' },
  { re: /\bgo\s+back\b/i, action: 'go-back', label: 'Go back' },
  { re: /\bgo\s+forward\b/i, action: 'go-forward', label: 'Go forward' },
  { re: /\breload\b|\brefresh\b/i, action: 'reload', label: 'Reload page' },
  { re: /\bclose\s+tab\b/i, action: 'close-tab', label: 'Close tab' },
  { re: /\bgo\s+to\s+top\b|\bscroll\s+to\s+top\b|^top$/i, action: 'top', label: 'Scroll to top' },
  { re: /\bgo\s+to\s+bottom\b|\bscroll\s+to\s+bottom\b|^bottom$/i, action: 'bottom', label: 'Scroll to bottom' },
  { re: /\bclick\s+(.+)/i, action: 'click-text', label: (m) => `Click “${m[1].trim()}”`, phrase: (m) => m[1].trim() },
];

/**
 * Match a transcript against the command table.
 * @param {string} text Final recognition transcript.
 * @returns {{action: string, label: string, phrase?: string} | null}
 */
function matchCommand(text) {
  const clean = text.trim();
  for (const cmd of COMMANDS) {
    const m = clean.match(cmd.re);
    if (m) {
      return {
        action: cmd.action,
        label: typeof cmd.label === 'function' ? cmd.label(m) : cmd.label,
        phrase: cmd.phrase ? cmd.phrase(m) : undefined,
      };
    }
  }
  return null;
}

// ─── DOM refs ───────────────────────────────────────────────────────────────
const micBtn = document.getElementById('micBtn');
const micState = document.getElementById('micState');
const heardEl = document.getElementById('heard');
const matchedEl = document.getElementById('matched');
const unsupportedEl = document.getElementById('unsupported');

// ─── Speech recognition setup ───────────────────────────────────────────────
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
let listening = false;

if (!SR) {
  unsupportedEl.classList.remove('hidden');
  micBtn.disabled = true;
} else {
  rec = new SR();
  rec.lang = 'en-US';
  rec.interimResults = true;   // show live partial transcripts
  rec.maxAlternatives = 1;

  rec.onresult = (event) => {
    let interim = '', final = '';
    for (const res of event.results) {
      if (res.isFinal) final += res[0].transcript;
      else interim += res[0].transcript;
    }
    heardEl.textContent = final || interim || '—';
    if (final) handleTranscript(final);
  };

  rec.onerror = (event) => {
    micState.textContent = event.error === 'not-allowed'
      ? 'Mic permission denied — allow it to use voice commands'
      : `Recognition error: ${event.error}`;
    setListening(false);
  };

  rec.onend = () => setListening(false); // natural end (pause); user re-taps to listen again
}

function setListening(on) {
  listening = on;
  micBtn.classList.toggle('listening', on);
  micState.textContent = on ? 'Listening… speak a command' : 'Tap the mic and speak';
}

micBtn.addEventListener('click', () => {
  if (!rec) return;
  if (listening) { rec.stop(); return; }
  try { rec.start(); setListening(true); }
  catch (err) { micState.textContent = 'Could not start recognition'; }
});

// ─── Transcript → action ────────────────────────────────────────────────────
/**
 * Match a final transcript and dispatch it to the background worker.
 * @param {string} text
 */
async function handleTranscript(text) {
  const cmd = matchCommand(text);
  if (!cmd) {
    matchedEl.textContent = 'No command matched — try “scroll down” or “click …”';
    return;
  }
  matchedEl.textContent = cmd.label + '…';
  const payload = { type: 'exec-command', action: cmd.action };
  if (cmd.phrase) payload.phrase = cmd.phrase;
  try {
    const res = await chrome.runtime.sendMessage(payload);
    if (res?.ok && cmd.action === 'click-text') {
      matchedEl.textContent = res.matched ? `Clicked “${res.label}”` : `No match for “${cmd.phrase}”`;
    } else if (res?.ok) {
      matchedEl.textContent = cmd.label + ' ✓';
    } else {
      matchedEl.textContent = `Failed: ${res?.error || 'unknown error'}`;
    }
  } catch (err) {
    matchedEl.textContent = 'Failed to reach background worker';
  }
}
