'use strict';
/* Cloze Generator — popup controller. Fully local: no network, no content scripts. */

// ==================== ENGINE-START ====================
// Pure, DOM-free engine — safe to unit-test headlessly.
/** Split text into whitespace-separated tokens, preserving order. */
function tokenize(text) {
  return text.split(/\s+/).filter(Boolean);
}
/** Indices of every Nth token (1-based counting: Nth, 2Nth, ...). */
function nthBlanks(tokens, n) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    if ((i + 1) % n === 0) out.push(i);
  }
  return out;
}
/** Normalize an answer for comparison. */
function normalize(s) {
  return (s || '').trim().toLowerCase();
}
/** True when a typed answer matches the original token. */
function isCorrect(token, answer) {
  return normalize(token) === normalize(answer);
}
// ==================== ENGINE-END ====================

// ---------- UI state ----------
const $ = (id) => document.getElementById(id);
let tokens = [];
let blanked = new Set();

function show(id) {
  ['step-input', 'step-pick', 'step-quiz'].forEach((s) => { $(s).hidden = s !== id; });
}

function updateBlankCount() {
  $('blank-count').textContent = blanked.size;
}

// ---------- Step 2: word picker ----------
function buildWordWall() {
  const wall = $('wordwall');
  wall.innerHTML = '';
  tokens.forEach((tok, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'w' + (blanked.has(i) ? ' blank' : '');
    b.textContent = tok;
    b.addEventListener('click', () => {
      if (blanked.has(i)) blanked.delete(i); else blanked.add(i);
      b.classList.toggle('blank', blanked.has(i));
      updateBlankCount();
    });
    wall.appendChild(b);
  });
  updateBlankCount();
}

// ---------- Step 3: quiz ----------
function renderQuiz() {
  const box = $('quiz');
  box.innerHTML = '';
  $('score').textContent = '';
  tokens.forEach((tok, i) => {
    if (blanked.has(i)) {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.dataset.i = i;
      inp.setAttribute('aria-label', 'Missing word ' + (i + 1));
      inp.placeholder = '…';
      box.appendChild(inp);
    } else {
      box.appendChild(document.createTextNode(tok));
    }
    box.appendChild(document.createTextNode(' '));
  });
}

function checkAnswers() {
  const inputs = $('quiz').querySelectorAll('input');
  let right = 0;
  inputs.forEach((inp) => {
    const tok = tokens[Number(inp.dataset.i)];
    const good = isCorrect(tok, inp.value);
    inp.classList.toggle('ok', good);
    inp.classList.toggle('bad', !good);
    if (good) right++;
  });
  $('score').textContent = right + ' / ' + inputs.length + ' correct';
}

function revealAnswers() {
  $('quiz').querySelectorAll('input').forEach((inp) => {
    inp.value = tokens[Number(inp.dataset.i)];
    inp.classList.remove('bad');
    inp.classList.add('ok');
  });
  $('score').textContent = 'Answers revealed';
}

// ---------- Wiring ----------
$('btn-nth').addEventListener('click', () => {
  const text = $('src').value;
  if (!text.trim()) { $('src').focus(); return; }
  tokens = tokenize(text);
  const n = Math.max(2, Math.min(20, parseInt($('nth').value, 10) || 5));
  blanked = new Set(nthBlanks(tokens, n));
  chrome.storage.local.set({ lastText: text });
  renderQuiz();
  show('step-quiz');
});

$('btn-pick').addEventListener('click', () => {
  const text = $('src').value;
  if (!text.trim()) { $('src').focus(); return; }
  tokens = tokenize(text);
  blanked = new Set();
  chrome.storage.local.set({ lastText: text });
  buildWordWall();
  show('step-pick');
});

$('btn-start').addEventListener('click', () => {
  if (blanked.size === 0) return;
  renderQuiz();
  show('step-quiz');
});

$('btn-back').addEventListener('click', () => show('step-input'));
$('btn-check').addEventListener('click', checkAnswers);
$('btn-reveal').addEventListener('click', revealAnswers);
$('btn-new').addEventListener('click', () => show('step-input'));

// Restore last pasted text for convenience.
chrome.storage.local.get('lastText', (d) => {
  if (d && d.lastText) $('src').value = d.lastText;
});
