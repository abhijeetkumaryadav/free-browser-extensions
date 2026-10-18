/* BleepBox popup logic: censor pasted/selected text with a bundled + custom word list.
 * All processing is local. No network calls anywhere in this extension. */
'use strict';

/* wordlist.js is bundled below (inlined into popup context via script tag in MV3-safe way).
 * Because MV3 forbids remote code, the list lives in wordlist.js loaded before this file. */

const STORAGE_KEY = 'bleepbox.state.v1';
const DEFAULT_MASK = 'asterisk';

/* ---------- masking ---------- */

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Censor `text` using `words` and `maskStyle`.
 * Returns { censored, hits }.
 */
function censorText(text, words, maskStyle) {
  // Longest words first so multi-word phrases ("shut up") win over short ones.
  const sorted = [...words].sort((a, b) => b.length - a.length);
  let hits = 0;
  let censored = text;
  for (const raw of sorted) {
    const word = raw.trim().toLowerCase();
    if (!word) continue;
    // Match whole words only; for phrases, allow the exact phrase.
    const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi');
    censored = censored.replace(pattern, (match) => {
      hits += 1;
      return maskFor(match, maskStyle);
    });
  }
  return { censored, hits };
}

/** Build the replacement string for a matched word. */
function maskFor(match, maskStyle) {
  switch (maskStyle) {
    case 'hash':
      return '#'.repeat(match.length);
    case 'firstlast':
      if (match.length <= 2) return '*'.repeat(match.length);
      return match[0] + '*'.repeat(match.length - 2) + match[match.length - 1];
    case 'bleep':
      return '[bleep]';
    case 'asterisk':
    default:
      return '*'.repeat(match.length);
  }
}

/* ---------- state ---------- */

async function loadState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const state = stored[STORAGE_KEY] || {};
  return {
    addedWords: Array.isArray(state.addedWords) ? state.addedWords : [],
    removedWords: Array.isArray(state.removedWords) ? state.removedWords : [],
    intensity: state.intensity || 'standard',
    maskStyle: state.maskStyle || DEFAULT_MASK
  };
}

async function saveState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

/** Effective word list = bundled (minus removed) + user additions. */
function effectiveBundled(state) {
  const removed = new Set(state.removedWords.map((w) => w.toLowerCase()));
  const all = [...BUNDLED_WORDS.mild, ...BUNDLED_WORDS.standard, ...BUNDLED_WORDS.strict];
  return all.filter((w) => !removed.has(w.toLowerCase()));
}

/* ---------- UI ---------- */

let state;

function renderWordList() {
  const listEl = document.getElementById('wordList');
  listEl.innerHTML = '';
  const bundled = effectiveBundled(state);
  const custom = state.addedWords;
  if (bundled.length === 0 && custom.length === 0) {
    listEl.innerHTML = '<span class="empty-note">List is empty — add words below.</span>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const word of custom) {
    frag.appendChild(makeTag(word, true));
  }
  for (const word of bundled) {
    frag.appendChild(makeTag(word, false));
  }
  listEl.appendChild(frag);
}

function makeTag(word, isCustom) {
  const tag = document.createElement('span');
  tag.className = 'word-tag' + (isCustom ? ' custom' : '');
  const label = document.createElement('span');
  label.textContent = word;
  const btn = document.createElement('button');
  btn.textContent = '×';
  btn.title = isCustom ? 'Delete custom word' : 'Remove from list';
  btn.setAttribute('aria-label', `Remove ${word}`);
  btn.addEventListener('click', async () => {
    if (isCustom) {
      state.addedWords = state.addedWords.filter((w) => w.toLowerCase() !== word.toLowerCase());
    } else {
      state.removedWords.push(word.toLowerCase());
    }
    await saveState(state);
    renderWordList();
  });
  tag.appendChild(label);
  tag.appendChild(btn);
  return tag;
}

async function doCensor() {
  const input = document.getElementById('inputText').value;
  if (!input.trim()) {
    document.getElementById('outputPanel').hidden = true;
    return;
  }
  const intensityWords = wordsForIntensity(state.intensity);
  // Only censor with words that are actually enabled (bundled minus removed) plus custom additions.
  const enabled = new Set(
    [...effectiveBundled(state), ...state.addedWords].map((w) => w.toLowerCase())
  );
  const words = intensityWords.filter((w) => enabled.has(w.toLowerCase()));
  const customForIntensity = state.addedWords; // custom words always apply
  const { censored, hits } = censorText(input, [...words, ...customForIntensity], state.maskStyle);
  document.getElementById('outputText').value = censored;
  document.getElementById('hitCount').textContent = hits === 1 ? '1 word censored' : `${hits} words censored`;
  document.getElementById('outputPanel').hidden = false;
}

/** Self-contained function injected into the active tab to read the selection. */
function getPageSelection() {
  return window.getSelection ? String(window.getSelection()) : '';
}

async function grabSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: getPageSelection
    });
    const text = results && results[0] && results[0].result;
    if (text) {
      document.getElementById('inputText').value = text;
    } else {
      document.getElementById('inputText').placeholder = 'No text selected on this page.';
    }
  } catch (err) {
    // Restricted pages (chrome://, Web Store) refuse injection — say so plainly.
    document.getElementById('inputText').placeholder = 'Cannot read selection on this page.';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  state = await loadState();

  document.getElementById('intensity').value = state.intensity;
  document.getElementById('maskStyle').value = state.maskStyle;
  renderWordList();

  document.getElementById('intensity').addEventListener('change', async (e) => {
    state.intensity = e.target.value;
    await saveState(state);
  });
  document.getElementById('maskStyle').addEventListener('change', async (e) => {
    state.maskStyle = e.target.value;
    await saveState(state);
  });

  document.getElementById('censorBtn').addEventListener('click', doCensor);
  document.getElementById('grabSelection').addEventListener('click', grabSelection);
  document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('inputText').value = '';
    document.getElementById('outputPanel').hidden = true;
  });
  document.getElementById('copyBtn').addEventListener('click', async (e) => {
    const out = document.getElementById('outputText').value;
    await navigator.clipboard.writeText(out);
    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.innerHTML = 'Copied!';
    setTimeout(() => { btn.innerHTML = original; }, 1200);
  });

  const addWord = async () => {
    const input = document.getElementById('newWord');
    const word = input.value.trim().toLowerCase();
    if (!word) return;
    const known = new Set(
      [...effectiveBundled(state), ...state.addedWords].map((w) => w.toLowerCase())
    );
    if (!known.has(word)) {
      state.addedWords.push(word);
      await saveState(state);
      renderWordList();
    }
    input.value = '';
    input.focus();
  };
  document.getElementById('addWord').addEventListener('click', addWord);
  document.getElementById('newWord').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addWord();
  });

  document.getElementById('resetWords').addEventListener('click', async () => {
    state.addedWords = [];
    state.removedWords = [];
    await saveState(state);
    renderWordList();
  });
});
