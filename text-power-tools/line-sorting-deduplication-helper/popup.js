'use strict';
/**
 * LineSorter — sort, dedupe, shuffle and clean lists of lines.
 * All processing happens locally; nothing is sent anywhere.
 */

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const els = {
  input: $('input'), output: $('output'),
  sortMode: $('sortMode'), dedupeMode: $('dedupeMode'),
  removeBlanks: $('removeBlanks'), trimLines: $('trimLines'),
  apply: $('apply'), reverse: $('reverse'), shuffle: $('shuffle'),
  copy: $('copy'), clear: $('clear'),
  statIn: $('statIn'), statOut: $('statOut'), statDup: $('statDup'),
};

// ---------- pure transforms (testable) ----------
/** Split raw text into a line array (handles \r\n and \n). */
function splitLines(text) {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

/** Natural-sort key: split text into digit/non-digit chunks. */
function naturalKey(s) {
  return String(s).split(/(\d+)/).map((part) =>
    /^\d+$/.test(part) ? { n: parseInt(part, 10), s: null } : { n: null, s: part.toLowerCase() }
  );
}

/** Comparator for a given sort mode. Returns a stable comparator. */
function makeComparator(mode) {
  if (mode === 'az') {
    return (a, b) => a.line.localeCompare(b.line, undefined, { sensitivity: 'base' });
  }
  if (mode === 'za') {
    return (a, b) => b.line.localeCompare(a.line, undefined, { sensitivity: 'base' });
  }
  if (mode === 'natural') {
    return (a, b) => {
      const ka = naturalKey(a.line), kb = naturalKey(b.line);
      for (let i = 0; i < Math.max(ka.length, kb.length); i += 1) {
        const x = ka[i], y = kb[i];
        if (!x) return -1;
        if (!y) return 1;
        if (x.s !== null && y.s !== null && x.s !== y.s) return x.s < y.s ? -1 : 1;
        if (x.n !== null && y.n !== null && x.n !== y.n) return x.n - y.n;
        if ((x.s !== null) !== (y.s !== null)) return x.s !== null ? -1 : 1;
      }
      return 0;
    };
  }
  if (mode === 'numeric') {
    return (a, b) => {
      const na = parseFloat(a.line), nb = parseFloat(b.line);
      const aNum = Number.isFinite(na), bNum = Number.isFinite(nb);
      if (aNum && bNum) return na - nb;
      if (aNum) return -1;
      if (bNum) return 1;
      return a.line.localeCompare(b.line, undefined, { sensitivity: 'base' });
    };
  }
  return null;
}

/** Dedupe key for a given mode. Returns null to keep everything. */
function dedupeKey(line, mode) {
  if (mode === 'exact') return line;
  if (mode === 'ignoreCase') return line.toLowerCase();
  if (mode === 'trim') return line.trim();
  return null;
}

/**
 * Apply the transform pipeline.
 * Returns { lines, removed } where removed = inputCount - outputCount.
 */
function transform(lines, opts) {
  let work = lines.slice();
  const inputCount = work.length;

  if (opts.trimLines) work = work.map((l) => l.trim());
  if (opts.removeBlanks) work = work.filter((l) => l.length > 0);

  if (opts.dedupeMode !== 'none') {
    const seen = new Set();
    work = work.filter((l) => {
      const k = dedupeKey(l, opts.dedupeMode);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  const cmp = makeComparator(opts.sortMode);
  if (cmp) {
    // stable sort: decorate with original index
    work = work
      .map((line, i) => ({ line, i }))
      .sort((a, b) => cmp(a, b) || a.i - b.i)
      .map((d) => d.line);
  }

  return { lines: work, removed: inputCount - work.length };
}

/** Fisher–Yates shuffle (returns a new array). */
function shuffled(lines) {
  const a = lines.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Reversed copy. */
function reversed(lines) {
  return lines.slice().reverse();
}

// ---------- UI ----------
function readOpts() {
  return {
    sortMode: els.sortMode.value,
    dedupeMode: els.dedupeMode.value,
    removeBlanks: els.removeBlanks.checked,
    trimLines: els.trimLines.checked,
  };
}

function renderStats(inputCount, outputCount, removed) {
  els.statIn.textContent = inputCount;
  els.statOut.textContent = outputCount;
  els.statDup.textContent = removed;
}

function runPipeline() {
  const lines = splitLines(els.input.value);
  const { lines: out, removed } = transform(lines, readOpts());
  els.output.value = out.join('\n');
  renderStats(lines.length, out.length, removed);
  return out;
}

function applyAndPersist() {
  runPipeline();
  saveState();
}

// Buttons: reverse/shuffle act on the current output (or input if output is empty).
function currentLines() {
  const src = els.output.value.trim() ? els.output.value : els.input.value;
  return splitLines(src);
}

els.apply.addEventListener('click', applyAndPersist);
els.reverse.addEventListener('click', () => {
  const out = reversed(currentLines());
  els.output.value = out.join('\n');
  renderStats(splitLines(els.input.value).length, out.length, 0);
  saveState();
});
els.shuffle.addEventListener('click', () => {
  const out = shuffled(currentLines());
  els.output.value = out.join('\n');
  renderStats(splitLines(els.input.value).length, out.length, 0);
  saveState();
});
els.copy.addEventListener('click', async () => {
  if (!els.output.value) return;
  try {
    await navigator.clipboard.writeText(els.output.value);
    flash(els.copy, 'Copied ✓');
  } catch (e) {
    els.output.select();
    document.execCommand('copy');
    flash(els.copy, 'Copied ✓');
  }
});
els.clear.addEventListener('click', () => {
  els.input.value = '';
  els.output.value = '';
  renderStats(0, 0, 0);
  saveState();
});

/** Brief label flash on a button to confirm an action. */
function flash(btn, text) {
  const orig = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = orig; }, 1200);
}

// Live transform while typing (debounced) so stats stay fresh.
let debounce = null;
els.input.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(runPipeline, 250);
});

// ---------- persisted state ----------
const STORE_KEY = 'linesorter-state';
function saveState() {
  chrome.storage.local.set({
    [STORE_KEY]: {
      input: els.input.value,
      output: els.output.value,
      opts: readOpts(),
    },
  });
}
function restoreState() {
  chrome.storage.local.get(STORE_KEY, (res) => {
    const s = res[STORE_KEY];
    if (!s) return;
    els.input.value = s.input || '';
    els.output.value = s.output || '';
    if (s.opts) {
      els.sortMode.value = s.opts.sortMode || 'none';
      els.dedupeMode.value = s.opts.dedupeMode || 'none';
      els.removeBlanks.checked = s.opts.removeBlanks !== false;
      els.trimLines.checked = !!s.opts.trimLines;
    }
    renderStats(
      splitLines(els.input.value).length,
      els.output.value ? splitLines(els.output.value).length : 0,
      0
    );
  });
}

restoreState();
