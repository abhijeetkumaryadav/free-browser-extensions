/* Anagram & Crossword Solver — popup logic.
   100% local letter-frequency matching against the bundled WORD_LIST. */

/* Precompute letter-count signatures for every word once. */
const SIG = WORD_LIST.map((w) => countsOf(w));

function countsOf(s) {
  const c = new Array(26).fill(0);
  for (const ch of s.toLowerCase()) {
    const i = ch.charCodeAt(0) - 97;
    if (i >= 0 && i < 26) c[i]++;
  }
  return c;
}

/* True when word's letter counts are a subset of the rack's counts. */
function fits(wordSig, rackSig) {
  for (let i = 0; i < 26; i++) {
    if (wordSig[i] > rackSig[i]) return false;
  }
  return true;
}

/* Pattern like "s_e_t": letters must match, "_" is a wildcard. */
function matchPattern(word, pattern) {
  if (!pattern) return true;
  if (word.length !== pattern.length) return false;
  const p = pattern.toLowerCase();
  for (let i = 0; i < p.length; i++) {
    if (p[i] !== '_' && p[i] !== word[i]) return false;
  }
  return true;
}

function solve() {
  const raw = document.getElementById('letters').value.toLowerCase().replace(/[^a-z]/g, '');
  const pattern = document.getElementById('pattern').value.trim();
  const status = document.getElementById('status');
  const results = document.getElementById('results');
  results.innerHTML = '';

  if (raw.length < 2) {
    status.textContent = 'Enter at least 2 letters.';
    return;
  }
  const rack = countsOf(raw);
  const byLen = new Map();
  let total = 0;
  for (let i = 0; i < WORD_LIST.length; i++) {
    const w = WORD_LIST[i];
    if (w.length > raw.length) continue;
    if (!fits(SIG[i], rack)) continue;
    if (!matchPattern(w, pattern)) continue;
    if (!byLen.has(w.length)) byLen.set(w.length, []);
    byLen.get(w.length).push(w);
    total++;
    if (total >= 2000) break; // cap for UI sanity
  }

  if (total === 0) {
    status.textContent = 'No matches found. Try different letters.';
    return;
  }
  status.textContent = total + ' word' + (total === 1 ? '' : 's') + ' found.';

  const lens = [...byLen.keys()].sort((a, b) => b - a); // longest first
  for (const len of lens) {
    const group = document.createElement('div');
    group.className = 'group';
    const h = document.createElement('h3');
    h.textContent = len + ' LETTERS';
    group.appendChild(h);
    const wrap = document.createElement('div');
    wrap.className = 'words';
    for (const w of byLen.get(len).sort()) {
      const s = document.createElement('span');
      s.textContent = w;
      wrap.appendChild(s);
    }
    group.appendChild(wrap);
    results.appendChild(group);
  }
}

/* Grab selected text from the active tab (explicit click only). */
async function grabSelection() {
  const status = document.getElementById('status');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
    const text = (res && res[0] && res[0].result) || '';
    const clean = text.toLowerCase().replace(/[^a-z]/g, '');
    if (clean.length < 2) {
      status.textContent = 'No usable selected text on this tab.';
      return;
    }
    document.getElementById('letters').value = clean.slice(0, 15);
    solve();
  } catch (e) {
    status.textContent = 'Cannot read this tab (internal pages are restricted).';
  }
}

document.getElementById('solve').addEventListener('click', solve);
document.getElementById('grab').addEventListener('click', grabSelection);
document.getElementById('letters').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') solve();
});
document.getElementById('pattern').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') solve();
});
