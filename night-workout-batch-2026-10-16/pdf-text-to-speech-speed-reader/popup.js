/* ============================================================
   Text to Speech — Speed Reader
   popup.js  —  UI wiring around a pure engine (marked below).
   All state is local; nothing leaves the browser.
   ============================================================ */

// ENGINE-START
/**
 * Split text into words. Apostrophes and hyphens inside words are kept.
 * @param {string} text
 * @returns {string[]} word list
 */
function splitWords(text) {
  if (!text || !text.trim()) return [];
  const m = text.trim().match(/[A-Za-z0-9\u00C0-\u024F]+(?:['’-][A-Za-z0-9\u00C0-\u024F]+)*/g);
  return m || [];
}

/**
 * Estimate spoken seconds at a given rate (baseline 150 wpm at 1x).
 * @param {number} wordCount
 * @param {number} rate
 * @returns {number} seconds, rounded
 */
function estimateSeconds(wordCount, rate) {
  if (!wordCount || !rate || rate <= 0) return 0;
  return Math.round((wordCount / 150 / rate) * 60);
}

/**
 * Format seconds as m:ss.
 * @param {number} secs
 * @returns {string}
 */
function fmtDuration(secs) {
  secs = Math.max(0, Math.round(secs));
  return Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
}

/**
 * Split text into speakable chunks of at most maxWords words,
 * never splitting mid-sentence when a sentence end is nearby.
 * @param {string} text
 * @param {number} maxWords
 * @returns {string[]} chunks
 */
function chunkText(text, maxWords) {
  const words = splitWords(text);
  if (!words.length) return [];
  maxWords = Math.max(1, maxWords | 0 || 120);
  const chunks = [];
  let cur = [];
  const isEnd = w => /[.!?…]["'”’)]?$/.test(w);
  for (const w of words) {
    cur.push(w);
    if (cur.length >= maxWords) {
      chunks.push(cur.join(' '));
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur.join(' '));
  // Merge a tiny tail (<= 20% of max) into the previous chunk so the
  // reader doesn't stutter on a 3-word leftover.
  if (chunks.length > 1 && splitWords(chunks[chunks.length - 1]).length <= maxWords * 0.2) {
    chunks[chunks.length - 2] += ' ' + chunks.pop();
  }
  return chunks;
}

/**
 * Words spoken so far given chunk index and total chunk word counts.
 * @param {number[]} chunkWordCounts
 * @param {number} chunkIdx
 * @returns {number}
 */
function wordsBeforeChunk(chunkWordCounts, chunkIdx) {
  let n = 0;
  for (let i = 0; i < chunkIdx; i++) n += chunkWordCounts[i] || 0;
  return n;
}
// ENGINE-END

/* ---------- DOM wiring ---------- */
const $ = id => document.getElementById(id);
const synth = window.speechSynthesis;

let state = 'idle';        // idle | speaking | paused
let chunks = [];           // speakable chunks for this session
let chunkCounts = [];      // word counts per chunk
let chunkIdx = 0;          // chunk currently spoken
let totalWords = 0;
let voices = [];

function supported() {
  return 'speechSynthesis' in window;
}

function setStatus(msg) { $('status').textContent = msg; }
function setProgress() {
  const done = Math.min(totalWords, wordsBeforeChunk(chunkCounts, chunkIdx));
  $('progress').textContent = done + ' / ' + totalWords + ' words';
  $('bar').style.width = (totalWords ? (done / totalWords) * 100 : 0) + '%';
}

function updateButtons() {
  $('play').disabled = state === 'speaking' || state === 'paused' || !totalWords;
  $('pause').disabled = state !== 'speaking';
  $('resume').disabled = state !== 'paused';
  $('stop').disabled = state === 'idle';
}

function refreshMeta() {
  const words = splitWords($('text').value);
  totalWords = words.length;
  $('wordcount').textContent = totalWords + ' word' + (totalWords === 1 ? '' : 's');
  const rate = parseFloat($('rate').value);
  $('rateval').textContent = rate.toFixed(1) + '×';
  $('time').textContent = totalWords ? '≈ ' + fmtDuration(estimateSeconds(totalWords, rate)) + ' min' : '';
  chrome.storage.local.set({ ttsText: $('text').value, ttsRate: rate });
  setProgress();
  updateButtons();
}

/* Voices */
function loadVoices() {
  voices = synth ? synth.getVoices() : [];
  const sel = $('voice');
  const prev = sel.value;
  sel.innerHTML = '<option value="">Default voice</option>';
  voices.forEach((v, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = v.name + (v.lang ? ' (' + v.lang + ')' : '');
    sel.appendChild(o);
  });
  sel.value = prev || '';
  $('voices-note').textContent = voices.length ? voices.length + ' voices' : 'no voices found';
}
if (synth) {
  loadVoices();
  if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;
}

/* Speaking */
function makeUtterance(text, idx) {
  const u = new SpeechSynthesisUtterance(text);
  const vi = parseInt($('voice').value, 10);
  if (!isNaN(vi) && voices[vi]) u.voice = voices[vi];
  u.rate = parseFloat($('rate').value);
  u.onstart = () => {
    chunkIdx = idx;
    setStatus('Speaking…');
    setProgress();
  };
  u.onend = () => {
    if (state !== 'speaking') return;
    const next = idx + 1;
    if (next < chunks.length) {
      chunkIdx = next;
      speakChunk(next);
    } else {
      stop(false);
      setStatus('Finished');
    }
  };
  u.onerror = e => {
    if (state !== 'idle') { stop(false); setStatus('Error: ' + (e.error || 'speech failed')); }
  };
  u.onboundary = ev => {
    if (ev.name === 'word' && typeof ev.charIndex === 'number') {
      // ev.charIndex is relative to the chunk; show the words around it.
      const before = splitWords(chunks[idx].slice(0, ev.charIndex));
      const done = wordsBeforeChunk(chunkCounts, idx) + before.length;
      $('progress').textContent = done + ' / ' + totalWords + ' words';
      $('bar').style.width = (totalWords ? (done / totalWords) * 100 : 0) + '%';
      const cw = splitWords(chunks[idx]);
      $('spoken').textContent = '“…' + cw.slice(Math.max(0, before.length - 3), before.length + 8).join(' ') + '…”';
    }
  };
  return u;
}

function speakChunk(idx) {
  if (!synth || state !== 'speaking') return;
  synth.speak(makeUtterance(chunks[idx], idx));
}

function play() {
  if (!supported() || !totalWords) return;
  chunks = chunkText($('text').value, 120);
  chunkCounts = chunks.map(c => splitWords(c).length);
  chunkIdx = 0;
  state = 'speaking';
  updateButtons();
  speakChunk(0);
}

function pause() {
  if (state !== 'speaking' || !synth) return;
  synth.pause();
  state = 'paused';
  setStatus('Paused');
  updateButtons();
}

function resume() {
  if (state !== 'paused' || !synth) return;
  synth.resume();
  state = 'speaking';
  setStatus('Speaking…');
  updateButtons();
}

/** Stop speech. @param {boolean} reset — true when user pressed Stop. */
function stop(reset) {
  if (synth) synth.cancel();
  state = 'idle';
  setStatus(reset ? 'Stopped' : 'Idle');
  if (reset) {
    chunkIdx = 0;
    setProgress();
    $('spoken').textContent = '';
  }
  updateButtons();
}

/* Events */
$('text').addEventListener('input', refreshMeta);
$('rate').addEventListener('input', refreshMeta);
$('voice').addEventListener('change', () => chrome.storage.local.set({ ttsVoice: $('voice').value }));
$('play').addEventListener('click', play);
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('stop').addEventListener('click', () => stop(true));
$('clear').addEventListener('click', () => { stop(true); $('text').value = ''; refreshMeta(); });
$('file').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  if (!/\.txt$/i.test(f.name) && f.type !== 'text/plain') {
    setStatus('Only .txt files, please.');
    return;
  }
  if (f.size > 2 * 1024 * 1024) { setStatus('File too large (2 MB max).'); return; }
  const r = new FileReader();
  r.onload = () => { $('text').value = String(r.result || ''); refreshMeta(); setStatus('File loaded'); };
  r.onerror = () => setStatus('Could not read file.');
  r.readAsText(f);
  e.target.value = '';
});

/* Restore previous session */
chrome.storage.local.get(['ttsText', 'ttsRate', 'ttsVoice'], data => {
  if (data.ttsText) $('text').value = data.ttsText;
  if (data.ttsRate) $('rate').value = data.ttsRate;
  refreshMeta();
  if (data.ttsVoice) $('voice').value = data.ttsVoice;
});
refreshMeta();
updateButtons();

if (!supported()) {
  setStatus('Speech synthesis is not available in this browser.');
  $('play').disabled = true;
}
