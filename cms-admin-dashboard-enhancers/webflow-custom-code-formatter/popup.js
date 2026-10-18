/* ============================================================
   Webflow Custom Code Formatter — popup logic
   Pure dev tool: formats, validates and minifies pasted
   HTML/CSS/JS. Never executes the code. 100% on-device.
   ============================================================ */

'use strict';

/* ---------- DOM refs ---------- */
const $ = (id) => document.getElementById(id);
const inputEl = $('input'), outputEl = $('output');
const issuesPanel = $('issuesPanel'), issuesEl = $('issues'), issueCount = $('issueCount');

let mode = 'html'; // html | css | js | auto

/* ---------- Small helpers ---------- */

/** Show a transient toast message. */
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1600);
}

/** Update char/line stats under the output box. */
function updateStats(text) {
  $('statChars').textContent = `${text.length.toLocaleString()} chars`;
  $('statLines').textContent = `${text ? text.split('\n').length : 0} lines`;
}

/** Render validation issues. Each issue: {sev:'error'|'warning'|'ok', msg}. */
function renderIssues(issues) {
  issuesPanel.hidden = false;
  issuesEl.innerHTML = '';
  const errors = issues.filter(i => i.sev === 'error').length;
  const warns = issues.filter(i => i.sev === 'warning').length;
  issueCount.textContent = issues.length;
  issueCount.className = 'count-badge' + (errors ? ' has-errors' : warns ? ' has-warnings' : '');
  for (const i of issues) {
    const li = document.createElement('li');
    li.className = i.sev;
    const sev = document.createElement('span');
    sev.className = 'sev';
    sev.textContent = i.sev;
    const msg = document.createElement('span');
    msg.className = 'msg';
    msg.textContent = i.msg;
    li.append(sev, msg);
    issuesEl.appendChild(li);
  }
}

/** Guess language from content. */
function detectMode(src) {
  const s = src.trim();
  if (/^\s*</.test(s) || /<\/[a-zA-Z][^>]*>\s*$/.test(s)) return 'html';
  if (/^\s*[{.#@a-zA-Z-]/.test(s) && /{[^}]*:[^}]*}/.test(s)) return 'css';
  if (/\b(function|const|let|var|=>|import|export)\b/.test(s)) return 'js';
  return 'html';
}

const activeMode = () => (mode === 'auto' ? detectMode(inputEl.value) : mode);

/* ============================================================
   HTML — tokenize-based beautifier + stack validator
   ============================================================ */

const VOID_ELEMENTS = new Set([
  'area','base','br','col','embed','hr','img','input','link','meta',
  'param','source','track','wbr','circle','ellipse','line','path',
  'polygon','polyline','rect','stop','use'
]);

function htmlTokens(src) {
  // Split into tags and text chunks (comments kept as single tokens).
  return src.match(/<!--[\s\S]*?-->|<\/?[a-zA-Z!][^>]*>|[^<]+/g) || [];
}

function formatHTML(src) {
  const out = [];
  let indent = 0;
  for (let raw of htmlTokens(src)) {
    const tok = raw.trim();
    if (!tok) continue;
    if (tok.startsWith('<!--')) {
      out.push('  '.repeat(indent) + tok);
    } else if (tok.startsWith('</')) {
      indent = Math.max(0, indent - 1);
      out.push('  '.repeat(indent) + tok);
    } else if (tok.startsWith('<')) {
      const name = (tok.match(/^<([a-zA-Z][\w-]*)/) || [])[1];
      const selfClose = tok.endsWith('/>') || (name && VOID_ELEMENTS.has(name.toLowerCase()));
      out.push('  '.repeat(indent) + tok);
      if (!selfClose) indent++;
    } else {
      // Collapse internal whitespace of text nodes.
      out.push('  '.repeat(indent) + tok.replace(/\s+/g, ' '));
    }
  }
  return out.join('\n');
}

function validateHTML(src) {
  const issues = [];
  const stack = [];
  const lines = src.split('\n');
  lines.forEach((line, li) => {
    for (const m of line.matchAll(/<!--[\s\S]*?-->|<\/?([a-zA-Z][\w-]*)[^>]*?(\/?)>/g)) {
      const full = m[0], name = m[1].toLowerCase(), selfClose = m[2] === '/';
      if (full.startsWith('<!--')) continue;
      if (full.startsWith('</')) {
        if (stack.length === 0) {
          issues.push({ sev: 'error', msg: `Line ${li + 1}: stray closing tag </${name}> with nothing open.` });
        } else {
          const open = stack.pop();
          if (open.name !== name) {
            issues.push({ sev: 'error', msg: `Line ${li + 1}: </${name}> closes <${open.name}> opened on line ${open.line} — mismatched.` });
          }
        }
      } else if (!selfClose && !VOID_ELEMENTS.has(name)) {
        stack.push({ name, line: li + 1 });
      }
    }
  });
  for (const open of stack) {
    issues.push({ sev: 'error', msg: `Line ${open.line}: <${open.name}> is never closed.` });
  }
  if (!issues.length) issues.push({ sev: 'ok', msg: 'All tags are balanced. Looks good.' });
  return issues;
}

/* ============================================================
   CSS / JS — brace-based beautifier (string/comment aware)
   ============================================================ */

/** Iterate source while tracking strings/comments; cb(char, ctx). */
function walkCode(src, cb) {
  let str = null, lineComment = false, blockComment = false, escaped = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i], next = src[i + 1] || '';
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      cb(ch, { code: false }); continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; cb(ch, { code: false }); cb(next, { code: false }); i++; continue; }
      cb(ch, { code: false }); continue;
    }
    if (str) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === str) str = null;
      cb(ch, { code: false }); continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; cb(ch, { code: false }); continue; }
    if (ch === '/' && next === '*') { blockComment = true; cb(ch, { code: false }); continue; }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; cb(ch, { code: false }); continue; }
    cb(ch, { code: true });
  }
}

function formatBraces(src, { newlineAfterSemicolon = true } = {}) {
  // First pass: normalize whitespace around structural tokens.
  let out = '', indent = 0, atLineStart = true;
  const pushIndent = () => { out += '  '.repeat(indent); atLineStart = true; };
  walkCode(src, (ch, { code }) => {
    if (!code) { out += ch; atLineStart = false; return; }
    if (ch === '{') { out += (atLineStart ? '' : ' ') + '{\n'; indent++; pushIndent(); return; }
    if (ch === '}') {
      indent = Math.max(0, indent - 1);
      out = out.replace(/[ \t]+$/, '') + '\n' + '  '.repeat(indent) + '}';
      // Lookahead: keep "} else {" on track by letting next tokens flow.
      atLineStart = false; out += '\n'; pushIndent(); return;
    }
    if (ch === ';' && newlineAfterSemicolon) { out += ';\n'; pushIndent(); return; }
    if (ch === '\n') { out = out.replace(/[ \t]+$/, ''); pushIndent(); return; }
    if (/\s/.test(ch)) { if (!atLineStart && !out.endsWith(' ') && !out.endsWith('\n')) out += ' '; return; }
    if (atLineStart && out.endsWith('  '.repeat(indent))) { /* already indented */ }
    out += ch; atLineStart = false;
  });
  // Tidy: collapse 3+ blank lines, trim trailing spaces, drop empty lines at edges.
  return out.split('\n').map(l => l.replace(/[ \t]+$/, ''))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

const formatCSS = (src) => formatBraces(src);
const formatJS = (src) => formatBraces(src);

function validateBraces(src, label) {
  const issues = [];
  const stack = [];
  let line = 1, str = null, lineComment = false, blockComment = false, escaped = false;
  const pairs = { '}': '{', ')': '(', ']': '[' };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i], next = src[i + 1] || '';
    if (ch === '\n') line++;
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (str) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === str) str = null;
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; continue; }
    if (ch === '/' && next === '*') { blockComment = true; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
    if ('{(['.includes(ch)) stack.push({ ch, line });
    if ('})]'.includes(ch)) {
      const open = stack.pop();
      if (!open) issues.push({ sev: 'error', msg: `Line ${line}: stray closing "${ch}" with nothing open.` });
      else if (open.ch !== pairs[ch]) issues.push({ sev: 'error', msg: `Line ${line}: "${ch}" closes "${open.ch}" opened on line ${open.line} — mismatched.` });
    }
  }
  if (str) issues.push({ sev: 'error', msg: `Unterminated string (${str}) — a quote was never closed.` });
  if (blockComment) issues.push({ sev: 'error', msg: 'Unterminated block comment (/* …).' });
  for (const open of stack) issues.push({ sev: 'error', msg: `Line ${open.line}: "${open.ch}" is never closed.` });
  if (!issues.length) issues.push({ sev: 'ok', msg: `${label} brackets, braces and parens are balanced.` });
  return issues;
}

/* ============================================================
   Minify — string-aware whitespace collapse (safe, simple)
   ============================================================ */

function minifyCode(src) {
  // String/comment-aware pass: track the input index so we can peek
  // at the true next character when deciding to keep a space.
  let out = '';
  let str = null, lineComment = false, blockComment = false, escaped = false;
  const isWord = (c) => /[\w$]/.test(c || '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i], next = src[i + 1] || '';
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; i++; }
      continue;
    }
    if (str) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === str) str = null;
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; out += ch; continue; }
    if (/\s/.test(ch)) {
      // Keep one space only between two word characters (var s, not "a  b").
      const prev = out[out.length - 1] || '';
      let j = i + 1;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (isWord(prev) && isWord(src[j])) out += ' ';
      continue;
    }
    out += ch;
  }
  return out;
}

function minifyHTML(src) {
  // Remove comments, collapse whitespace between tags, trim text nodes.
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* ============================================================
   UI wiring
   ============================================================ */

// Mode tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    mode = tab.dataset.mode;
    chrome.storage.local.set({ wccf_mode: mode });
  });
});
chrome.storage.local.get('wccf_mode', ({ wccf_mode }) => {
  if (wccf_mode && document.querySelector(`.tab[data-mode="${wccf_mode}"]`)) {
    document.querySelector(`.tab[data-mode="${wccf_mode}"]`).click();
  }
});

function run(kind) {
  const src = inputEl.value;
  if (!src.trim()) { toast('Paste some code first'); return; }
  const m = activeMode();
  try {
    let result, issues;
    if (m === 'html') {
      result = kind === 'format' ? formatHTML(src) : minifyHTML(src);
      issues = validateHTML(src);
    } else if (m === 'css') {
      result = kind === 'format' ? formatCSS(src) : minifyCode(src);
      issues = validateBraces(src, 'CSS');
    } else {
      result = kind === 'format' ? formatJS(src) : minifyCode(src);
      issues = validateBraces(src, 'JS');
    }
    outputEl.value = result;
    updateStats(result);
    renderIssues(issues);
    chrome.storage.local.set({ wccf_last: src });
    toast(kind === 'format' ? 'Formatted' : 'Minified');
  } catch (err) {
    renderIssues([{ sev: 'error', msg: `Could not process: ${err.message}` }]);
  }
}

$('formatBtn').addEventListener('click', () => run('format'));
$('minifyBtn').addEventListener('click', () => run('minify'));
$('clearBtn').addEventListener('click', () => {
  inputEl.value = ''; outputEl.value = '';
  issuesPanel.hidden = true; updateStats('');
});

$('copyBtn').addEventListener('click', async () => {
  if (!outputEl.value) { toast('Nothing to copy'); return; }
  try {
    await navigator.clipboard.writeText(outputEl.value);
    toast('Copied to clipboard');
  } catch {
    outputEl.select();
    document.execCommand('copy');
    toast('Copied to clipboard');
  }
});

$('pasteBtn').addEventListener('click', async () => {
  try {
    inputEl.value = await navigator.clipboard.readText();
    toast('Pasted');
  } catch {
    toast('Clipboard read blocked — paste manually');
  }
});

// Restore last input for convenience.
chrome.storage.local.get('wccf_last', ({ wccf_last }) => {
  if (wccf_last) inputEl.value = wccf_last;
});

// Keyboard shortcut: Cmd/Ctrl+Enter formats.
inputEl.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run('format');
});
