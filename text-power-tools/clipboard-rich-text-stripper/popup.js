// PlainStrip — strip rich/formatted text to clean plain text.
// All processing is local. Clipboard is read only on explicit user gesture.

'use strict';

const MAX_HISTORY = 20;
const els = {};

// ---------- Text stripping ----------

/**
 * Convert an HTML string to plain text:
 * block-level tags become newlines, everything else is unwrapped.
 */
function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Replace <br> with newline markers first.
  doc.querySelectorAll('br').forEach(br => br.replaceWith(doc.createTextNode('\n')));
  const BLOCKS = ['p','div','li','h1','h2','h3','h4','h5','h6','tr','blockquote','pre','section','article','header','footer'];
  doc.querySelectorAll(BLOCKS.join(',')).forEach(el => {
    // Prefix block with newline so paragraphs don't merge.
    el.before(doc.createTextNode('\n'));
  });
  return doc.body.textContent || '';
}

/**
 * Normalize plain text per user options.
 */
function normalize(text, opts) {
  let out = text.replace(/\r\n?/g, '\n');
  // Strip zero-width / invisible chars that often sneak in from rich editors.
  out = out.replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (opts.collapseSpaces) out = out.replace(/[ \t]+/g, ' ');
  const lines = out.split('\n').map(l => (opts.trimLines ? l.trim() : l));
  if (opts.collapseBlanks) {
    // Collapse runs of blank lines into one.
    const squashed = [];
    let blank = false;
    for (const l of lines) {
      if (l === '') { if (!blank) squashed.push(l); blank = true; }
      else { squashed.push(l); blank = false; }
    }
    out = squashed.join('\n');
  } else {
    out = lines.join('\n');
  }
  if (opts.trimLines) out = out.replace(/^\n+|\n+$/g, ''); // trim leading/trailing blank lines
  return out;
}

function getOptions() {
  return {
    lineBreaks: els.optLineBreaks.checked,
    trimLines: els.optTrimLines.checked,
    collapseBlanks: els.optCollapseBlanks.checked,
    collapseSpaces: els.optCollapseSpaces.checked,
  };
}

/** Paste / clipboard text -> output. */
function stripText(rawHtml, rawText) {
  let text;
  if (rawHtml && /<[a-z][\s\S]*>/i.test(rawHtml)) {
    text = htmlToText(rawHtml);
  } else {
    text = rawText || '';
  }
  const opts = getOptions();
  if (!opts.lineBreaks) {
    // Flatten everything into space-separated words.
    text = text.replace(/\s*\n\s*/g, ' ');
  }
  const clean = normalize(text, opts);
  els.outputArea.value = clean;
  updateCount();
  return clean;
}

// ---------- UI helpers ----------

let toastTimer;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function updateCount() {
  const n = els.outputArea.value.length;
  els.charCount.textContent = n ? n + ' chars' : '';
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------- History ----------

async function loadHistory() {
  const { history = [] } = await chrome.storage.local.get('history');
  renderHistory(history);
  return history;
}

function renderHistory(history) {
  els.historyList.innerHTML = '';
  els.historyEmpty.style.display = history.length ? 'none' : 'block';
  history.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'history-item';
    const preview = item.text.length > 80 ? item.text.slice(0, 80) + '…' : item.text;
    row.innerHTML =
      '<div style="flex:1;min-width:0">' +
        '<div class="history-text" title="Click to load">' + esc(preview) + '</div>' +
        '<div class="history-meta">' + esc(new Date(item.at).toLocaleString()) +
        ' · ' + item.text.length + ' chars</div>' +
      '</div>' +
      '<button class="history-del" data-i="' + i + '" title="Delete">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>';
    row.querySelector('.history-text').addEventListener('click', () => {
      els.outputArea.value = item.text;
      updateCount();
      toast('Loaded from history');
    });
    row.querySelector('.history-del').addEventListener('click', async () => {
      const h = await loadHistory();
      h.splice(i, 1);
      await chrome.storage.local.set({ history: h });
      renderHistory(h);
    });
    els.historyList.appendChild(row);
  });
}

async function saveToHistory() {
  const text = els.outputArea.value;
  if (!text.trim()) { toast('Nothing to save'); return; }
  const history = await loadHistory();
  history.unshift({ text, at: Date.now() });
  const trimmed = history.slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ history: trimmed });
  renderHistory(trimmed);
  toast('Saved to history');
}

// ---------- Wire up ----------

function init() {
  ['pasteArea','outputArea','optLineBreaks','optTrimLines','optCollapseBlanks','optCollapseSpaces',
   'stripClipboardBtn','clearInputBtn','copyBtn','saveBtn','clearHistoryBtn',
   'historyList','historyEmpty','charCount','toast']
    .forEach(id => { els[id] = document.getElementById(id); });

  // Paste into the rich-text area: prefer the HTML flavor so formatting can be stripped.
  els.pasteArea.addEventListener('paste', (e) => {
    e.preventDefault();
    const dt = e.clipboardData;
    const html = dt ? dt.getData('text/html') : '';
    const text = dt ? dt.getData('text/plain') : '';
    stripText(html, text);
  });

  // Re-strip when options change, if there is input to work from.
  [els.optLineBreaks, els.optTrimLines, els.optCollapseBlanks, els.optCollapseSpaces]
    .forEach(cb => cb.addEventListener('change', () => {
      const raw = els.pasteArea.innerText;
      if (raw.trim()) stripText('', raw);
    }));

  // Explicit-gesture clipboard read only.
  els.stripClipboardBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { toast('Clipboard is empty'); return; }
      els.pasteArea.innerText = text; // show what was read
      stripText('', text);
      toast('Clipboard stripped');
    } catch (err) {
      toast('Clipboard access denied');
    }
  });

  els.clearInputBtn.addEventListener('click', () => {
    els.pasteArea.innerHTML = '';
    els.outputArea.value = '';
    updateCount();
  });

  els.copyBtn.addEventListener('click', async () => {
    const text = els.outputArea.value;
    if (!text) { toast('Nothing to copy'); return; }
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard');
    } catch (err) {
      // Fallback for environments where clipboardWrite is unavailable.
      els.outputArea.select();
      document.execCommand('copy');
      toast('Copied to clipboard');
    }
  });

  els.saveBtn.addEventListener('click', saveToHistory);

  els.clearHistoryBtn.addEventListener('click', async () => {
    if (!confirm('Clear all history?')) return;
    await chrome.storage.local.set({ history: [] });
    renderHistory([]);
  });

  loadHistory();
  updateCount();
}

document.addEventListener('DOMContentLoaded', init);
