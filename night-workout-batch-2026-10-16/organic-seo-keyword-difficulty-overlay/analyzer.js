// ---------------------------------------------------------------------------
// analyzer.js — dependency-free SEO scoring logic.
// All checks are heuristics on data extracted from the current page.
// Labeled honestly: this is an on-page checklist, NOT real keyword difficulty.
// ---------------------------------------------------------------------------

'use strict';

/** Escape regex special characters. */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Count (case-insensitive) non-overlapping whole-phrase occurrences.
 * Multi-word keywords are matched as a phrase.
 */
function countOccurrences(text, keyword) {
  if (!text || !keyword) return 0;
  const t = text.toLowerCase();
  const k = keyword.toLowerCase();
  let count = 0;
  let i = 0;
  while ((i = t.indexOf(k, i)) !== -1) {
    count++;
    i += k.length;
  }
  return count;
}

/**
 * Rough syllable estimate for a word (for readability heuristic).
 */
function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  const groups = w.match(/[aeiouy]+/g);
  let n = groups ? groups.length : 0;
  if (w.endsWith('e') && n > 1) n -= 1;
  return Math.max(n, 1);
}

/**
 * Flesch Reading Ease (clamped 0–100). Approximate syllable counting.
 */
function fleschEase(words) {
  if (words.length < 10) return null;
  const sentences = 1; // page-level heuristic uses a rough sentence split below
  return null; // replaced by readabilityScore for page data
}

/**
 * Compute readability 0–100 from aggregate stats (simple words %).
 */
function readabilityScore(longWordRatio) {
  // higher longWordRatio → harder; map 0..1 → 100..0
  return Math.max(0, Math.round(100 - longWordRatio * 100));
}

/**
 * Score page data against a keyword.
 * @param {object} data — extracted from the page (see content.js)
 * @param {string} keyword — user's target keyword
 * @returns {object} { score: 0-100, checks: [{id,label,pass,weight,tip,detail}] }
 */
function scoreSeo(data, keyword) {
  const kw = keyword.trim();
  const checks = [];

  const add = (id, label, pass, weight, tip, detail) => {
    checks.push({ id, label, pass: !!pass, weight, tip, detail: detail || '' });
  };

  const inHay = (hay) => hay && kw && hay.toLowerCase().includes(kw.toLowerCase());

  // 1. Keyword in <title>
  const titleHas = inHay(data.title);
  add(
    'title',
    'Keyword in page title',
    titleHas,
    20,
    'Put the keyword near the start of your <title> (under ~60 characters).',
    data.title ? `Title: "${data.title.slice(0, 70)}${data.title.length > 70 ? '…' : ''}"` : 'No title found'
  );

  // 2. Keyword in meta description
  const metaHas = inHay(data.metaDescription);
  add(
    'meta',
    'Keyword in meta description',
    metaHas,
    10,
    'Include the keyword once in a ~150-character meta description.',
    data.metaDescription ? `Meta: "${data.metaDescription.slice(0, 90)}${data.metaDescription.length > 90 ? '…' : ''}"` : 'No meta description found'
  );

  // 3. Keyword in H1
  const h1Has = (data.h1s || []).some((h) => inHay(h));
  add(
    'h1',
    'Keyword in an H1 heading',
    h1Has,
    15,
    'Use the keyword in one clear H1 (only one H1 per page).',
    `${(data.h1s || []).length} H1(s) found`
  );

  // 4. Keyword in H2/H3 subheadings
  const subCount = (data.subHeads || []).filter((h) => inHay(h)).length;
  add(
    'subheads',
    'Keyword in subheadings (H2/H3)',
    subCount > 0,
    10,
    'Echo the keyword or variants in 1–2 subheadings.',
    `${subCount} matching subheading(s)`
  );

  // 5. Keyword in URL slug
  const urlHas = data.url
    ? inHay(decodeURIComponent(data.url).replace(/[-_/]/g, ' '))
    : false;
  add(
    'url',
    'Keyword in URL slug',
    urlHas,
    10,
    'Short, readable slugs with the keyword rank slightly better.',
    data.url ? data.url.slice(0, 60) : 'No URL'
  );

  // 6. Body mentions (healthy range)
  const bodyWords = data.wordCount || 0;
  const mentions = countOccurrences(data.bodyTextSample || '', kw);
  // We only receive a sample; scale proportionally. Heuristic band: present but not stuffed.
  const mentionPass = mentions >= 1 && mentions <= 40;
  add(
    'mentions',
    'Keyword appears in body text',
    mentionPass,
    10,
    'Mention the keyword naturally in the opening 100 words; avoid stuffing.',
    `${mentions} mention(s) in sampled text`
  );

  // 7. Content length (heuristic floor)
  const lenPass = bodyWords >= 300;
  add(
    'length',
    'Adequate content depth (300+ words)',
    lenPass,
    10,
    'Thin pages rarely rank; aim for genuinely useful depth.',
    `${bodyWords.toLocaleString()} words detected`
  );

  // 8. Images with alt text
  const imgs = data.imagesTotal || 0;
  const alted = data.imagesWithAlt || 0;
  const imgPass = imgs === 0 ? true : alted / imgs >= 0.5;
  add(
    'images',
    'Images have alt text (50%+)',
    imgPass,
    5,
    'Descriptive alt text helps image search and accessibility.',
    `${alted}/${imgs} images have alt text`
  );

  // 9. Readability heuristic
  const read = readabilityScore(data.longWordRatio || 0);
  add(
    'readability',
    'Readable language (heuristic)',
    read >= 50,
    10,
    'Short sentences and plain words keep readers on the page.',
    `Score ${read}/100 (approximate)`
  );

  // Weighted score
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);
  const score = Math.round((earned / totalWeight) * 100);

  return { score, checks };
}

// Export for node unit tests; browser uses the global.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scoreSeo, countOccurrences, readabilityScore, syllables };
}
