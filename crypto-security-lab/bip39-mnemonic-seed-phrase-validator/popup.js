/* =====================================================================
 * MnemoCheck — BIP39 Mnemonic Seed Phrase Validator
 * Validates word count, wordlist membership and checksum locally.
 *
 * ⚠ NEVER enter a real seed phrase that controls funds. For testing
 * and learning only. Nothing is transmitted anywhere.
 * ===================================================================== */

'use strict';

/* BIP39_WORDS comes from wordlist.js (vendored at build time). */
const WORD_INDEX = new Map(BIP39_WORDS.map((w, i) => [w, i]));

/* ------------------------------------------------------------------ */
/* SHA-256 (pure JS, public-domain style implementation)               */
/* ------------------------------------------------------------------ */
function sha256(ascii) {
  function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
  const maxWord = Math.pow(2, 32);
  let result = '';
  const words = [];
  const asciiBitLength = ascii.length * 8;
  let hash = sha256.h = sha256.h || [];
  const k = sha256.k = sha256.k || [];
  let primeCounter = k.length;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return; // ASCII only
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length;) {
    const w = words.slice(j, j += 16);
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 = hash[7]
        + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25))
        + ((e & hash[5]) ^ ((~e) & hash[6]))
        + k[i]
        + (w[i] = (i < 16) ? w[i] : (
          w[i - 16]
          + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3))
          + w[i - 7]
          + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))
        ) | 0);
      const temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* BIP39 validation                                                    */
/* ------------------------------------------------------------------ */

const VALID_LENGTHS = [12, 15, 18, 21, 24];

/**
 * Validate a mnemonic string.
 * Returns { checks: [{id,label,pass,detail}], valid, words, entropyBits }
 */
function validateMnemonic(input) {
  const words = input.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const checks = [];

  // 1. word count
  const countOk = VALID_LENGTHS.includes(words.length);
  checks.push({
    id: 'count',
    label: 'Word count',
    pass: countOk,
    detail: countOk ? `${words.length} words — valid length`
                    : `${words.length} words — must be 12, 15, 18, 21 or 24`
  });

  // 2. wordlist membership
  const bad = [];
  words.forEach((w, i) => { if (!WORD_INDEX.has(w)) bad.push({ word: w, pos: i + 1 }); });
  checks.push({
    id: 'words',
    label: 'Wordlist membership',
    pass: bad.length === 0 && words.length > 0,
    detail: words.length === 0 ? 'No words entered'
            : bad.length === 0 ? `All ${words.length} words are in the BIP39 English wordlist`
            : `Unknown word${bad.length > 1 ? 's' : ''}: ` + bad.slice(0, 5).map(b => `"${b.word}" (#${b.pos})`).join(', ')
              + (bad.length > 5 ? ` …and ${bad.length - 5} more` : '')
  });

  // 3. checksum (only if count + membership pass)
  let checksumPass = false, checksumDetail = 'Skipped — fix the checks above first';
  if (countOk && bad.length === 0 && words.length > 0) {
    // Convert words to 11-bit indices → bit string
    let bits = '';
    for (const w of words) bits += WORD_INDEX.get(w).toString(2).padStart(11, '0');
    const totalBits = bits.length;
    const csLen = totalBits / 33;              // checksum bits
    const entLen = totalBits - csLen;          // entropy bits
    const entropyBits = bits.slice(0, entLen);
    const checksumBits = bits.slice(entLen);

    // entropy → bytes → sha256
    let entropyBytes = '';
    for (let i = 0; i < entropyBits.length; i += 8) {
      entropyBytes += String.fromCharCode(parseInt(entropyBits.slice(i, i + 8), 2));
    }
    const hashHex = sha256(entropyBytes);
    const hashBits = [...hashHex].map(h => parseInt(h, 16).toString(2).padStart(4, '0')).join('');
    const expected = hashBits.slice(0, csLen);

    checksumPass = checksumBits === expected;
    checksumDetail = checksumPass
      ? `Checksum valid (${csLen} bits, ${entLen}-bit entropy)`
      : 'Checksum MISMATCH — one or more words are wrong (BIP39 checksum failed)';
  }
  checks.push({ id: 'checksum', label: 'Checksum', pass: checksumPass, detail: checksumDetail });

  return { checks, valid: checks.every(c => c.pass), words, entropyBits: null };
}

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

const $ = id => document.getElementById(id);
const els = {
  input: $('phrase'), btn: $('validate'), clear: $('clear'),
  results: $('results'), entropyNote: $('entropy-note'),
  copy: $('copy-report')
};

let lastResult = null;

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function render(result) {
  els.results.innerHTML = result.checks.map(c => `
    <div class="check ${c.pass ? 'pass' : 'fail'}">
      <span class="check-icon">
        ${c.pass
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'}
      </span>
      <div class="check-body">
        <div class="check-label">${c.label}</div>
        <div class="check-detail">${escapeHtml(c.detail)}</div>
      </div>
    </div>`).join('') + `
    <div class="verdict ${result.valid ? 'pass' : 'fail'}">
      ${result.valid ? '✓ Valid BIP39 mnemonic' : '✗ Not a valid BIP39 mnemonic'}
    </div>`;
  els.results.hidden = false;
  els.entropyNote.hidden = false;
}

async function copyReport() {
  if (!lastResult) return;
  const lines = ['MnemoCheck validation report', ''];
  lastResult.checks.forEach(c => lines.push(`${c.pass ? 'PASS' : 'FAIL'} — ${c.label}: ${c.detail}`));
  lines.push('', `Overall: ${lastResult.valid ? 'VALID' : 'INVALID'} BIP39 mnemonic`);
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    els.copy.textContent = 'Copied ✓';
    setTimeout(() => { els.copy.textContent = 'Copy report'; }, 1500);
  } catch (e) {
    els.copy.textContent = 'Copy failed';
    setTimeout(() => { els.copy.textContent = 'Copy report'; }, 1500);
  }
}

els.btn.addEventListener('click', () => {
  lastResult = validateMnemonic(els.input.value);
  render(lastResult);
});
els.clear.addEventListener('click', () => {
  els.input.value = '';
  els.results.hidden = true;
  els.entropyNote.hidden = true;
  lastResult = null;
});
els.copy.addEventListener('click', copyReport);
// Enter (without shift) triggers validation
els.input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); els.btn.click(); }
});
