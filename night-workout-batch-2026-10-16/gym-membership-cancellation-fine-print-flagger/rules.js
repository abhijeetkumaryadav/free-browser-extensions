// ============================================================================
// Fine-Print Flagger — bundled heuristic rule engine
// ENGINE-START … ENGINE-END markers keep the pure logic testable headlessly.
// ============================================================================

// ENGINE-START
'use strict';

/**
 * Each rule: id, category, severity (HIGH | MED | LOW), pattern (regex source),
 * title, and a plain-language explanation of why the clause matters.
 */
const FINE_PRINT_RULES = [
  {
    id: 'cancel-fee', category: 'Cancellation fee', severity: 'HIGH',
    pattern: /cancell?ation\s+(fee|charge|cost)|early\s+terminat(?:ion|e)\s+fee|termination\s+(?:fee|charge)/i,
    title: 'Cancellation / early-termination fee',
    why: 'Contracts may charge a fee to leave early. Check the exact amount and whether it applies to your situation.'
  },
  {
    id: 'notice-period', category: 'Notice period', severity: 'MED',
    pattern: /(\d+)\s*-?\s*days?\s+(?:written\s+)?notice|notice\s+of\s+(\d+)\s*days?|require\s+(?:at\s+least\s+)?(\d+)\s*days?\s+(?:written\s+)?notice/i,
    title: 'Advance notice required to cancel',
    why: 'You may need to give written notice days or weeks ahead — missing the window can trigger another billing cycle.'
  },
  {
    id: 'auto-renew', category: 'Auto-renewal', severity: 'HIGH',
    pattern: /auto(?:matically)?\s*[- ]?renew(?:ed|al|s)?|automatic\s+renewal|renews?\s+automatically|recurring\s+billing/i,
    title: 'Automatic renewal / recurring billing',
    why: 'The membership may keep billing after the initial term unless you actively cancel. Look for the opt-out deadline.'
  },
  {
    id: 'annual-commit', category: 'Commitment', severity: 'HIGH',
    pattern: /(\d+)\s*-?\s*month\s+(?:minimum\s+)?commitment|minimum\s+term\s+of\s+(\d+)\s*months?|initial\s+term\s+(?:of\s+)?(\d+)\s*months?/i,
    title: 'Minimum commitment term',
    why: 'A minimum term locks you in even if you stop going. Verify the exact length and what happens if you leave early.'
  },
  {
    id: 'annual-fee', category: 'Fees', severity: 'MED',
    pattern: /annual\s+(?:maintenance\s+|enhancement\s+)?fee|yearly\s+(?:maintenance\s+)?fee|enrollment\s+fee|initiation\s+fee/i,
    title: 'Annual or enrollment fee',
    why: 'One-off or yearly fees on top of dues can add hundreds to the real cost. Check when they are charged.'
  },
  {
    id: 'price-increase', category: 'Price changes', severity: 'MED',
    pattern: /dues?\s+may\s+(?:be\s+)?increas(?:ed|e)|rates?\s+subject\s+to\s+change|price\s+(?:may\s+)?increase/i,
    title: 'Dues can increase',
    why: 'The gym may reserve the right to raise monthly dues during your term. Look for caps or notice requirements.'
  },
  {
    id: 'freeze-policy', category: 'Freeze / hold', severity: 'LOW',
    pattern: /freeze|membership\s+hold|suspend(?:ing|ed)?\s+(?:your\s+)?membership/i,
    title: 'Freeze / hold policy mentioned',
    why: 'Freezing pauses billing instead of canceling — but some contracts charge a freeze fee or limit freeze length.'
  },
  {
    id: 'in-person-cancel', category: 'Cancel channel', severity: 'HIGH',
    pattern: /cancel\s+(?:only\s+)?in\s+person|must\s+cancel\s+in\s+person|in\s*[- ]?person\s+cancellation|cancell?ation[^.\n]{0,40}in\s+person|certified\s+mail/i,
    title: 'Restrictive cancellation channel',
    why: 'Requiring in-person or certified-mail cancellation makes leaving harder. Note the exact allowed channel.'
  },
  {
    id: 'no-refund', category: 'Refunds', severity: 'MED',
    pattern: /no\s+refunds?|non-?refundable|fees?\s+(?:are\s+)?not\s+refundable/i,
    title: 'No-refund clause',
    why: 'Prepaid dues or fees may not come back if you quit. Weigh this before paying upfront.'
  },
  {
    id: 'collections', category: 'Collections', severity: 'HIGH',
    pattern: /collections?|sent\s+to\s+collections?|collection\s+(?:agency|fees?)/i,
    title: 'Collections / credit impact',
    why: 'Unpaid balances may be sent to collections, which can affect your credit. Cancellation disputes can linger.'
  },
  {
    id: 'guest-fee', category: 'Extra fees', severity: 'LOW',
    pattern: /guest\s+(?:pass\s+)?fee|late\s+(?:payment\s+)?fee|returned\s+payment\s+fee/i,
    title: 'Extra fees (guests, late payment)',
    why: 'Small recurring fees add up. Check guest policies and late-payment penalties.'
  },
  {
    id: 'arbitration', category: 'Disputes', severity: 'MED',
    pattern: /binding\s+arbitration|waiv(?:e|er)\s+(?:of\s+)?(?:the\s+right\s+to\s+)?(?:a\s+)?jury|class\s+action\s+waiver/i,
    title: 'Arbitration / class-action waiver',
    why: 'You may be giving up the right to sue or join a class action if a dispute arises.'
  }
];

/**
 * Scan contract text and return flagged hits.
 * @param {string} text — the contract text to scan
 * @returns {{verdict: string, worst: string, hits: Array}} worst = highest severity found
 */
function scanFinePrint(text) {
  const hits = [];
  const seen = new Set();
  const SEV_RANK = { HIGH: 3, MED: 2, LOW: 1 };

  for (const rule of FINE_PRINT_RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      const start = Math.max(0, m.index - 60);
      const end = Math.min(text.length, m.index + m[0].length + 60);
      const snippet = (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '');
      const key = rule.id + '|' + m[0].toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        hits.push({
          id: rule.id, category: rule.category, severity: rule.severity,
          title: rule.title, why: rule.why,
          match: m[0].trim(), snippet
        });
      }
      if (m[0].length === 0) re.lastIndex++;
    }
  }

  hits.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);

  let worst = 'CLEAN';
  let verdict = 'No red flags found';
  if (hits.length > 0) {
    worst = hits[0].severity;
    const high = hits.filter(h => h.severity === 'HIGH').length;
    verdict = high > 0
      ? `${hits.length} flag${hits.length > 1 ? 's' : ''} — ${high} high-severity. Read before signing.`
      : `${hits.length} flag${hits.length > 1 ? 's' : ''} found. Worth a second look.`;
  }
  return { verdict, worst, hits };
}
// ENGINE-END

// Export for headless tests (harmless in the extension page).
if (typeof module !== 'undefined') module.exports = { FINE_PRINT_RULES, scanFinePrint };
