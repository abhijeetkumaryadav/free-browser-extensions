/* Zen Workspace new-tab logic — clock, focus task, breathing cycles, notes.
   All state in chrome.storage.local. No network. */
'use strict';

const $ = (id) => document.getElementById(id);
const DEFAULTS = {
  focus: '',
  focusDone: false,
  notes: '',
  inhale: 4,
  hold: 4,
  exhale: 6
};
let state = { ...DEFAULTS };

/* ---------- clock ---------- */
function tickClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  $('clock').textContent = hh + ':' + mm;
  $('dateLine').textContent = now.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric'
  });
  const h = now.getHours();
  const g = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  $('greeting').textContent = g + ' — one thing at a time.';
}
setInterval(tickClock, 1000);

/* ---------- persistence ---------- */
let saveTimer = null;
async function save(immediate) {
  $('saveState').textContent = 'Saving…';
  $('saveState').classList.add('dirty');
  const write = () => {
    chrome.storage.local.set({ zenworkspace: state }).then(() => {
      $('saveState').textContent = 'Saved';
      $('saveState').classList.remove('dirty');
    });
  };
  if (immediate) { clearTimeout(saveTimer); write(); return; }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(write, 600);
}

/* ---------- focus task ---------- */
function paintFocus() {
  $('focusInput').value = state.focus || '';
  $('focusDone').classList.toggle('done', !!state.focusDone);
  $('focusDoneMsg').hidden = !state.focusDone;
}
$('focusInput').addEventListener('input', (e) => {
  state.focus = e.target.value;
  state.focusDone = false;
  paintFocus();
  save();
});
$('focusDone').addEventListener('click', () => {
  if (!state.focus.trim()) return;
  state.focusDone = !state.focusDone;
  paintFocus();
  save(true);
});

/* ---------- notes ---------- */
function updateWordCount() {
  const words = state.notes.trim().split(/\s+/).filter(Boolean).length;
  $('wordCount').textContent = words + (words === 1 ? ' word' : ' words');
}
$('notes').addEventListener('input', (e) => {
  state.notes = e.target.value;
  updateWordCount();
  save();
});
$('clearNotes').addEventListener('click', () => {
  if (!state.notes) return;
  if (window.confirm('Clear the scratchpad?')) {
    state.notes = '';
    $('notes').value = '';
    updateWordCount();
    save(true);
  }
});

/* ---------- breathing ---------- */
let breathRunning = false;
let breathTimers = [];

function clearBreathTimers() {
  breathTimers.forEach(clearTimeout);
  breathTimers = [];
}
function later(ms, fn) { breathTimers.push(setTimeout(fn, ms)); }

function setOrb(scale, seconds) {
  const orb = $('breathOrb');
  orb.style.transition = 'transform ' + seconds + 's ease-in-out';
  // force reflow so the transition retriggers cleanly
  void orb.offsetWidth;
  orb.style.transform = 'scale(' + scale + ')';
}
function setLabel(text, active) {
  const l = $('breathLabel');
  l.textContent = text;
  l.classList.toggle('active', !!active);
}

function breathCycle() {
  if (!breathRunning) return;
  const { inhale, hold, exhale } = state;
  setLabel('Inhale', true);
  setOrb(1.45, inhale);
  later(inhale * 1000, () => {
    if (!breathRunning) return;
    if (hold > 0) {
      setLabel('Hold', true);
      later(hold * 1000, exhalePhase);
    } else {
      exhalePhase();
    }
  });
  function exhalePhase() {
    if (!breathRunning) return;
    setLabel('Exhale', true);
    setOrb(1, exhale);
    later(exhale * 1000, breathCycle);
  }
}

function stopBreath() {
  breathRunning = false;
  clearBreathTimers();
  setOrb(1, 0.6);
  setLabel('Ready', false);
  $('breathBtn').textContent = 'Begin breathing';
  $('breathBtn').classList.remove('stop');
}

$('breathBtn').addEventListener('click', () => {
  if (breathRunning) { stopBreath(); return; }
  breathRunning = true;
  $('breathBtn').textContent = 'Stop';
  $('breathBtn').classList.add('stop');
  breathCycle();
});

/* breath sliders */
function bindBreath(id, key) {
  $(id).addEventListener('input', (e) => {
    state[key] = parseInt(e.target.value, 10);
    $(id + 'Val').textContent = state[key] + 's';
    save();
  });
}
bindBreath('inhale', 'inhale');
bindBreath('hold', 'hold');
bindBreath('exhale', 'exhale');

/* ---------- init ---------- */
(async function init() {
  tickClock();
  const stored = await chrome.storage.local.get('zenworkspace');
  state = { ...DEFAULTS, ...(stored.zenworkspace || {}) };
  paintFocus();
  $('notes').value = state.notes || '';
  updateWordCount();
  $('inhale').value = state.inhale; $('inhaleVal').textContent = state.inhale + 's';
  $('hold').value = state.hold; $('holdVal').textContent = state.hold + 's';
  $('exhale').value = state.exhale; $('exhaleVal').textContent = state.exhale + 's';
})();
