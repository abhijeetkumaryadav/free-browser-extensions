'use strict';

/* =====================================================================
 * PromptShield — heuristic prompt-injection scanner.
 * All analysis runs 100% on-device. Heuristic patterns only: a clean
 * result is NOT a guarantee of safety. Never paste secrets into prompts.
 * ===================================================================== */

/* --- Detection rule catalog ------------------------------------------
 * Each rule: id, name, severity ('high' | 'medium' | 'low'),
 * description (why it's suspicious), and test(text) returning an array
 * of matched excerpt strings (max 3 each, trimmed for display).
 */
const RULES = [
  {
    id: 'instruction-override',
    name: 'Instruction override',
    severity: 'high',
    description:
      'Tries to make the model drop its original instructions and follow new ones instead.',
    test: (t) =>
      collect(t, [
        /ignore\s+(all\s+)?(your\s+|the\s+|any\s+)?(prior|previous|above|earlier)\s+(instructions?|directives?|rules?|guidelines?)/gi,
        /disregard\s+(all\s+)?(your\s+|the\s+)?(prior|previous|above)?\s*(instructions?|directives?|rules?|guidelines?|programming)/gi,
        /forget\s+(your|all\s+your|the)\s+(prior\s+|previous\s+)?(instructions?|rules?|guidelines?)/gi,
        /override\s+(your|the)\s+(system\s+)?(instructions?|directives?|rules?)/gi,
      ]),
  },
  {
    id: 'roleplay-jailbreak',
    name: 'Role-play jailbreak',
    severity: 'high',
    description:
      'Asks the model to adopt an unrestricted persona or "developer mode" to bypass safeguards.',
    test: (t) =>
      collect(t, [
        /\byou\s+are\s+now\b[\s\S]{0,60}?\b(unrestricted|unfiltered|uncensored|without\s+limits?|without\s+restrictions?)\b/gi,
        /\bdo\s+anything\s+now\b/gi,
        /\bpretend\s+(you\s+are|to\s+be)\b[\s\S]{0,50}?\b(no\s+restrictions?|no\s+limits?|evil|unfiltered)\b/gi,
        /\bact\s+as\s+(an?\s+)?(unrestricted|unfiltered|uncensored|evil)\b/gi,
        /\bjail ?break\b/gi,
        /\bdeveloper\s+mode\b/gi,
      ]),
  },
  {
    id: 'prompt-leak-probe',
    name: 'Prompt-leak probe',
    severity: 'high',
    description:
      'Attempts to extract the hidden system prompt or internal instructions.',
    test: (t) =>
      collect(t, [
        /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions?)/gi,
        /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions?|message)/gi,
        /what\s+are\s+your\s+(system\s+)?(instructions?|initial\s+prompt)/gi,
        /print\s+(your|the)\s+(system\s+)?(prompt|message|instructions?)/gi,
        /output\s+(your|the)\s+(initial|system)\s+(prompt|instructions?)/gi,
        /recite\s+(your|the)\s+(system\s+)?prompt/gi,
      ]),
  },
  {
    id: 'delimiter-escape',
    name: 'Delimiter / role escape',
    severity: 'medium',
    description:
      'Uses fake system delimiters to smuggle privileged-role content into the prompt.',
    test: (t) =>
      collect(t, [
        /###\s*system/gi,
        /<<<\s*system/gi,
        /\[INST\]/g,
        /\[\/INST\]/g,
        /<<SYS>>/g,
        /<\|system\|>/g,
        /###\s*instruction/gi,
      ]),
  },
  {
    id: 'hidden-unicode',
    name: 'Hidden / deceptive unicode',
    severity: 'high',
    description:
      'Contains invisible characters (zero-width, bidi overrides, tag chars) that can hide payloads or reorder text.',
    test: (t) => {
      const hits = [];
      // Zero-width & invisible
      const zw = t.match(/[\u200B\u200C\u200D\uFEFF\u00AD]/g);
      if (zw) hits.push(`${zw.length}× zero-width/invisible character(s) found`);
      // Bidirectional overrides (can visually reorder text)
      const bidi = t.match(/[‮‭‫‬⁦⁧⁨⁩]/g);
      if (bidi) hits.push(`${bidi.length}× bidi override character(s) (U+202A–U+202E, U+2066–U+2069)`);
      // Unicode tag characters (E0000–E007F) — classic hidden-payload trick
      const tags = t.match(/[\u{E0000}-\u{E007F}]/gu);
      if (tags) hits.push(`${tags.length}× unicode tag character(s) (U+E0000–U+E007F)`);
      return hits.slice(0, 3);
    },
  },
  {
    id: 'base64-blob',
    name: 'Encoded payload blob',
    severity: 'medium',
    description:
      'Long base64-looking strings can hide instructions that only decode at runtime.',
    test: (t) =>
      collect(t, [/\b[A-Za-z0-9+/]{60,}={0,2}\b/g], { maxLen: 48 }),
  },
  {
    id: 'exfiltration-attempt',
    name: 'Exfiltration attempt',
    severity: 'high',
    description:
      'Instructs the model to send data somewhere — a classic payload goal.',
    test: (t) =>
      collect(t, [
        /send\s+(this|the|it|all)\s+(to|data)/gi,
        /post\s+(this|the|it|to)\s+https?:\/\//gi,
        /\bcurl\s+https?:\/\//gi,
        /\bfetch\(\s*['"`]https?:\/\//gi,
        /\bexfiltrate\b/gi,
        /upload\s+(this|the|it)\s+to\s+https?:\/\//gi,
      ]),
  },
  {
    id: 'encoding-evasion',
    name: 'Encoding evasion',
    severity: 'medium',
    description:
      'Asks for content in an encoded form (base64/hex/rot13/…) to dodge content filters.',
    test: (t) =>
      collect(t, [
        /\b(base64|hex|rot13|caesar|morse|binary)\s*(encod(e|ing)|decod(e|ing))?\b[\s\S]{0,40}?\b(encod(e|ing)|decod(e|ing)|translate)\b/gi,
        /\bencod(e|ing)\b[\s\S]{0,40}?\b(base64|hex|rot13|caesar|morse)\b/gi,
      ]),
  },
  {
    id: 'token-smuggling',
    name: 'Token smuggling separators',
    severity: 'low',
    description:
      'Unusual separator runs (dashes, dots, long whitespace) can be used to split tokens past filters.',
    test: (t) => {
      const hits = [];
      const dash = t.match(/(?:^|\n)\s*(?:-\s*){8,}/gm);
      if (dash) hits.push(`${dash.length}× long dash-separator run(s)`);
      const ws = t.match(/\s{40,}/g);
      if (ws) hits.push(`${ws.length}× abnormal whitespace run(s) (40+ chars)`);
      const dots = t.match(/\.{10,}/g);
      if (dots) hits.push(`${dots.length}× long dot run(s)`);
      return hits.slice(0, 3);
    },
  },
  {
    id: 'hypothetical-framing',
    name: 'Hypothetical framing',
    severity: 'low',
    description:
      '"Hypothetically" / "for educational purposes" framing is a common softening trick around disallowed requests.',
    test: (t) =>
      collect(t, [
        /\bhypothetically\b[\s\S]{0,80}?\b(how\s+to|instructions?\s+for|steps?\s+to\s+(make|build|create))/gi,
        /\bfor\s+educational\s+purposes\b[\s\S]{0,80}?\b(how\s+to|instructions?\s+for)/gi,
      ]),
  },
];

/* --- Helpers --------------------------------------------------------- */

/**
 * Run a list of regexes against text, returning up to 3 display excerpts.
 * Excerpts are trimmed to maxLen chars with context around the match.
 */
function collect(text, regexes, opts = {}) {
  const maxLen = opts.maxLen || 90;
  const out = [];
  for (const re of regexes) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null && out.length < 3) {
      let excerpt = m[0].replace(/\s+/g, ' ').trim();
      if (excerpt.length > maxLen) excerpt = excerpt.slice(0, maxLen) + '…';
      out.push(`"…${excerpt}…"`);
      // Guard against zero-length match infinite loops
      if (m[0].length === 0) re.lastIndex++;
    }
    if (out.length >= 3) break;
  }
  return out;
}

const SEVERITY_WEIGHT = { high: 25, medium: 12, low: 5 };

/** Run the full rule catalog over the text. */
function scanText(text) {
  const findings = [];
  for (const rule of RULES) {
    let excerpts = [];
    try {
      excerpts = rule.test(text) || [];
    } catch (err) {
      console.warn('PromptShield rule failed:', rule.id, err);
    }
    if (excerpts.length > 0) {
      findings.push({
        id: rule.id,
        name: rule.name,
        severity: rule.severity,
        description: rule.description,
        excerpts,
        count: excerpts.length,
      });
    }
  }
  // Heaviest findings first
  findings.sort(
    (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]
  );
  let score = findings.reduce((s, f) => s + SEVERITY_WEIGHT[f.severity], 0);
  score = Math.min(100, score);
  const verdict =
    score === 0 ? 'safe' : score < 40 ? 'caution' : 'risky';
  return { findings, score, verdict };
}

/* --- Rendering ------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

function renderResult({ findings, score, verdict }) {
  const results = $('results');
  const empty = $('emptyState');
  results.classList.remove('hidden');
  empty.style.display = 'none';

  // Score ring (circumference = 2πr ≈ 188.5 for r=30)
  const ring = $('ringFg');
  const offset = 188.5 - (188.5 * score) / 100;
  ring.style.strokeDashoffset = offset;
  ring.style.stroke =
    verdict === 'safe' ? '#34d399' : verdict === 'caution' ? '#fbbf24' : '#ef4444';
  $('scoreNum').textContent = score;

  const badge = $('verdictBadge');
  badge.className = 'verdict ' + verdict;
  badge.textContent = verdict.toUpperCase();
  $('verdictDesc').textContent =
    verdict === 'safe'
      ? 'No suspicious patterns detected. Still review the text yourself.'
      : verdict === 'caution'
        ? 'A few low/medium signals found. Review the flagged items below.'
        : 'High-risk patterns detected. Treat this prompt as hostile until proven otherwise.';

  const list = $('findings');
  list.innerHTML = '';
  for (const f of findings) {
    const card = document.createElement('div');
    card.className = 'finding ' + f.severity;

    const head = document.createElement('div');
    head.className = 'finding-head';
    const sev = document.createElement('span');
    sev.className = 'sev ' + f.severity;
    sev.textContent = f.severity;
    const name = document.createElement('span');
    name.className = 'finding-name';
    name.textContent = f.name;
    const count = document.createElement('span');
    count.className = 'finding-count';
    count.textContent = f.count + (f.count === 1 ? ' match' : ' matches');
    head.append(sev, name, count);

    const desc = document.createElement('p');
    desc.className = 'finding-desc';
    desc.textContent = f.description;

    const excerpts = document.createElement('div');
    excerpts.className = 'excerpts';
    for (const ex of f.excerpts) {
      const e = document.createElement('div');
      e.className = 'excerpt';
      e.textContent = ex; // textContent — never interpreted as HTML
      excerpts.appendChild(e);
    }
    card.append(head, desc, excerpts);
    list.appendChild(card);
  }
}

function resetView() {
  $('results').classList.add('hidden');
  $('emptyState').style.display = '';
  $('input').value = '';
  updateCharCount();
  chrome.storage.local.remove('promptshield_last').catch(() => {});
}

function updateCharCount() {
  $('charCount').textContent = `${$('input').value.length.toLocaleString()} chars`;
}

/* --- Wire-up --------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  const input = $('input');

  // Restore last pasted text (convenience only; stored locally)
  chrome.storage.local
    .get('promptshield_last')
    .then((data) => {
      if (data.promptshield_last) {
        input.value = data.promptshield_last;
        updateCharCount();
      }
    })
    .catch(() => {});

  input.addEventListener('input', () => {
    updateCharCount();
    // Debounced local autosave
    clearTimeout(input._t);
    input._t = setTimeout(() => {
      chrome.storage.local.set({ promptshield_last: input.value }).catch(() => {});
    }, 600);
  });

  $('scanBtn').addEventListener('click', () => {
    const text = input.value;
    if (!text.trim()) {
      input.focus();
      return;
    }
    renderResult(scanText(text));
  });

  $('clearBtn').addEventListener('click', resetView);

  // Ctrl/Cmd+Enter to scan
  input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      $('scanBtn').click();
    }
  });
});
