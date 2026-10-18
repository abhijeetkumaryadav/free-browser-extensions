/* ToneShift — rule-based sentiment scoring + template tone rewrites.
 * Everything here is a hand-written word list and regex swap. NOT AI:
 * sarcasm, idioms and context routinely defeat lexicon scoring. */

'use strict';

/* ------------------------------------------------------------------ */
/* Sentiment lexicon (word -> weight: +1 positive, -1 negative)       */
/* ------------------------------------------------------------------ */
const POSITIVE = new Set(
  'amazing awesome excellent great good fantastic wonderful lovely perfect love loved like liked enjoy enjoyed happy happiness joy delighted thrilled grateful thankful brilliant superb outstanding incredible nice kind kindness helpful success successful win winner beautiful gorgeous cool exciting inspired inspiring proud confident strong powerful easy smooth fast reliable safe trust honest clear smart clever generous friendly fun hilarious comfortable calm peaceful relaxed fresh clean bright hope hopeful optimistic better best favorite favorite favourite'
    .split(' ')
);

const NEGATIVE = new Set(
  'terrible awful horrible bad poor worst hate hated hate dislike disliked disgusting gross ugly stupid dumb idiotic foolish sad sadness angry anger furious rage frustrated frustrating annoying irritating upset worried worry anxious anxiety fear afraid scared afraid dread dreadful painful pain hurt hurting broken fail failed failure loser lost lose problem problems issue issues bug buggy crash crashed slow broken late delay wrong mistake error errors sorry disappointed disappointing boring bored tired exhausted exhausted stress stressful stressful panic chaos messy dirty dark ugly greedy rude cruel mean selfish lazy weak sick illness death kill murdered trash garbage junk scam fraud fake false lie lied lies cheat cheated betray betrayed lonely alone hopeless despair regret guilt shame embarras embarrassed nasty vile toxic poison poisoned disaster catastrophic ruin ruined destroy destroyed damage damaged expensive costly cheap'
    .split(' ')
);

/* Simple negation words that flip the next sentiment word's polarity. */
const NEGATORS = new Set(['not', 'no', 'never', 'none', 'nobody', 'nothing', 'nowhere', 'neither', 'nor', "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "can't", "couldn't", "shouldn't", "won't", "wouldn't", 'cannot', 'hardly', 'barely', 'scarcely']);

/* Intensifiers multiply the following sentiment word's weight. */
const INTENSIFIERS = { very: 1.5, really: 1.5, so: 1.5, extremely: 2, incredibly: 2, highly: 1.5, super: 1.8, quite: 1.3, fairly: 1.2, too: 1.3, absolutely: 2, totally: 1.7, completely: 1.7, utterly: 2 };

/**
 * Score text with a negator/intensifier-aware lexicon scan.
 * Returns { score (-100..100), verdict, pos, neg, neu, tokens[] } where
 * tokens = [{ word, cls: 'w-pos'|'w-neg'|'w-neu'|'w-flip' }] for highlighting.
 */
function analyzeSentiment(text) {
  const rawTokens = text.match(/[A-Za-z']+|[^\sA-Za-z']+/g) || [];
  let rawScore = 0;
  let pos = 0, neg = 0, neu = 0;
  let pendingNegation = false;
  let pendingBoost = 1;
  const tokens = [];

  for (const raw of rawTokens) {
    if (!/[A-Za-z]/.test(raw)) { tokens.push({ word: raw, cls: 'w-neu' }); continue; }
    const w = raw.toLowerCase();
    if (NEGATORS.has(w)) { pendingNegation = !pendingNegation; tokens.push({ word: raw, cls: 'w-neu' }); continue; }
    if (INTENSIFIERS[w]) { pendingBoost = INTENSIFIERS[w]; tokens.push({ word: raw, cls: 'w-neu' }); continue; }
    if (/^(and|or|but|the|a|an|to|of|in|on|for|with|is|are|was|were|be|been|it|this|that|i|you|we|they|he|she|my|your|our|their)$/.test(w)) {
      pendingNegation = false; pendingBoost = 1; tokens.push({ word: raw, cls: 'w-neu' }); continue;
    }
    let cls = 'w-neu';
    let wScore = 0;
    if (POSITIVE.has(w)) { wScore = 1; pos++; cls = 'w-pos'; }
    else if (NEGATIVE.has(w)) { wScore = -1; neg++; cls = 'w-neg'; }
    else { neu++; }
    if (wScore !== 0) {
      if (pendingNegation) {
        wScore = -wScore;
        cls = cls === 'w-pos' ? 'w-neg' : 'w-pos';
        cls += ' w-flip'; // dotted underline = flipped by negation
        pendingNegation = false;
      }
      rawScore += wScore * pendingBoost;
      pendingBoost = 1;
    }
    tokens.push({ word: raw, cls });
  }

  const sentimentWords = pos + neg;
  // Normalize to -100..100 based on average polarity per sentiment word.
  const score = sentimentWords === 0 ? 0 : Math.max(-100, Math.min(100, Math.round((rawScore / sentimentWords) * 100)));
  const verdict = score >= 25 ? 'Positive' : score <= -25 ? 'Negative' : 'Neutral';
  return { score, verdict, pos, neg, neu, tokens };
}

/* ------------------------------------------------------------------ */
/* Template tone rewrites: curated regex swaps, applied in order.      */
/* Each entry: [pattern, replacement]. Case handled by flags.          */
/* ------------------------------------------------------------------ */
const CONTRACTIONS = [
  [/\bdo not\b/gi, "don't"], [/\bcannot\b/gi, "can't"], [/\bwill not\b/gi, "won't"],
  [/\bwould not\b/gi, "wouldn't"], [/\bshould not\b/gi, "shouldn't"], [/\bcould not\b/gi, "couldn't"],
  [/\bdid not\b/gi, "didn't"], [/\bdoes not\b/gi, "doesn't"], [/\bis not\b/gi, "isn't"],
  [/\bare not\b/gi, "aren't"], [/\bwas not\b/gi, "wasn't"], [/\bwere not\b/gi, "weren't"],
  [/\bhave not\b/gi, "haven't"], [/\bhas not\b/gi, "hasn't"], [/\bhad not\b/gi, "hadn't"],
  [/\bit is\b/gi, "it's"], [/\bthat is\b/gi, "that's"], [/\bthere is\b/gi, "there's"],
  [/\byou are\b/gi, "you're"], [/\bwe are\b/gi, "we're"], [/\bthey are\b/gi, "they're"],
  [/\bi am\b/gi, "I'm"], [/\blet us\b/gi, "let's"], [/\bi will\b/gi, "I'll"],
];

const EXPANSIONS = [
  [/\bdon't\b/gi, 'do not'], [/\bcan't\b/gi, 'cannot'], [/\bwon't\b/gi, 'will not'],
  [/\bwouldn't\b/gi, 'would not'], [/\bshouldn't\b/gi, 'should not'], [/\bcouldn't\b/gi, 'could not'],
  [/\bdidn't\b/gi, 'did not'], [/\bdoesn't\b/gi, 'does not'], [/\bisn't\b/gi, 'is not'],
  [/\baren't\b/gi, 'are not'], [/\bwasn't\b/gi, 'was not'], [/\bweren't\b/gi, 'were not'],
  [/\bhaven't\b/gi, 'have not'], [/\bhasn't\b/gi, 'has not'], [/\bhadn't\b/gi, 'had not'],
  [/\bit's\b/gi, 'it is'], [/\bthat's\b/gi, 'that is'], [/\bthere's\b/gi, 'there is'],
  [/\byou're\b/gi, 'you are'], [/\bwe're\b/gi, 'we are'], [/\bthey're\b/gi, 'they are'],
  [/\bi'm\b/gi, 'I am'], [/\blet's\b/gi, 'let us'], [/\bi'll\b/gi, 'I will'],
];

const FILLER_CUTS = [
  [/\bvery\b/gi, ''], [/\breally\b/gi, ''], [/\bjust\b/gi, ''], [/\bactually\b/gi, ''],
  [/\bbasically\b/gi, ''], [/\bliterally\b/gi, ''], [/\bquite\b/gi, ''],
  [/\bin order to\b/gi, 'to'], [/\bdue to the fact that\b/gi, 'because'],
  [/\bat this point in time\b/gi, 'now'], [/\ba large number of\b/gi, 'many'],
  [/\ba majority of\b/gi, 'most'], [/\bin the event that\b/gi, 'if'],
];

const SLANG_TO_FORMAL = [
  [/\bgonna\b/gi, 'going to'], [/\bwanna\b/gi, 'want to'], [/\bkinda\b/gi, 'somewhat'],
  [/\bsorta\b/gi, 'somewhat'], [/\byeah\b/gi, 'yes'], [/\byep\b/gi, 'yes'],
  [/\bnope\b/gi, 'no'], [/\bguys\b/gi, 'everyone'], [/\bawesome\b/gi, 'excellent'],
  [/\bcool\b/gi, 'satisfactory'], [/\bstuff\b/gi, 'items'], [/\bthings\b/gi, 'matters'],
  [/\bget\b/gi, 'obtain'], [/\bshow\b/gi, 'demonstrate'], [/\btell\b/gi, 'inform'],
  [/\bask for\b/gi, 'request'], [/\bcheck out\b/gi, 'review'], [/\bdeal with\b/gi, 'address'],
];

const FORMAL_TO_SLANG = [
  [/\bgoing to\b/gi, 'gonna'], [/\bwant to\b/gi, 'wanna'], [/\bsomewhat\b/gi, 'kinda'],
  [/\byes\b/gi, 'yeah'], [/\beveryone\b/gi, 'folks'], [/\bexcellent\b/gi, 'awesome'],
  [/\bitems\b/gi, 'stuff'], [/\bdemonstrate\b/gi, 'show'], [/\binform\b/gi, 'tell'],
  [/\brequest\b/gi, 'ask for'], [/\breview\b/gi, 'check out'], [/\baddress\b/gi, 'deal with'],
];

const COLD_TO_WARM = [
  [/\bplease note that\b/gi, 'just a heads-up:'], [/\bbe advised\b/gi, 'just so you know'],
  [/\bregards\b/gi, 'warm regards'], [/\bthank you\b/gi, 'thanks so much'],
  [/\bsorry\b/gi, "I'm really sorry"], [/\bi understand\b/gi, 'I totally understand'],
  [/\bhowever\b/gi, 'that said'], [/\bfurthermore\b/gi, 'also'],
  [/\bin conclusion\b/gi, 'to wrap up'],
];

function applySwaps(text, swaps) {
  let out = text;
  for (const [re, rep] of swaps) out = out.replace(re, rep);
  // Collapse accidental double spaces left by removals.
  return out.replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,!?;:])/g, '$1');
}

function capitalizeSentences(text) {
  return text.replace(/(^\s*[a-z]|[.!?]\s+[a-z])/g, (m) => m.toUpperCase());
}

function rewriteTone(text, tone) {
  if (!text.trim()) return '';
  let out = text;
  switch (tone) {
    case 'formal':
      out = applySwaps(out, SLANG_TO_FORMAL);
      out = applySwaps(out, EXPANSIONS);
      out = capitalizeSentences(out);
      if (!/[.!?]$/.test(out.trim())) out = out.trim() + '.';
      break;
    case 'casual':
      out = applySwaps(out, FORMAL_TO_SLANG);
      out = applySwaps(out, CONTRACTIONS);
      out = capitalizeSentences(out);
      break;
    case 'concise':
      out = applySwaps(out, FILLER_CUTS);
      out = out.replace(/\b(in my opinion|i think that|i believe that)\b,?\s*/gi, '');
      out = out.replace(/\s+/g, ' ').trim();
      break;
    case 'warm':
      out = applySwaps(out, COLD_TO_WARM);
      out = applySwaps(out, CONTRACTIONS);
      out = capitalizeSentences(out);
      if (!/!$/.test(out.trim()) && /thank|glad|great|welcome/i.test(out)) out = out.trim() + ' 😊';
      break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* UI                                                                 */
/* ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const input = $('input'), output = $('output'), toast = $('toast');

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 1500);
}

function runAnalysis() {
  const text = input.value;
  if (!text.trim()) { $('sentimentPanel').classList.add('hidden'); return; }
  const r = analyzeSentiment(text);
  $('sentimentPanel').classList.remove('hidden');

  const verdictEl = $('verdict');
  verdictEl.textContent = r.verdict;
  verdictEl.className = 'verdict ' + (r.verdict === 'Positive' ? 'pos' : r.verdict === 'Negative' ? 'neg' : 'neu');
  $('score').textContent = (r.score > 0 ? '+' : '') + r.score + ' / 100';
  $('posCount').textContent = r.pos;
  $('negCount').textContent = r.neg;
  $('neuCount').textContent = r.neu;
  // Marker: -100 (left) .. +100 (right)
  $('meterFill').style.left = ((r.score + 100) / 200 * 100) + '%';
  $('highlighted').innerHTML = r.tokens
    .map((t) => `<span class="${t.cls}">${escapeHtml(t.word)}</span>`)
    .join('');
}

function applyTone(btn) {
  const text = input.value;
  if (!text.trim()) { showToast('Enter some text first'); return; }
  document.querySelectorAll('.btn.tone').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  output.value = rewriteTone(text, btn.dataset.tone);
  persist();
}

// Draft autosave (input only — output is derived)
function persist() {
  chrome.storage.local.set({ toneShiftDraft: input.value }).catch(() => {});
}
let saveTimer = null;
input.addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 400);
});

$('analyze').addEventListener('click', runAnalysis);
$('clear').addEventListener('click', () => {
  input.value = ''; output.value = '';
  $('sentimentPanel').classList.add('hidden');
  document.querySelectorAll('.btn.tone').forEach((b) => b.classList.remove('active'));
  chrome.storage.local.remove('toneShiftDraft').catch(() => {});
});
document.querySelectorAll('.btn.tone').forEach((b) => b.addEventListener('click', () => applyTone(b)));

$('copy').addEventListener('click', async () => {
  if (!output.value) { showToast('Nothing to copy'); return; }
  try { await navigator.clipboard.writeText(output.value); showToast('Copied!'); }
  catch { showToast('Copy failed — select manually'); }
});
$('useAsInput').addEventListener('click', () => {
  if (!output.value) return;
  input.value = output.value;
  persist();
  showToast('Moved to input');
});

// Restore draft
chrome.storage.local.get('toneShiftDraft').then((d) => {
  if (d.toneShiftDraft) input.value = d.toneShiftDraft;
}).catch(() => {});

// Export hooks for Node smoke tests
if (typeof module !== 'undefined') module.exports = { analyzeSentiment, rewriteTone };
