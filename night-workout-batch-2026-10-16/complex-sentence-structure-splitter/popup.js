'use strict';

/* ---- Heuristic sentence analysis (rule-based, no AI) ---- */

// Common conjunctions/subordinators — good split candidates.
const CONJUNCTIONS = [
  'and', 'but', 'or', 'yet', 'so', 'for', 'nor',
  'although', 'though', 'however', 'because', 'since', 'while',
  'whereas', 'unless', 'until', 'after', 'before', 'when',
  'which', 'who', 'whom', 'whose', 'that', 'where', 'whenever'
];

// Split raw text into sentences (handles common abbreviations).
function splitSentences(text) {
  const abbrev = /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|vs|etc|e\.g|i\.e)\.$/i;
  const parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/);
  const merged = [];
  for (const p of parts) {
    const last = merged[merged.length - 1];
    if (last && abbrev.test(last) && p.length < 60) {
      merged[merged.length - 1] = last + ' ' + p; // abbreviation, not a boundary
    } else {
      merged.push(p);
    }
  }
  return merged.map(s => s.trim()).filter(s => s.length > 0);
}

// Rough clause estimate: conjunctions + semicolons + commas between clauses.
function estimateClauses(sentence) {
  const words = sentence.toLowerCase().split(/\s+/);
  let hits = 0;
  for (const w of words) {
    const clean = w.replace(/[^a-z']/g, '');
    if (CONJUNCTIONS.includes(clean)) hits++;
  }
  const semicolons = (sentence.match(/;/g) || []).length;
  return 1 + hits + semicolons;
}

// Find conjunction positions for split guidance.
function findSplitPoints(sentence) {
  const points = [];
  const re = new RegExp('\\b(' + CONJUNCTIONS.join('|') + ')\\b', 'gi');
  let m;
  while ((m = re.exec(sentence)) !== null) {
    points.push({ word: m[0], index: m.index });
  }
  return points.slice(0, 6);
}

function analyze(text, threshold) {
  const sentences = splitSentences(text);
  return sentences.map((s, i) => {
    const wordCount = s.split(/\s+/).filter(Boolean).length;
    return {
      index: i + 1,
      text: s,
      wordCount,
      clauses: estimateClauses(s),
      flagged: wordCount > threshold,
      splitPoints: wordCount > threshold ? findSplitPoints(s) : []
    };
  });
}

function guidanceFor(item) {
  const tips = [];
  if (item.splitPoints.length) {
    const words = item.splitPoints.slice(0, 3).map(p => `"${p.word}"`).join(', ');
    tips.push(`Try splitting near ${words} — each part should stand alone as one idea.`);
  } else {
    tips.push('No clear conjunction found — try splitting after the main verb phrase or at a semicolon.');
  }
  if (item.clauses >= 4) {
    tips.push(`~${item.clauses} estimated clauses: aim for 1–2 ideas per sentence.`);
  }
  return tips;
}

/* ---- UI ---- */

const $ = id => document.getElementById(id);

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function render(results) {
  const summary = $('summary');
  const flagged = results.filter(r => r.flagged);
  summary.classList.remove('hidden');
  summary.innerHTML =
    `<span class="pill"><b>${results.length}</b> sentences</span>` +
    `<span class="pill ${flagged.length ? 'bad' : ''}"><b>${flagged.length}</b> flagged</span>`;

  const box = $('results');
  if (!results.length) {
    box.innerHTML = '<div class="empty">No sentences found. Paste some text above.</div>';
    return;
  }
  box.innerHTML = results.map(r => {
    const guides = r.flagged ? guidanceFor(r) : [];
    return `<div class="card ${r.flagged ? 'flagged' : ''}">
      <div class="card-head">
        <span class="idx">#${r.index} · ${r.wordCount} words · ~${r.clauses} clauses</span>
        <span class="badge ${r.flagged ? 'bad' : 'ok'}">${r.flagged ? 'Split candidate' : 'OK'}</span>
      </div>
      <p class="sentence">${esc(r.text)}</p>
      ${r.flagged && r.splitPoints.length ? `<div class="clauses">${r.splitPoints.map(p => `<span class="clause">split near "${esc(p.word)}"</span>`).join('')}</div>` : ''}
      ${guides.length ? `<div class="guide">${guides.map(g => `<div>✂ ${esc(g)}</div>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
}

$('scan').addEventListener('click', () => {
  const text = $('input').value.trim();
  const threshold = Math.max(10, Math.min(60, parseInt($('threshold').value, 10) || 25));
  if (!text) {
    $('summary').classList.add('hidden');
    $('results').innerHTML = '<div class="empty">Paste some text first.</div>';
    return;
  }
  render(analyze(text, threshold));
  chrome.storage.local.set({ ssh_last_threshold: threshold }).catch(() => {});
});

// Restore saved threshold.
chrome.storage.local.get('ssh_last_threshold').then(s => {
  if (s.ssh_last_threshold) $('threshold').value = s.ssh_last_threshold;
}).catch(() => {});
