/* Essay Clarity Checker — analyzer.js
 * Shared analysis logic (used by the popup; kept dependency-free so it can
 * be unit-tested with node). All checks are HEURISTICS — pattern matching,
 * not grammar understanding. Results should be reviewed by a human.
 */

/* Irregular past participles (not caught by the -ed suffix rule). */
const IRREGULAR_PARTICIPLES = [
  'written', 'shown', 'taken', 'given', 'done', 'made', 'chosen', 'broken',
  'spoken', 'grown', 'known', 'seen', 'found', 'lost',
  'bought', 'brought', 'thought', 'taught', 'caught', 'driven', 'eaten',
  'forbidden', 'forgotten', 'hidden', 'ridden', 'risen', 'shaken', 'stolen',
  'sworn', 'thrown', 'worn', 'drawn', 'proven', 'frozen', 'sung', 'sunk',
  'held', 'laid', 'paid', 'said', 'sent', 'spent', 'kept', 'left', 'met',
  'set', 'put', 'cut', 'hit', 'hurt', 'read',
];

/* Common "be" + past-participle passive patterns, e.g. "was written",
 * "has been shown". This catches the canonical passive-voice construction
 * but will miss others and may flag adjectives (e.g. "was tired"). */
const PASSIVE_RE = new RegExp(
  '\\b(am|is|are|was|were|be|being|been|has been|have been|had been|will be|is being|are being|was being|were being)\\s+(' +
    '[a-z]+ed|' + IRREGULAR_PARTICIPLES.join('|') + ')\\b',
  'gi'
);

/* Nominalizations — nouns ending in these suffixes often hint at
 * wordier phrasing ("make an observation" -> "observe"). */
const NOMINALIZATION_RES = [
  /\b\w+(ation|ition|ation)s?\b/gi,   // observation, realization
  /\b\w+(ment|ness|ity|ities|ence|ance)s?\b/gi, // development, effectiveness
];

/* Bundled cliché list. Longer phrases first so they match before parts. */
const CLICHES = [
  'at the end of the day', 'think outside the box', 'in this day and age',
  'a blessing in disguise', 'beat around the bush', 'break the ice',
  'cutting edge', 'state of the art', 'last but not least', 'diamond in the rough',
  'easy as pie', 'tip of the iceberg', 'whole nine yards', 'play it by ear',
  'it goes without saying', 'needless to say', 'in other words',
  'as a matter of fact', 'due to the fact that', 'in order to',
  'in the process of', 'the fact that', 'very unique', 'quite unique',
  'more unique', 'most unique', 'irregardless', 'alot', 'could of', 'should of',
  'would of', 'myself', // often misused in academic writing ("John and myself went")
];

/* Words that often signal weak/wordy academic hedging stacks. */
const HEDGE_WORDS = ['very', 'really', 'quite', 'rather', 'somewhat', 'fairly',
  'extremely', 'incredibly', 'basically', 'essentially', 'literally', 'actually',
  'just', 'simply'];

/** Split text into sentences (heuristic). */
function splitSentences(text) {
  return (text.match(/[^.!?…]+[.!?…]+["”)]?|\S[^.!?…]*$/g) || [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Count words in a string. */
function countWords(s) {
  const m = s.match(/[A-Za-z0-9']+/g);
  return m ? m.length : 0;
}

/** Find passive-voice matches. */
function findPassive(text) {
  const out = [];
  PASSIVE_RE.lastIndex = 0;
  let m;
  while ((m = PASSIVE_RE.exec(text)) !== null && out.length < 200) {
    out.push({ phrase: m[0], index: m.index });
  }
  return out;
}

/** Find cliché matches (case-insensitive, word-boundary regex so
 * trailing punctuation doesn't hide a match). */
function findCliches(text) {
  const out = [];
  for (const c of CLICHES) {
    const re = new RegExp('\\b' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    let m;
    while ((m = re.exec(text)) !== null && out.length < 200) {
      out.push({ phrase: m[0].toLowerCase() === c ? m[0] : c, index: m.index });
      if (m.index === re.lastIndex) re.lastIndex++; // avoid zero-width stall
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Find heavy hedging stacks (2+ hedge words in one sentence). */
function findHedges(sentences) {
  const out = [];
  sentences.forEach((s, i) => {
    const found = HEDGE_WORDS.filter((w) =>
      new RegExp('\\b' + w + '\\b', 'i').test(s));
    if (found.length >= 2) out.push({ sentence: i + 1, words: found, text: s });
  });
  return out;
}

/** Full analysis entry point. */
function analyze(text, opts = {}) {
  const longAt = opts.longAt || 30; // words
  const sentences = splitSentences(text);
  const words = text.match(/[A-Za-z0-9']+/g) || [];
  const longSentences = sentences
    .map((s, i) => ({ sentence: i + 1, words: countWords(s), text: s }))
    .filter((s) => s.words >= longAt);
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    passive: findPassive(text),
    cliches: findCliches(text),
    longSentences,
    hedges: findHedges(sentences),
  };
}

if (typeof module !== 'undefined') module.exports = { analyze, splitSentences, countWords, CLICHES };
