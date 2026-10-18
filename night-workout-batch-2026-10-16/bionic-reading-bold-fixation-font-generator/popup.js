/* Bionic Formatter — popup logic.
 * ENGINE functions (between ENGINE-START / ENGINE-END) are pure and
 * headless-testable: they never touch the DOM or chrome.* APIs. */

'use strict';

// ---------------------------------------------------------------- ENGINE-START

/**
 * Escape HTML special chars so pasted text can't break the output markup.
 */
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Decide how many leading characters of a word to bold.
 * mode 'auto': longer words get a longer fixation (1..4 chars).
 * mode 'half': ceil(len/2).  mode 'third': ceil(len/3).
 * Words of 1 char are left untouched (nothing to emphasize).
 */
function fixationLength(wordLen, mode) {
  if (wordLen <= 1) return 0;
  if (mode === 'half') return Math.ceil(wordLen / 2);
  if (mode === 'third') return Math.ceil(wordLen / 3);
  // auto: graduated by length
  if (wordLen <= 3) return 1;
  if (wordLen <= 5) return 2;
  if (wordLen <= 8) return 3;
  return 4;
}

/**
 * Is this token a "word" worth formatting? Letters/digits, at least 2 chars.
 * Pure punctuation / numbers-only tokens are left as-is.
 */
function isFormatable(token) {
  return /[A-Za-z]/.test(token) && token.length > 1;
}

/**
 * Apply bionic-style formatting to plain text.
 * Returns an HTML string: first `fixationLength` chars of each formatable
 * word wrapped in <b>, everything else escaped as-is. Whitespace and
 * punctuation are preserved verbatim.
 */
function bionicize(text, mode) {
  if (!text) return '';
  // Split into word / non-word runs so spacing & punctuation survive.
  const runs = text.match(/[A-Za-z0-9]+(?:['\u2019][A-Za-z0-9]+)*|[^A-Za-z0-9]+/g) || [];
  let out = '';
  for (const run of runs) {
    if (isFormatable(run)) {
      const n = fixationLength(run.length, mode);
      if (n > 0) {
        out += '<b>' + escapeHtml(run.slice(0, n)) + '</b>' + escapeHtml(run.slice(n));
        continue;
      }
    }
    out += escapeHtml(run);
  }
  return out;
}

/**
 * Count words (same word definition as bionicize uses).
 */
function countWords(text) {
  const m = (text || '').match(/[A-Za-z0-9]+(?:['\u2019][A-Za-z0-9]+)*/g);
  return m ? m.length : 0;
}

/**
 * Build a standalone HTML document wrapping the formatted body,
 * for the .html download.
 */
function standaloneHtml(formattedBody, title) {
  const safeTitle = escapeHtml(title || 'Bionic-formatted text');
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n' +
    '<title>' + safeTitle + '</title>\n' +
    '<style>body{font-family:Georgia,serif;font-size:18px;line-height:1.8;max-width:680px;margin:2em auto;padding:0 1em;}b{font-weight:800;}</style>\n' +
    '</head>\n<body>\n' + formattedBody + '\n</body>\n</html>\n';
}
// ---------------------------------------------------------------- ENGINE-END

/* ---------------- UI wiring (DOM + storage only below this line) ---------------- */

const $ = id => document.getElementById(id);
const input = $('input'), fixationSel = $('fixation');
const formatBtn = $('formatBtn'), clearBtn = $('clearBtn');
const resultCard = $('resultCard'), preview = $('preview'), stats = $('stats');
const copyBtn = $('copyBtn'), downloadBtn = $('downloadBtn');

let lastHtml = '';

// Restore last session.
chrome.storage.local.get({ bf_input: '', bf_mode: 'auto' }, data => {
  input.value = data.bf_input || '';
  fixationSel.value = data.bf_mode || 'auto';
});

function persistSession() {
  chrome.storage.local.set({ bf_input: input.value, bf_mode: fixationSel.value });
}

input.addEventListener('input', persistSession);
fixationSel.addEventListener('change', () => { persistSession(); format(); });

function format() {
  const text = input.value;
  if (!text.trim()) {
    resultCard.hidden = true;
    lastHtml = '';
    return;
  }
  lastHtml = bionicize(text, fixationSel.value);
  preview.innerHTML = lastHtml;
  stats.textContent = countWords(text) + ' words';
  resultCard.hidden = false;
}

formatBtn.addEventListener('click', format);

clearBtn.addEventListener('click', () => {
  input.value = '';
  resultCard.hidden = true;
  lastHtml = '';
  persistSession();
});

const COPY_LABEL = copyBtn.innerHTML;
copyBtn.addEventListener('click', async () => {
  if (!lastHtml) return;
  try {
    await navigator.clipboard.writeText(lastHtml);
    copyBtn.textContent = 'Copied!';
  } catch (e) {
    copyBtn.textContent = 'Copy failed';
  }
  setTimeout(() => { copyBtn.innerHTML = COPY_LABEL; }, 1500);
});

downloadBtn.addEventListener('click', () => {
  if (!lastHtml) return;
  const doc = standaloneHtml(lastHtml, 'Bionic-formatted text');
  const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bionic-formatted.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});
