/* Beautify — heuristic code formatter (own engine, NOT Prettier).
   Strategy: scan char-by-char tracking strings/comments/parens, then
   break lines around { } ; and indent by brace depth. JSON is handled
   by native parse + stringify. CSS gets a brace/semicolon pass. */

'use strict';

/* ---------- shared brace-aware formatter ---------- */
function formatBraces(src, unit) {
  const lines = [];
  let buf = '';
  let depth = 0, paren = 0;
  let sq = false, dq = false, tpl = false;   // string states
  let lc = false, bc = false;                // // and /* */ comments
  let esc = false;

  const flush = () => { if (buf.trim() !== '') lines.push(buf.trimEnd()); buf = ''; };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i], nx = src[i + 1];

    if (esc) { buf += ch; esc = false; continue; }

    // comments
    if (!sq && !dq && !tpl) {
      if (!lc && !bc && ch === '/' && nx === '/') { lc = true; buf += ch; continue; }
      if (!lc && !bc && ch === '/' && nx === '*') { bc = true; buf += ch; continue; }
    }
    if (lc) { buf += ch; if (ch === '\n') { lc = false; flush(); } continue; }
    if (bc) { buf += ch; if (ch === '*' && nx === '/') { buf += nx; i++; bc = false; } continue; }

    // strings
    if (ch === '\\' && (sq || dq || tpl)) { buf += ch; esc = true; continue; }
    if (ch === "'" && !dq && !tpl) { sq = !sq; buf += ch; continue; }
    if (ch === '"' && !sq && !tpl) { dq = !dq; buf += ch; continue; }
    if (ch === '`' && !sq && !dq) { tpl = !tpl; buf += ch; continue; }
    if (sq || dq || tpl) { buf += ch; continue; }

    // parens guard `for (;;)` — don't break lines inside parens
    if (ch === '(') paren++;
    if (ch === ')') paren = Math.max(0, paren - 1);

    if (ch === '{') {
      if (buf.trim()) buf += ' ';
      buf += ch; depth++;
      lines.push(unit.repeat(depth - 1) + buf.trim());
      buf = '';
      continue;
    }
    if (ch === '}') {
      flush();
      depth = Math.max(0, depth - 1);
      buf = ch;
      // keep `} else {` / `} catch {` together on one line
      const rest = src.slice(i + 1).trimStart();
      if (/^(else|catch|finally|while)\b/.test(rest)) {
        buf += ' ';
      } else {
        lines.push(unit.repeat(depth) + buf.trim());
        buf = '';
      }
      continue;
    }
    if (ch === ';') {
      buf += ch;
      if (paren === 0) { lines.push(unit.repeat(depth) + buf.trim()); buf = ''; }
      continue;
    }
    if (ch === '\n') {
      if (buf.trim()) lines.push(unit.repeat(depth) + buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  flush();

  // collapse runs of blank lines
  return lines.filter((l, i) => l.trim() !== '' || lines[i - 1]?.trim() !== '').join('\n');
}

/* ---------- language entry points ---------- */
function formatJSON(src, unit) {
  const obj = JSON.parse(src);               // throws with message on invalid
  const indent = unit === '\t' ? '\t' : unit.length;
  return JSON.stringify(obj, null, indent);
}

function formatJS(src, unit) {
  return formatBraces(src, unit);
}

function formatCSS(src, unit) {
  return formatBraces(src, unit);
}

/* ---------- popup wiring ---------- */
const $ = (id) => document.getElementById(id);
const els = { input: $('input'), output: $('output'), status: $('status'),
              lang: $('lang'), indent: $('indent') };

function indentUnit() {
  return els.indent.value === 'tab' ? '\t' : ' '.repeat(Number(els.indent.value));
}

function showStatus(msg, ok) {
  els.status.hidden = false;
  els.status.textContent = msg;
  els.status.classList.toggle('ok', !!ok);
}

function beautify() {
  const src = els.input.value;
  if (!src.trim()) { showStatus('Paste some code first.', false); return; }
  const unit = indentUnit();
  try {
    let out;
    if (els.lang.value === 'json') out = formatJSON(src, unit);
    else if (els.lang.value === 'css') out = formatCSS(src, unit);
    else out = formatJS(src, unit);
    els.output.textContent = out;
    showStatus('Formatted ✓ (heuristic — review before shipping)', true);
  } catch (err) {
    showStatus('Error: ' + err.message, false);
  }
}

els.format.addEventListener('click', beautify);
els.clear.addEventListener('click', () => {
  els.input.value = '';
  els.output.textContent = 'Formatted code appears here.';
  els.status.hidden = true;
  chrome.storage.local.remove('beautifyDraft');
});
els.copy.addEventListener('click', async () => {
  const text = els.output.textContent;
  if (!text || text === 'Formatted code appears here.') return;
  await navigator.clipboard.writeText(text);
  document.getElementById('copyLabel').textContent = 'Copied ✓';
  setTimeout(() => { document.getElementById('copyLabel').textContent = 'Copy'; }, 1200);
});

// autosave draft (debounced)
let t;
els.input.addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(() => chrome.storage.local.set({
    beautifyDraft: { input: els.input.value, lang: els.lang.value, indent: els.indent.value }
  }), 400);
});
els.lang.addEventListener('change', () => els.input.dispatchEvent(new Event('input')));
els.indent.addEventListener('change', () => els.input.dispatchEvent(new Event('input')));

// restore draft
chrome.storage.local.get('beautifyDraft', ({ beautifyDraft: d }) => {
  if (!d) return;
  els.input.value = d.input || '';
  if (d.lang) els.lang.value = d.lang;
  if (d.indent) els.indent.value = d.indent;
});
