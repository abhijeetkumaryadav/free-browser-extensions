/* WordTicker — live text statistics, all computed on-device. */
'use strict';

// Common stopwords excluded from the keyword-density list.
const STOPWORDS = new Set([
  'the','a','an','and','or','but','of','to','in','on','for','with','at','by','from',
  'is','are','was','were','be','been','being','it','its','this','that','these','those',
  'i','you','he','she','we','they','them','his','her','their','our','my','your','as',
  'not','no','so','if','then','than','too','very','can','will','just','about','into',
  'out','up','down','over','under','again','once','here','there','when','where','why',
  'how','all','any','both','each','few','more','most','other','some','such','only',
  'own','same','do','does','did','doing','have','has','had','having','would','should',
  'could','may','might','must','shall','s','t','d','ll','m','re','ve'
]);

const editor   = document.getElementById('editor');
const clearBtn = document.getElementById('clearBtn');
const goalEdit = document.getElementById('goalEdit');
const dialog   = document.getElementById('goalDialog');
const goalInput = document.getElementById('goalInput');

let wordGoal = 500;
let saveTimer = null;

/** Split text into words (letters, digits, apostrophes). */
function words(text) {
  const m = text.toLowerCase().match(/[a-z0-9']+/g);
  return m || [];
}

/** Count sentences: chunks ending in . ! ? (fallback to 1 if text has words). */
function sentences(text) {
  const parts = text.split(/[.!?…]+/).map(s => s.trim()).filter(s => s.length > 0);
  return parts.length;
}

/** Format a reading-time estimate (200 wpm). */
function readingTime(wordCount) {
  if (wordCount === 0) return '0s';
  const totalSecs = Math.round((wordCount / 200) * 60);
  if (totalSecs < 60) return totalSecs + 's';
  const min = Math.floor(totalSecs / 60);
  const sec = totalSecs % 60;
  return sec === 0 ? min + 'm' : min + 'm ' + sec + 's';
}

/** Compute all statistics and refresh the UI. */
function update() {
  const text = editor.value;

  const w = words(text);
  const wordCount = w.length;
  const chars = text.length;
  const noSpace = text.replace(/\s/g, '').length;
  const sentCount = wordCount === 0 ? 0 : sentences(text);
  const paraCount = text.trim() === '' ? 0 : text.split(/\n\s*\n|\r\n\s*\r\n/).filter(p => p.trim().length > 0).length || (wordCount > 0 ? 1 : 0);

  setNum('stWords', wordCount);
  setNum('stChars', chars);
  setNum('stNoSpace', noSpace);
  setNum('stSent', sentCount);
  setNum('stPara', paraCount);
  document.getElementById('stRead').textContent = readingTime(wordCount);

  updateGoal(wordCount);
  updateKeywords(w, wordCount);

  // Autosave draft (debounced).
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({ draft: text, wordGoal: wordGoal });
  }, 500);
}

function setNum(id, n) {
  document.getElementById(id).textContent = n.toLocaleString('en-US');
}

/** Refresh the word-goal progress bar. */
function updateGoal(wordCount) {
  const pct = wordGoal > 0 ? Math.min(100, Math.round((wordCount / wordGoal) * 100)) : 0;
  document.getElementById('goalFill').style.width = pct + '%';
  document.getElementById('goalCur').textContent = wordCount.toLocaleString('en-US');
  document.getElementById('goalMax').textContent = wordGoal.toLocaleString('en-US');
  const pctEl = document.getElementById('goalPct');
  pctEl.textContent = pct + '%';
  pctEl.classList.toggle('goal-done', wordGoal > 0 && wordCount >= wordGoal);
}

/** Show the top-5 keyword density list (stopwords excluded). */
function updateKeywords(wordArr, wordCount) {
  const list = document.getElementById('kwList');
  const empty = document.getElementById('kwEmpty');
  list.innerHTML = '';

  if (wordCount === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  const freq = new Map();
  for (const w of wordArr) {
    if (STOPWORDS.has(w) || w.length < 3) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length === 0) { empty.style.display = 'block'; return; }

  const maxCount = top[0][1];
  for (const [word, count] of top) {
    const pct = ((count / wordCount) * 100);
    const li = document.createElement('li');
    const wSpan = document.createElement('span');
    wSpan.className = 'kw-word';
    wSpan.textContent = word;
    const pSpan = document.createElement('span');
    pSpan.className = 'kw-pct';
    pSpan.textContent = count + '× · ' + pct.toFixed(1) + '%';
    const meter = document.createElement('div');
    meter.className = 'kw-meter';
    const fill = document.createElement('i');
    fill.style.width = Math.round((count / maxCount) * 100) + '%';
    meter.appendChild(fill);
    li.appendChild(wSpan);
    li.appendChild(pSpan);
    li.appendChild(meter);
    list.appendChild(li);
  }
}

// --- Events --------------------------------------------------------------

editor.addEventListener('input', update);

clearBtn.addEventListener('click', () => {
  editor.value = '';
  update();
  chrome.storage.local.set({ draft: '' });
});

goalEdit.addEventListener('click', () => {
  goalInput.value = wordGoal;
  dialog.hidden = false;
  goalInput.focus();
  goalInput.select();
});

document.getElementById('goalCancel').addEventListener('click', () => {
  dialog.hidden = true;
});

document.getElementById('goalSave').addEventListener('click', () => {
  const v = parseInt(goalInput.value, 10);
  if (!Number.isNaN(v) && v >= 0) {
    wordGoal = v;
    chrome.storage.local.set({ wordGoal: wordGoal });
    update();
  }
  dialog.hidden = true;
});

dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.hidden = true;
});

// --- Restore saved draft + goal ------------------------------------------
chrome.storage.local.get({ draft: '', wordGoal: 500 }, (data) => {
  wordGoal = typeof data.wordGoal === 'number' ? data.wordGoal : 500;
  editor.value = data.draft || '';
  update();
});
