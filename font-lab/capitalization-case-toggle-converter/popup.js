// CaseShift — pure local case-conversion engine + popup wiring.
'use strict';

/* ------------------------------------------------------------------ */
/* Case conversion engine (pure functions, no DOM)                     */
/* ------------------------------------------------------------------ */

// Split text into words on whitespace / underscores / hyphens.
function splitWords(text) {
  return text.split(/[\s_\-]+/).filter(Boolean);
}

const CASES = {
  upper: (t) => t.toUpperCase(),
  lower: (t) => t.toLowerCase(),

  // Title Case: first letter of each word capitalised.
  title: (t) =>
    t.toLowerCase().replace(/(^|[\s\-–—(])([a-zà-ÿ])/g, (m, p, c) => p + c.toUpperCase()),

  // Sentence case: first letter of each sentence capitalised, rest lower.
  sentence: (t) =>
    t.toLowerCase().replace(/(^\s*[a-zà-ÿ]|[.!?]\s+[a-zà-ÿ])/g, (c) => c.toUpperCase()),

  // aLtErNaTiNg: letter-by-letter alternation, resetting after separators.
  alternating: (t) => {
    let upper = false;
    return [...t].map((ch) => {
      if (!/[a-zà-ÿ]/i.test(ch)) { upper = false; return ch; }
      upper = !upper;
      return upper ? ch.toUpperCase() : ch.toLowerCase();
    }).join('');
  },

  // tOGGLE: swap the case of every letter.
  toggle: (t) =>
    [...t].map((ch) =>
      ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()
    ).join(''),

  camel: (t) => {
    const words = splitWords(t.toLowerCase());
    return words.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join('');
  },

  pascal: (t) => {
    const words = splitWords(t.toLowerCase());
    return words.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  },

  snake: (t) => splitWords(t.toLowerCase()).join('_'),

  kebab: (t) => splitWords(t.toLowerCase()).join('-'),
};

const CASE_LABELS = {
  upper: 'UPPER CASE', lower: 'lower case', title: 'Title Case',
  sentence: 'Sentence case', alternating: 'aLtErNaTiNg', toggle: 'tOGGLE',
  camel: 'camelCase', pascal: 'PascalCase', snake: 'snake_case', kebab: 'kebab-case',
};

/* ------------------------------------------------------------------ */
/* Popup wiring                                                        */
/* ------------------------------------------------------------------ */

const input = document.getElementById('input');
const output = document.getElementById('output');
const stats = document.getElementById('stats');
const modeChip = document.getElementById('modeChip');
const toast = document.getElementById('toast');
const caseGrid = document.getElementById('caseGrid');

let activeCase = 'upper';
let toastTimer = null;

// Remember the last-used case mode across popup sessions.
chrome.storage.local.get(['lastCase'], ({ lastCase }) => {
  if (lastCase && CASES[lastCase]) {
    setActiveCase(lastCase);
  }
  convert();
});

function setActiveCase(name) {
  activeCase = name;
  caseGrid.querySelectorAll('.case-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.case === name)
  );
  modeChip.textContent = CASE_LABELS[name];
  chrome.storage.local.set({ lastCase: name });
}

function updateStats(text) {
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  stats.textContent = `${chars} char${chars === 1 ? '' : 's'} · ${words} word${words === 1 ? '' : 's'}`;
}

function convert() {
  const text = input.value;
  updateStats(text);
  output.value = text ? CASES[activeCase](text) : '';
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
}

caseGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.case-btn');
  if (!btn) return;
  setActiveCase(btn.dataset.case);
  convert();
});

input.addEventListener('input', convert);

document.getElementById('clearBtn').addEventListener('click', () => {
  input.value = '';
  convert();
  input.focus();
});

document.getElementById('copyBtn').addEventListener('click', async () => {
  if (!output.value) { showToast('Nothing to copy yet'); return; }
  try {
    await navigator.clipboard.writeText(output.value);
    showToast('Copied to clipboard ✓');
  } catch {
    output.select();
    document.execCommand('copy');
    showToast('Copied ✓');
  }
});
