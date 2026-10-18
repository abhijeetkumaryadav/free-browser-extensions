'use strict';

/* ============================================================
 * Relic Tags — Old-School HTML Reference
 * Educational — not live. All relics are bundled in this file;
 * nothing here scans web pages. Zero network calls.
 * ============================================================ */

// ENGINE-START

// Storage key
var NOTE_KEY = 'relic_tag_notes';
var BEST_KEY = 'relic_quiz_best';

// Statuses: 'dead' (obsolete), 'alive' (still valid), 'fossil' (deprecated but works)
var RELICS = [
  { tag: '<marquee>', status: 'dead', desc: 'Scrolling-text marquee, an IE invention copied by Netscape. CSS animations replaced it.', example: '<marquee>Look at me scroll!</marquee>' },
  { tag: '<blink>', status: 'dead', desc: 'Netscape-only blinking text. Universally hated; killed off everywhere.', example: '<blink>You cannot unsee this</blink>' },
  { tag: '<font>', status: 'fossil', desc: 'Set typeface, size and color inline. Deprecated in HTML4 — CSS took over.', example: '<font color="red" size="4">Hi</font>' },
  { tag: '<center>', status: 'fossil', desc: 'Centered its contents. Replaced by CSS text-align / margin auto.', example: '<center>Perfectly centered</center>' },
  { tag: '<frameset>', status: 'dead', desc: 'Split the browser window into independent frames. Removed from HTML5.', example: '<frameset cols="25%,75%">…' },
  { tag: '<frame>', status: 'dead', desc: 'One pane inside a frameset. Died with it.', example: '<frame src="menu.html">' },
  { tag: '<applet>', status: 'dead', desc: 'Embedded Java applets. Died when browsers killed Java plugins.', example: '<applet code="Game.class">' },
  { tag: '<bgsound>', status: 'dead', desc: 'IE-only background audio. Nobody misses it. Use <audio> today.', example: '<bgsound src="midi.mid" loop="infinite">' },
  { tag: '<spacer>', status: 'dead', desc: 'Netscape spacer for pixel-perfect layouts before CSS existed.', example: '<spacer type="block" width="100">' },
  { tag: '<keygen>', status: 'dead', desc: 'Generated key pairs in forms for client certificates. Removed from HTML.', example: '<keygen name="key">' },
  { tag: '<big> / <small>', status: 'fossil', desc: '<big> is dead; <small> survived into HTML5 with a new meaning (fine print).', example: '<small>Terms apply</small>' },
  { tag: '<tt>', status: 'fossil', desc: 'Teletype/monospaced text. Use <code> or <kbd> now.', example: '<tt>monospace</tt>' },
  { tag: '<strike>', status: 'fossil', desc: 'Strikethrough text. Use <s> or <del> now.', example: '<strike>deleted</strike>' },
  { tag: '<u>', status: 'alive', desc: 'Underline — was deprecated, then resurrected in HTML5 for misspelled words.', example: '<u>teh</u>' },
  { tag: '<table border>', status: 'fossil', desc: 'Layout tables ruled the 90s web. CSS layout killed them.', example: '<table border="1"><tr><td>…</td></tr></table>' },
  { tag: '<embed>', status: 'alive', desc: 'Survivor! Originally for plugins, now the standard way to embed external content.', example: '<embed src="file.pdf">' }
];

// ---- Relic search -------------------------------------------------

/**
 * Case-insensitive filter across tag name and description.
 * Empty query returns everything.
 */
function filterRelics(relics, query) {
  var q = String(query == null ? '' : query).trim().toLowerCase();
  if (!q) return (relics || []).slice();
  return (relics || []).filter(function (r) {
    return (r.tag + ' ' + r.desc).toLowerCase().indexOf(q) !== -1;
  });
}

// ---- Quiz ---------------------------------------------------------

var QUIZ = [
  { q: 'Which tag made text scroll across the screen?', options: ['<marquee>', '<scroll>', '<slide>', '<blink>'], answer: 0 },
  { q: 'Which browser invented the <blink> tag?', options: ['Internet Explorer', 'Netscape Navigator', 'Opera', 'Mosaic'], answer: 1 },
  { q: 'What replaced the <font> tag for styling text?', options: ['<style> tag', 'CSS', 'JavaScript', '<big> tag'], answer: 1 },
  { q: 'Why did <applet> die?', options: ['Too slow', 'Browsers killed Java plugins', 'It never worked', 'CSS replaced it'], answer: 1 },
  { q: 'Which of these tags SURVIVED into modern HTML?', options: ['<marquee>', '<embed>', '<frameset>', '<bgsound>'], answer: 1 },
  { q: 'What did <bgsound> do?', options: ['Background images', 'Background audio (IE only)', 'Page sounds on click', 'Nothing — it was fake'], answer: 1 },
  { q: 'Which tag split the browser into independent panes?', options: ['<table>', '<frameset>', '<iframe>', '<panel>'], answer: 1 },
  { q: 'The <u> tag was deprecated, then…', options: ['removed forever', 'resurrected in HTML5', 'replaced by <i>', 'made blink'], answer: 1 }
];

var QUIZ_SIZE = QUIZ.length;

/**
 * Pick a shuffled copy of the quiz questions.
 * `rand` is an injectable random function for tests.
 */
function shuffledQuiz(rand) {
  var r = typeof rand === 'function' ? rand : Math.random;
  var arr = QUIZ.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(r() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

/**
 * Check an answer. Returns true when the picked index is correct.
 */
function checkAnswer(question, pickedIndex) {
  if (!question || typeof pickedIndex !== 'number') return false;
  return pickedIndex === question.answer;
}

/**
 * Verdict text for a quiz score.
 */
function quizVerdict(score, total) {
  var pct = total > 0 ? score / total : 0;
  if (pct >= 0.875) return 'Web historian! You remember the wild old web.';
  if (pct >= 0.625) return 'Solid fossil hunter — a few relics escaped you.';
  if (pct >= 0.375) return 'Apprentice archaeologist — dig deeper into the relics tab.';
  return 'Fresh fossil — browse the relics tab and try again.';
}

// ---- Notes ------------------------------------------------------

var MAX_NOTES = 500;

/**
 * Create a note record. Returns the record, or null if invalid.
 */
function makeNote(title, body) {
  var t = String(title == null ? '' : title).trim();
  if (!t) return null;
  return {
    id: 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    title: t.slice(0, 120),
    body: String(body == null ? '' : body).trim().slice(0, 2000),
    createdAt: Date.now()
  };
}

/**
 * Newest-first sort, non-mutating.
 */
function sortNotes(notes) {
  return (notes || []).slice().sort(function (a, b) {
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

/**
 * Case-insensitive filter across title and body.
 */
function filterNotes(notes, query) {
  var q = String(query == null ? '' : query).trim().toLowerCase();
  if (!q) return (notes || []).slice();
  return (notes || []).filter(function (n) {
    return (n.title + ' ' + (n.body || '')).toLowerCase().indexOf(q) !== -1;
  });
}

// ---- Formatting -------------------------------------------------

/**
 * Format a timestamp as a short local date string.
 */
function fmtDate(ts) {
  var d = new Date(Number(ts));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Escape HTML for safe injection.
 */
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ENGINE-END

// ---- UI wiring --------------------------------------------------

var notes = [];
var quiz = [];
var qi = 0;
var qScore = 0;

function loadState() {
  chrome.storage.local.get([NOTE_KEY, BEST_KEY], function (res) {
    notes = Array.isArray(res[NOTE_KEY]) ? res[NOTE_KEY] : [];
    var best = res[BEST_KEY];
    if (typeof best === 'number') {
      document.getElementById('bestScore').textContent = 'Best score: ' + best + ' / ' + QUIZ_SIZE;
    }
    renderRelics();
    renderNotes();
  });
}

function saveNotes(cb) {
  chrome.storage.local.set({ relic_tag_notes: notes }, function () { if (cb) cb(); });
}

function renderRelics() {
  var q = document.getElementById('search').value;
  var list = document.getElementById('relicList');
  var filtered = filterRelics(RELICS, q);
  document.getElementById('relicCount').textContent =
    RELICS.length + (RELICS.length === 1 ? ' relic' : ' relics');
  document.getElementById('emptyRelics').style.display = filtered.length ? 'none' : 'block';
  list.innerHTML = '';
  filtered.forEach(function (r) {
    var li = document.createElement('li');
    li.className = 'relic';
    var statusLabel = r.status === 'dead' ? 'Obsolete' : (r.status === 'alive' ? 'Still alive' : 'Deprecated');
    li.innerHTML =
      '<div class="relic-head">' +
        '<span class="relic-tag">' + escHtml(r.tag) + '</span>' +
        '<span class="status ' + r.status + '">' + statusLabel + '</span>' +
      '</div>' +
      '<p class="relic-desc">' + escHtml(r.desc) + '</p>' +
      '<div class="relic-example">' + escHtml(r.example) + '</div>';
    list.appendChild(li);
  });
}

function renderNotes() {
  var q = document.getElementById('noteSearch').value;
  var list = document.getElementById('noteList');
  var filtered = sortNotes(filterNotes(notes, q));
  document.getElementById('emptyNotes').style.display = filtered.length ? 'none' : 'block';
  list.innerHTML = '';
  filtered.forEach(function (n) {
    var li = document.createElement('li');
    li.className = 'note';
    li.innerHTML =
      '<div class="note-head">' +
        '<span class="note-title">' + escHtml(n.title) + '</span>' +
        '<span class="note-date">' + escHtml(fmtDate(n.createdAt)) + '</span>' +
        '<button class="del-btn" data-id="' + n.id + '" title="Delete note" aria-label="Delete note">&times;</button>' +
      '</div>' +
      (n.body ? '<p class="note-body">' + escHtml(n.body) + '</p>' : '');
    list.appendChild(li);
  });
}

// Quiz flow
function showQuiz(el) {
  ['quizStart', 'quizPlay', 'quizDone'].forEach(function (id) {
    document.getElementById(id).hidden = id !== el;
  });
}

function startQuiz() {
  quiz = shuffledQuiz();
  qi = 0;
  qScore = 0;
  showQuiz('quizPlay');
  renderQuestion();
}

function renderQuestion() {
  var q = quiz[qi];
  document.getElementById('qNum').textContent = 'Question ' + (qi + 1) + ' of ' + quiz.length;
  document.getElementById('qBar').style.width = ((qi / quiz.length) * 100) + '%';
  document.getElementById('qText').textContent = q.q;
  var box = document.getElementById('qOptions');
  box.innerHTML = '';
  q.options.forEach(function (opt, idx) {
    var b = document.createElement('button');
    b.className = 'opt';
    b.textContent = opt;
    b.addEventListener('click', function () { answerQuestion(idx); });
    box.appendChild(b);
  });
}

function answerQuestion(idx) {
  var q = quiz[qi];
  var btns = document.getElementById('qOptions').children;
  var correct = checkAnswer(q, idx);
  if (correct) qScore++;
  for (var i = 0; i < btns.length; i++) {
    btns[i].disabled = true;
    if (i === q.answer) btns[i].classList.add('correct');
    else if (i === idx) btns[i].classList.add('wrong');
  }
  setTimeout(function () {
    qi++;
    if (qi < quiz.length) renderQuestion();
    else finishQuiz();
  }, 700);
}

function finishQuiz() {
  document.getElementById('qBar').style.width = '100%';
  document.getElementById('qScore').textContent = qScore + ' / ' + quiz.length;
  document.getElementById('qVerdict').textContent = quizVerdict(qScore, quiz.length);
  showQuiz('quizDone');
  chrome.storage.local.get([BEST_KEY], function (res) {
    var best = typeof res[BEST_KEY] === 'number' ? res[BEST_KEY] : -1;
    if (qScore > best) {
      chrome.storage.local.set({ relic_quiz_best: qScore }, function () {
        document.getElementById('bestScore').textContent = 'Best score: ' + qScore + ' / ' + QUIZ_SIZE;
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  // Tabs
  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      document.getElementById('tab-' + t.dataset.tab).classList.add('active');
    });
  });

  document.getElementById('search').addEventListener('input', renderRelics);

  // Quiz buttons
  document.getElementById('startQuiz').addEventListener('click', startQuiz);
  document.getElementById('againQuiz').addEventListener('click', startQuiz);

  // Notes
  document.getElementById('noteForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (notes.length >= MAX_NOTES) return;
    var note = makeNote(
      document.getElementById('nTitle').value,
      document.getElementById('nBody').value
    );
    if (!note) return;
    notes.push(note);
    saveNotes(renderNotes);
    document.getElementById('noteForm').reset();
  });
  document.getElementById('noteSearch').addEventListener('input', renderNotes);
  document.getElementById('noteList').addEventListener('click', function (e) {
    var btn = e.target.closest('.del-btn');
    if (!btn) return;
    notes = notes.filter(function (n) { return n.id !== btn.dataset.id; });
    saveNotes(renderNotes);
  });

  loadState();
});
