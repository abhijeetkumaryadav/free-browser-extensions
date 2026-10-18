'use strict';
/* Word Cloud — comment frequency visualizer.
 * Pure word-frequency counting. No sentiment AI, no network.
 * Engine functions live between ENGINE-START / ENGINE-END so they can be
 * headless-tested in Node. */

// ============================ ENGINE-START ============================
/** Common stopwords excluded from the cloud. */
const STOPWORDS = new Set([
  'a','an','the','and','or','but','if','then','else','for','nor','so','yet',
  'at','by','from','in','into','of','off','on','onto','out','over','to','up',
  'with','as','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','can','could','should','may','might','must',
  'shall','i','me','my','we','our','you','your','he','him','his','she','her',
  'it','its','they','them','their','this','that','these','those','am','not',
  'no','yes','just','very','too','also','than','there','here','what','when',
  'where','which','who','whom','how','why','all','any','both','each','few',
  'more','most','other','some','such','own','same','once','re','ve','ll','don',
  'didn','doesn','isn','aren','wasn','weren','hasn','haven','hadn','won','wouldn',
  'shouldn','couldn','mustn','let','im','its','got','get','go','going','went'
]);

/**
 * Tokenize comment text into lowercase words.
 * @param {string} text
 * @returns {string[]} words
 */
function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')     // drop URLs
    .replace(/[^a-z0-9'\s]/g, ' ')       // keep letters, digits, apostrophes
    .split(/\s+/)
    .map(w => w.replace(/^'+|'+$/g, '')) // trim stray apostrophes
    .filter(Boolean);
}

/**
 * Build a frequency map of non-stopword tokens.
 * @param {string} text
 * @param {object} [opts]
 * @param {number} [opts.minLen=3] minimum word length
 * @returns {Map<string,number>}
 */
function wordFrequencies(text, opts = {}) {
  const minLen = Number.isFinite(opts.minLen) ? opts.minLen : 3;
  const freq = new Map();
  for (const w of tokenize(text)) {
    if (w.length < minLen) continue;
    if (STOPWORDS.has(w)) continue;
    if (/^\d+$/.test(w)) continue; // pure numbers carry no meaning here
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return freq;
}

/**
 * Return the top N words as [{word, count}] sorted by count desc, then word.
 * @param {Map<string,number>} freq
 * @param {number} n
 * @returns {{word:string,count:number}[]}
 */
function topWords(freq, n) {
  return [...freq.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || (a.word < b.word ? -1 : 1))
    .slice(0, Math.max(0, n | 0));
}

/**
 * Map a word count to a canvas font size.
 * @param {number} count
 * @param {number} maxCount
 * @param {number} [minPx=10]
 * @param {number} [maxPx=44]
 * @returns {number}
 */
function sizeForCount(count, maxCount, minPx = 10, maxPx = 44) {
  if (!maxCount || maxCount <= 0) return minPx;
  const t = Math.sqrt(Math.max(0, count)) / Math.sqrt(maxCount);
  return Math.round(minPx + (maxPx - minPx) * t);
}
// ============================= ENGINE-END =============================

/* ------------------------------ UI logic ------------------------------ */
const $ = id => document.getElementById(id);
const els = {};
let lastLayout = [];

document.addEventListener('DOMContentLoaded', () => {
  ['comments','minlen','build','stats','toplist','cloud','shuffle','download','notes']
    .forEach(id => { els[id] = $(id); });

  // Tabs
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => { p.hidden = true; });
      btn.classList.add('active');
      document.querySelector(`[data-panel="${btn.dataset.tab}"]`).hidden = false;
    });
  });

  // Restore saved state
  chrome.storage.local.get(['wc_comments','wc_minlen','wc_notes'], res => {
    if (res.wc_comments) els.comments.value = res.wc_comments;
    if (typeof res.wc_minlen === 'boolean') els.minlen.checked = res.wc_minlen;
    if (res.wc_notes) els.notes.value = res.wc_notes;
    if (res.wc_comments) buildCloud();
  });
  let noteTimer = null;
  els.notes.addEventListener('input', () => {
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => chrome.storage.local.set({ wc_notes: els.notes.value }), 400);
  });

  els.build.addEventListener('click', () => {
    buildCloud();
    chrome.storage.local.set({ wc_comments: els.comments.value, wc_minlen: els.minlen.checked });
  });
  els.shuffle.addEventListener('click', () => { if (lastLayout.length) drawCloud(lastLayout, true); });
  els.download.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = els.cloud.toDataURL('image/png');
    a.download = 'word-cloud.png';
    a.click();
  });
});

function buildCloud() {
  const text = els.comments.value || '';
  const minLen = els.minlen.checked ? 3 : 1;
  const freq = wordFrequencies(text, { minLen });
  const top = topWords(freq, 60);
  const total = [...freq.values()].reduce((a, b) => a + b, 0);

  els.stats.hidden = false;
  els.stats.innerHTML = `<b>${total}</b> counted words · <b>${freq.size}</b> unique · <b>${top.length}</b> shown`;

  els.toplist.innerHTML = '';
  for (const { word, count } of topWords(freq, 15)) {
    const li = document.createElement('li');
    const w = document.createElement('span'); w.textContent = word;
    const n = document.createElement('span'); n.className = 'n'; n.textContent = count;
    li.append(w, n);
    els.toplist.append(li);
  }

  lastLayout = top;
  drawCloud(top, true);
}

function drawCloud(words, reshuffle) {
  const canvas = els.cloud;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!words.length) {
    ctx.fillStyle = '#9aa0b4';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Paste some comments and press "Build cloud".', W / 2, H / 2);
    return;
  }
  const maxCount = words[0].count;
  const cx = W / 2, cy = H / 2;
  // Golden-angle spiral placement so layout is deterministic yet spread out.
  const placed = [];
  const angle = Math.PI * (3 - Math.sqrt(5));
  words.forEach((item, i) => {
    const px = sizeForCount(item.count, maxCount);
    ctx.font = `700 ${px}px sans-serif`;
    const tw = ctx.measureText(item.word).width;
    const r = 6 * Math.sqrt(i) + px * 0.6;
    const a = i * angle + (reshuffle ? Math.random() * 0.6 : 0);
    let x = cx + r * Math.cos(a) - tw / 2;
    let y = cy + r * Math.sin(a);
    // Clamp inside canvas with a small margin.
    x = Math.max(4, Math.min(W - tw - 4, x));
    y = Math.max(px + 4, Math.min(H - 6, y));
    placed.push({ item, x, y, px });
  });
  const accent = [34, 211, 238];
  placed.forEach(({ item, x, y, px }, i) => {
    const t = 1 - i / Math.max(1, placed.length);
    ctx.font = `700 ${px}px sans-serif`;
    ctx.fillStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},${0.45 + 0.55 * t})`;
    ctx.fillText(item.word, x, y);
  });
  // Switch to the cloud tab so the user sees the result.
  document.querySelector('[data-tab="cloud"]').click();
}
