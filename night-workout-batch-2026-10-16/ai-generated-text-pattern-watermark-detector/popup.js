/* AI Text Signals — heuristic pattern scanner (popup logic) */
'use strict';

// ENGINE-START
// Pure text-analysis engine — headless-testable, no DOM or chrome APIs.

/** Generic filler transitions often overused by LLM drafts. */
const GENERIC_TRANSITIONS = [
  'furthermore', 'moreover', 'in conclusion', 'in summary',
  'it is important to note', 'it is worth noting', 'additionally',
  'in today\'s fast-paced world', 'delve', 'tapestry', 'landscape',
  'moreover', 'nevertheless',
];

/** Split text into sentences (roughly) and words. */
function tokenize(text) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return { sentences: [], words: [] };
  const sentences = clean.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const words = clean.toLowerCase().replace(/[^a-z0-9'\s-]/g, '').split(/\s+/).filter(Boolean);
  return { sentences, words };
}

/**
 * Burstiness: std-dev of sentence lengths / mean sentence length.
 * Low burstiness (< 0.5) is a known heuristic AI signal.
 */
function burstiness(sentences) {
  const lens = sentences.map((s) => s.split(/\s+/).filter(Boolean).length).filter((n) => n > 0);
  if (lens.length < 3) return null;
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance = lens.reduce((a, b) => a + (b - mean) * (b - mean), 0) / lens.length;
  return Math.sqrt(variance) / mean;
}

/** Fraction of sentences sharing the most common 3-word opener. */
function openerRepetition(sentences) {
  if (sentences.length < 4) return 0;
  const counts = {};
  sentences.forEach((s) => {
    const opener = s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).slice(0, 3).join(' ');
    if (opener) counts[opener] = (counts[opener] || 0) + 1;
  });
  const max = Math.max(...Object.values(counts));
  return max / sentences.length;
}

/** Count generic-transition hits per 100 words. */
function transitionDensity(words) {
  if (words.length < 10) return 0;
  const text = words.join(' ');
  let hits = 0;
  GENERIC_TRANSITIONS.forEach((t) => {
    const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const m = text.match(re);
    if (m) hits += m.length;
  });
  return (hits / words.length) * 100;
}

/** Type-token ratio: unique words / total words (low = repetitive). */
function typeTokenRatio(words) {
  if (words.length < 20) return null;
  return new Set(words).size / words.length;
}

/**
 * Score text 0–100 with per-signal breakdown.
 * Returns { score, verdict, wordCount, sentenceCount, burst, signals[] }.
 * Null for < 20 words (too short to score honestly).
 */
function scanText(text) {
  const { sentences, words } = tokenize(text);
  if (words.length < 20) return null;

  const burst = burstiness(sentences);
  const rep = openerRepetition(sentences);
  const trans = transitionDensity(words);
  const ttr = typeTokenRatio(words);

  const signals = [];
  let score = 0;

  // Repetitive phrasing: most common opener appears often.
  let repPts = 0;
  if (rep >= 0.5) repPts = 35;
  else if (rep >= 0.3) repPts = 20;
  else if (rep >= 0.2) repPts = 10;
  signals.push({
    name: 'Repetitive phrasing',
    points: repPts,
    detail: repPts > 0
      ? `Most common sentence opener repeats in ${Math.round(rep * 100)}% of sentences.`
      : 'Sentence openers are reasonably varied.',
  });
  score += repPts;

  // Low burstiness.
  let burstPts = 0;
  if (burst !== null) {
    if (burst < 0.35) burstPts = 30;
    else if (burst < 0.5) burstPts = 18;
    else if (burst < 0.65) burstPts = 8;
    signals.push({
      name: 'Low burstiness',
      points: burstPts,
      detail: `Sentence-length variation (CV) is ${burst.toFixed(2)} — ${burst < 0.5 ? 'unusually uniform' : 'within a normal range'}.`,
    });
    score += burstPts;
  }

  // Generic transitions.
  let transPts = 0;
  if (trans >= 4) transPts = 25;
  else if (trans >= 2) transPts = 15;
  else if (trans >= 1) transPts = 7;
  signals.push({
    name: 'Generic transitions',
    points: transPts,
    detail: transPts > 0
      ? `Filler transitions appear ${trans.toFixed(1)}× per 100 words.`
      : 'Few generic filler transitions found.',
  });
  score += transPts;

  // Low vocabulary diversity.
  let ttrPts = 0;
  if (ttr !== null) {
    if (ttr < 0.35) ttrPts = 10;
    else if (ttr < 0.45) ttrPts = 5;
    signals.push({
      name: 'Repetitive vocabulary',
      points: ttrPts,
      detail: `Type-token ratio ${ttr.toFixed(2)} — ${ttr < 0.45 ? 'below typical human range' : 'within a normal range'}.`,
    });
    score += ttrPts;
  }

  score = Math.min(100, score);
  const verdict = score >= 70 ? 'Many AI-typical signals — but not proof'
    : score >= 45 ? 'Several AI-typical signals present'
    : score >= 25 ? 'A few AI-typical signals'
    : 'Few AI-typical signals';

  return {
    score,
    verdict,
    wordCount: words.length,
    sentenceCount: sentences.length,
    burst,
    signals,
  };
}
// ENGINE-END

/* ---------------- popup wiring ---------------- */

const textIn = document.getElementById('textIn');
const resultEl = document.getElementById('result');

document.getElementById('scanBtn').addEventListener('click', () => {
  const text = textIn.value;
  const r = scanText(text);
  if (!r) {
    alert('Please paste at least 20 words — shorter text cannot be scored honestly.');
    return;
  }
  resultEl.classList.remove('hidden');
  document.getElementById('scoreNum').textContent = r.score;
  document.getElementById('verdict').textContent = r.verdict;
  document.getElementById('statWords').textContent = r.wordCount;
  document.getElementById('statSents').textContent = r.sentenceCount;
  document.getElementById('statBurst').textContent = r.burst === null ? '—' : r.burst.toFixed(2);
  const sigEl = document.getElementById('signals');
  sigEl.innerHTML = '';
  r.signals.forEach((s) => {
    const div = document.createElement('div');
    div.className = 'signal';
    const head = document.createElement('div');
    head.className = 's-head';
    const name = document.createElement('span');
    name.textContent = s.name;
    const pts = document.createElement('b');
    pts.textContent = '+' + s.points;
    head.append(name, pts);
    const p = document.createElement('p');
    p.textContent = s.detail;
    div.append(head, p);
    sigEl.appendChild(div);
  });
  chrome.storage.local.set({ aits_last: text.slice(0, 5000) });
});

document.getElementById('clearBtn').addEventListener('click', () => {
  textIn.value = '';
  resultEl.classList.add('hidden');
  chrome.storage.local.remove('aits_last');
});

chrome.storage.local.get({ aits_last: '' }, (res) => {
  if (res.aits_last) textIn.value = res.aits_last;
});
