/* Essay Clarity Checker — popup.js
 * Two input paths: (1) explicit click injects content.js into the active tab
 * and analyzes the returned page text; (2) the user pastes text directly.
 * Analysis itself lives in analyzer.js (dependency-free heuristics).
 * No data ever leaves the browser.
 */

const $ = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Escape then wrap the matched phrase in <mark>. */
function markPhrase(sentence, phrase) {
  const idx = sentence.toLowerCase().indexOf(String(phrase).toLowerCase());
  if (idx < 0) return esc(sentence);
  return esc(sentence.slice(0, idx)) +
    '<mark>' + esc(sentence.slice(idx, idx + phrase.length)) + '</mark>' +
    esc(sentence.slice(idx + phrase.length));
}

/** Render a list of issues into a <ul>; shows a "none" note when empty. */
function renderList(elId, items, formatItem, noneText) {
  const ul = $(elId);
  ul.innerHTML = '';
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'none-msg';
    li.textContent = noneText;
    ul.appendChild(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement('li');
    li.innerHTML = formatItem(item);
    ul.appendChild(li);
  }
}

/** Show full analysis results in the popup. */
function showResults(result) {
  $('#st-words').textContent = result.wordCount;
  $('#st-sents').textContent = result.sentenceCount;
  $('#st-passive').textContent = result.passive.length;
  $('#st-cliche').textContent = result.cliches.length;
  $('#c-passive').textContent = result.passive.length;
  $('#c-cliche').textContent = result.cliches.length;
  $('#c-long').textContent = result.longSentences.length;
  $('#c-hedge').textContent = result.hedges.length;

  renderList('#list-passive', result.passive.slice(0, 60),
    (p) => `<mark>${esc(p.phrase)}</mark>`,
    'No passive constructions detected.');

  renderList('#list-cliche', result.cliches.slice(0, 60),
    (c) => `<mark>${esc(c.phrase)}</mark>`,
    'No bundled clichés detected.');

  renderList('#list-long', result.longSentences.slice(0, 40),
    (s) => `<span class="idx">S${s.sentence} · ${s.words}w</span>${esc(s.text.slice(0, 160))}${s.text.length > 160 ? '…' : ''}`,
    'No long sentences.');

  renderList('#list-hedge', result.hedges.slice(0, 40),
    (h) => `<span class="idx">S${h.sentence}</span>${markPhrase(h.text, h.words[0])}`,
    'No heavy hedging stacks.');

  $('#results').classList.remove('hidden');
  $('#status').textContent =
    result.wordCount === 0
      ? 'No text found to analyze.'
      : `Analyzed ${result.wordCount} words — review the flags above.`;
}

/** Run analysis on a text string. */
function analyzeText(text) {
  if (typeof analyze !== 'function') {
    $('#status').textContent = 'Analyzer failed to load.';
    return;
  }
  if (!text || !text.trim()) {
    $('#status').textContent = 'No text to analyze.';
    $('#results').classList.add('hidden');
    return;
  }
  showResults(analyze(text, { longAt: 30 }));
}

/** Fetch page text via an explicit-click injection. */
async function analyzePage() {
  $('#status').textContent = 'Reading page…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('no active tab');
    const url = tab.url || '';
    if (!/^https?:|^file:|^about:blank/.test(url)) {
      $('#status').textContent = 'Cannot analyze this page (browser/system page).';
      return;
    }
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
    const text = res && res.result ? String(res.result) : '';
    if (!text.trim()) {
      $('#status').textContent = 'No readable text found on this page.';
      return;
    }
    analyzeText(text);
  } catch (err) {
    $('#status').textContent = 'Could not read this page. Try pasting text instead.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('#from-page').addEventListener('click', analyzePage);

  $('#from-paste').addEventListener('click', () => {
    $('#paste-box').classList.toggle('hidden');
    if (!$('#paste-box').classList.contains('hidden')) $('#paste-box').focus();
  });

  $('#paste-box').addEventListener('input', (e) => {
    // Debounce: analyze 400ms after the user stops typing.
    clearTimeout(window.__deb);
    window.__deb = setTimeout(() => analyzeText(e.target.value), 400);
  });
});
