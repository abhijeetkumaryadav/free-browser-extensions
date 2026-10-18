/* Passive Pattern Flagger — heuristic passive-voice pattern detection.
 * Heuristic only: no AI, no rewriting. Flags are suggestions. */

// Be-verb + past-participle-ish patterns, plus a few classic constructions.
const BE_VERBS = ['is','are','was','were','be','been','being','am'];
// Common irregular past participles (heuristic list).
const IRREGULAR_PP = new Set(('written|taken|given|shown|known|seen|done|made|gone|come|' +
  'spoken|broken|chosen|driven|eaten|fallen|forgotten|frozen|hidden|ridden|' +
  'risen|shaken|stolen|sworn|torn|worn|built|bought|brought|caught|dealt|' +
  'dreamt|felt|fought|found|had|heard|held|kept|laid|led|learnt|left|lent|' +
  'lost|meant|paid|said|sent|set|shut|sold|spent|stood|told|thought|understood|' +
  'woken|begun|drunk|rung|sung|sunk|swum|grown|flown|drawn|proven|striven|' +
  'thrown|torn|arisen|awoken').split('|'));

/** Split text into sentences (simple). */
function sentences(text) {
  return text.match(/[^.!?]+[.!?]+["')\]]?\s*/g) || (text.trim() ? [text] : []);
}

/** Heuristic: word looks like a past participle. */
function looksLikePP(word) {
  const w = word.toLowerCase();
  if (IRREGULAR_PP.has(w)) return true;
  return /(ed|en)$/.test(w) && w.length > 3;
}

/** Find passive patterns in one sentence. Returns [{match, start, why}]. */
function findInSentence(sent) {
  const hits = [];
  const words = sent.match(/[A-Za-z']+|[^A-Za-z'\s]/g) || [];
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i].toLowerCase();
    if (!BE_VERBS.includes(w)) continue;
    // look at next 1-3 words (skip adverbs like "quickly", "also")
    for (let j = i + 1; j <= Math.min(i + 3, words.length - 1); j++) {
      const cand = words[j];
      if (!/^[A-Za-z']+$/.test(cand)) break;
      if (looksLikePP(cand) && !BE_VERBS.includes(cand.toLowerCase())) {
        const match = words.slice(i, j + 1).join(' ');
        hits.push({ match, why: `"${match}" — be-verb + past-participle pattern.` });
        break;
      }
      // stop at another verb-ish boundary; allow small adverbs only
      if (/(ly)$/.test(cand.toLowerCase()) || ['also','just','already','now'].includes(cand.toLowerCase())) continue;
      break;
    }
  }
  // "get/gets/got + past participle" is often passive-adjacent ("got fired")
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i].toLowerCase();
    if (!['get','gets','got','getting'].includes(w)) continue;
    const cand = words[i + 1];
    if (cand && /^[A-Za-z']+$/.test(cand) && looksLikePP(cand)) {
      const match = w + ' ' + cand;
      hits.push({ match, why: `"${match}" — "get" + participle is often passive ("got fired").` });
    }
  }
  // "by" phrases after a passive-like verb
  const byMatch = sent.match(/\b(was|were|is|are|been|being)\b[^.!?]{0,60}\bby\b/i);
  if (byMatch && !hits.some(h => h.match.toLowerCase() === byMatch[0].trim().toLowerCase())) {
    hits.push({ match: byMatch[0].trim(), why: 'Contains "by …" naming the doer — strong passive signal.' });
  }
  return hits;
}

function esc(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

const $ = id => document.getElementById(id);

$('scan').addEventListener('click', () => {
  const text = $('input').value.trim();
  const flagsBox = $('flags');
  const summary = $('summary');
  flagsBox.innerHTML = '';
  if (!text) {
    summary.classList.add('hidden');
    flagsBox.innerHTML = '<div class="empty">Paste some text first.</div>';
    return;
  }
  const flags = [];
  for (const s of sentences(text)) {
    for (const h of findInSentence(s)) {
      flags.push({ ...h, ctx: s.trim().slice(0, 160) });
    }
  }
  summary.classList.remove('hidden');
  if (flags.length === 0) {
    summary.innerHTML = '<b>0</b> passive patterns found. Clean copy — or the text is too short to judge.';
    flagsBox.innerHTML = '<div class="empty">No passive patterns detected. (Heuristics only — re-read anyway.)</div>';
  } else {
    summary.innerHTML = `<b>${flags.length}</b> possible passive pattern${flags.length > 1 ? 's' : ''} found.`;
    flagsBox.innerHTML = flags.map(f =>
      `<div class="flag"><div class="match">${esc(f.match)}</div>` +
      `<div class="why">${esc(f.why)}</div>` +
      `<div class="ctx">…${esc(f.ctx)}…</div></div>`
    ).join('');
  }
  chrome.storage.local.set({ lastScan: { at: Date.now(), count: flags.length } });
});

$('clear').addEventListener('click', () => {
  $('input').value = '';
  $('flags').innerHTML = '';
  $('summary').classList.add('hidden');
});

// Restore draft text between popup opens.
chrome.storage.local.get(['draft'], r => { if (r.draft) $('input').value = r.draft; });
$('input').addEventListener('input', e => chrome.storage.local.set({ draft: e.target.value }));

// Self-test (runs in popup, logs only).
(function selfTest() {
  const t = 'The report was written by Ana. It got approved quickly. She runs the team.';
  const n = sentences(t).reduce((a, s) => a + findInSentence(s).length, 0);
  console.log('[passive-flagger] self-test matches:', n, n >= 2 ? 'PASS' : 'FAIL');
})();
