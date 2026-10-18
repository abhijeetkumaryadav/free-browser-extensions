// ============================================================================
// Label Lens — bundled heuristic rule engine for supplement labels.
// ENGINE-START … ENGINE-END markers keep the pure logic testable headlessly.
// NOTE: these are LABEL heuristics. They cannot test purity, potency, or
// contamination, and they are not medical advice.
// ============================================================================

// ENGINE-START
'use strict';

const LABEL_RULES = [
  {
    id: 'proprietary-blend', category: 'Transparency', severity: 'HIGH',
    pattern: /proprietary\s+(?:blend|formula|matrix|complex)/i,
    title: 'Proprietary blend',
    why: 'A proprietary blend hides how much of each ingredient you actually get. You cannot verify whether key ingredients are dosed adequately.'
  },
  {
    id: 'blend-many', category: 'Transparency', severity: 'HIGH',
    pattern: /proprietary\s+(?:blend|formula|matrix|complex)\s*\([^)]{120,}\)/is,
    title: 'Large proprietary blend (many ingredients)',
    why: 'When a blend lists many ingredients under one total weight, most of them are almost certainly present in tiny "fairy-dust" amounts.'
  },
  {
    id: 'blend-caffeine', category: 'Stimulants', severity: 'MED',
    pattern: /proprietary\s+(?:blend|formula|matrix|complex)\s*\([^)]*caffeine[^)]*\)/is,
    title: 'Caffeine hidden inside a blend',
    why: 'Caffeine amount is not disclosed. Sensitive users should be cautious since the dose could be high or low.'
  },
  {
    id: 'artificial-colors', category: 'Additives', severity: 'MED',
    pattern: /FD\s*&\s*C|Red\s*40|Yellow\s*[56]|Blue\s*[12]|caramel\s+color|titanium\s+dioxide/i,
    title: 'Artificial colors',
    why: 'Cosmetic colorants with no nutritional purpose. Some people prefer to avoid them; they add nothing to the product.'
  },
  {
    id: 'artificial-sweeteners', category: 'Additives', severity: 'LOW',
    pattern: /sucralose|aspartame|acesulfame(?:\s*-?\s*K)?|acesulfame\s+potassium|saccharin/i,
    title: 'Artificial sweeteners',
    why: 'Zero-calorie sweeteners used for taste. A preference call — flagging so you know they are there.'
  },
  {
    id: 'filler-maltodextrin', category: 'Fillers', severity: 'LOW',
    pattern: /maltodextrin/i,
    title: 'Maltodextrin',
    why: 'A common cheap filler/bulking agent. Not harmful per se, but it displaces active ingredients.'
  },
  {
    id: 'filler-stearate', category: 'Fillers', severity: 'LOW',
    pattern: /magnesium\s+stearate|stearic\s+acid/i,
    title: 'Magnesium stearate / stearic acid',
    why: 'A flow agent that keeps powder from clumping in machines. Standard excipient, widely considered safe.'
  },
  {
    id: 'filler-silica', category: 'Fillers', severity: 'LOW',
    pattern: /silicon\s+dioxide|silica/i,
    title: 'Silicon dioxide (silica)',
    why: 'An anti-caking agent. Standard excipient; flags here only so the full ingredient list is visible.'
  },
  {
    id: 'missing-servings', category: 'Transparency', severity: 'MED',
    pattern: /servings?\s+per\s+container/i,
    title: 'Servings-per-container line',
    why: 'Present on the label (good). If this line were missing, you could not compute cost-per-serving or daily totals.',
    invert: true
  },
  {
    id: 'marketing-claim', category: 'Marketing', severity: 'LOW',
    pattern: /clinically\s+dosed|pharmaceutical\s+grade|doctor\s+formulated|maximum\s+strength/i,
    title: 'Unverifiable marketing claim',
    why: 'Phrases like "clinically dosed" sound scientific but are not regulated label terms. Check the actual numbers instead.'
  }
];

/**
 * Scan a supplement label and return flagged hits.
 * Rules with `invert: true` flag the ABSENCE of the pattern (info, LOW-ish).
 * @param {string} text — label text
 * @returns {{verdict: string, worst: string, hits: Array, stats: Object}}
 */
function scanLabel(text) {
  const hits = [];
  const seen = new Set();
  const SEV_RANK = { HIGH: 3, MED: 2, LOW: 1 };
  const clean = (text || '').replace(/\s+/g, ' ');

  for (const rule of LABEL_RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g');
    if (rule.invert) {
      re.lastIndex = 0;
      if (!re.test(clean)) {
        hits.push({ id: rule.id, category: rule.category, severity: rule.severity,
          title: rule.title + ' (missing)', why: rule.why, match: '(not found on label)', snippet: '' });
      }
      continue;
    }
    let m;
    while ((m = re.exec(clean)) !== null) {
      const start = Math.max(0, m.index - 50);
      const end = Math.min(clean.length, m.index + m[0].length + 50);
      const snippet = (start > 0 ? '…' : '') + clean.slice(start, end).trim() + (end < clean.length ? '…' : '');
      const key = rule.id + '|' + m[0].toLowerCase().slice(0, 40);
      if (!seen.has(key)) {
        seen.add(key);
        hits.push({ id: rule.id, category: rule.category, severity: rule.severity,
          title: rule.title, why: rule.why, match: m[0].trim().slice(0, 120), snippet });
      }
      if (m[0].length === 0) re.lastIndex++;
    }
  }

  hits.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);

  // Simple label stats: serving size + servings per container if present.
  const stats = {};
  const srv = /serving\s+size[:\s]+([^\n;|]{1,40})/i.exec(clean);
  if (srv) stats.servingSize = srv[1].trim();
  const cnt = /(\d+)\s+servings?\s+per\s+container/i.exec(clean);
  if (cnt) stats.servingsPerContainer = cnt[1];

  let worst = 'CLEAN';
  let verdict = 'No flags found on this label';
  if (hits.length > 0) {
    worst = hits[0].severity;
    const high = hits.filter(h => h.severity === 'HIGH').length;
    verdict = high > 0
      ? `${hits.length} flag${hits.length > 1 ? 's' : ''} — ${high} high-severity transparency issue${high > 1 ? 's' : ''}.`
      : `${hits.length} flag${hits.length > 1 ? 's' : ''} found. Minor items to review.`;
  }
  return { verdict, worst, hits, stats };
}
// ENGINE-END

if (typeof module !== 'undefined') module.exports = { LABEL_RULES, scanLabel };
