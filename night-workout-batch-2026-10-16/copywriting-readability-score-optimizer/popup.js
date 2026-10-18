'use strict';

/* ---- Readability engine: Flesch Reading Ease + Flesch-Kincaid Grade (rule-based) ---- */

// Heuristic syllable counter: vowel groups, minus silent-e, min 1.
function countSyllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  // Collapse multi-vowel clusters pronounced as one syllable.
  w = w.replace(/eau|ough|iew|eigh/g, m => ({eau:'e',ough:'o',iew:'u',eigh:'a'})[m]);
  w = w.replace(/(?:[^laeiouy]e|ed|es)$/, '');// silent endings (before -ly merge)
  w = w.replace(/([aeiouy])ly$/, '$1');          // "-ely" rides the prior syllable
  w = w.replace(/^y/, '');                   // leading y is consonant
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function splitSentences(text) {
  const abbrev = /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|vs|etc|e\.g|i\.e)\.$/i;
  const parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/);
  const merged = [];
  for (const p of parts) {
    const last = merged[merged.length - 1];
    if (last && abbrev.test(last) && p.length < 60) {
      merged[merged.length - 1] = last + ' ' + p;
    } else {
      merged.push(p);
    }
  }
  return merged.map(s => s.trim()).filter(s => s.length > 0);
}

// Bundled long → short word swaps (heuristic suggestions, user applies them).
const WORD_SWAPS = [
  ['utilize', 'use'], ['facilitate', 'help'], ['approximately', '~'],
  ['nevertheless', 'but'], ['furthermore', 'also'], ['in order to', 'to'],
  ['due to the fact that', 'because'], ['at this point in time', 'now'],
  ['a large number of', 'many'], ['in the event that', 'if'],
  ['prior to', 'before'], ['subsequent to', 'after'], ['commence', 'start'],
  ['terminate', 'end'], ['demonstrate', 'show'], ['individual', 'person']
];

function analyze(text) {
  const sentences = splitSentences(text);
  const words = text.split(/\s+/).map(w => w.replace(/[^A-Za-z'-]/g, '')).filter(Boolean);
  const totalWords = words.length || 1;
  const totalSent = sentences.length || 1;
  const totalSyll = words.reduce((a, w) => a + countSyllables(w), 0) || 1;

  const asl = totalWords / totalSent;   // avg sentence length
  const asw = totalSyll / totalWords;   // avg syllables per word
  const ease = 206.835 - 1.015 * asl - 84.6 * asw;
  const grade = 0.39 * asl + 11.8 * asw - 15.59;

  const sentStats = sentences.map((s, i) => {
    const ws = s.split(/\s+/).filter(Boolean);
    const hardWords = ws.filter(w => countSyllables(w) >= 3).length;
    return {
      index: i + 1,
      text: s,
      words: ws.length,
      hardWords,
      hard: ws.length >= 25 || hardWords >= 6
    };
  });

  return { ease, grade, words: totalWords, sentences: totalSent, sentStats };
}

function verdictFor(ease) {
  if (ease >= 90) return 'Very easy — conversational';
  if (ease >= 80) return 'Easy — plain English';
  if (ease >= 70) return 'Fairly easy';
  if (ease >= 60) return 'Standard — plain English';
  if (ease >= 50) return 'Fairly difficult';
  if (ease >= 30) return 'Difficult — consider simplifying';
  return 'Very difficult — rewrite recommended';
}

/* ---- UI ---- */

const $ = id => document.getElementById(id);

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

$('score').addEventListener('click', () => {
  const text = $('input').value.trim();
  if (!text) {
    $('scores').classList.add('hidden');
    $('suggestions').innerHTML = '';
    $('sentences').innerHTML = '<div class="empty">Paste some copy first.</div>';
    return;
  }
  const r = analyze(text);

  const box = $('scores');
  box.classList.remove('hidden');
  box.innerHTML =
    `<div class="score-card"><div class="num">${r.ease.toFixed(1)}</div>
      <div class="lbl">Flesch Reading Ease</div>
      <div class="verdict">${esc(verdictFor(r.ease))}</div></div>
    <div class="score-card"><div class="num">${r.grade.toFixed(1)}</div>
      <div class="lbl">Flesch-Kincaid Grade</div>
      <div class="verdict">~US grade level</div></div>`;

  // Heuristic suggestions.
  const sugs = [];
  const avgLen = r.words / r.sentences;
  if (avgLen > 20) {
    sugs.push(`<b>Shorten sentences:</b> average is ${avgLen.toFixed(1)} words — aim for 15–20.`);
  }
  const swaps = WORD_SWAPS.filter(([long]) => text.toLowerCase().includes(long));
  if (swaps.length) {
    sugs.push(`<b>Simpler words:</b> ${swaps.slice(0, 6).map(([l, s2]) => `<code>${esc(l)}</code> → <code>${esc(s2)}</code>`).join(' · ')}`);
  }
  const hardCount = r.sentStats.filter(s => s.hard).length;
  if (hardCount) {
    sugs.push(`<b>${hardCount} hard sentence${hardCount > 1 ? 's' : ''}</b> flagged below — split or simplify them.`);
  }
  if (!sugs.length) {
    sugs.push('<b>Looks good.</b> No major heuristic flags — plain, readable copy.');
  }
  $('suggestions').innerHTML = sugs.map(s => `<div class="sug">✎ ${s}</div>`).join('');

  // Per-sentence cards.
  $('sentences').innerHTML = r.sentStats.map(s => {
    const cls = s.hard ? 'bad' : (s.words >= 20 ? 'warn' : 'ok');
    const label = s.hard ? 'Hard' : (s.words >= 20 ? 'Watch' : 'OK');
    return `<div class="card ${s.hard ? 'hard' : ''}">
      <div class="card-head">
        <span class="idx">#${s.index} · ${s.words} words · ${s.hardWords} long words</span>
        <span class="badge ${cls}">${label}</span>
      </div>
      <p class="sentence">${esc(s.text)}</p>
      ${s.hard ? '<div class="swaps">Tip: split into two shorter sentences or swap long words.</div>' : ''}
    </div>`;
  }).join('');
});
