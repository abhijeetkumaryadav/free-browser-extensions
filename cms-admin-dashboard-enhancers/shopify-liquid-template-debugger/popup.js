/* ============================================================
   Shopify Liquid Template Debugger — popup logic
   Heuristic static analysis of Liquid templates:
   tag balance, variable/filter inventory, common-mistake
   hints, syntax highlighting. Never executes code.
   All analysis runs on-device.
   ============================================================ */

'use strict';

/* ---------- DOM refs ---------- */
const $ = (id) => document.getElementById(id);
const inputEl = $('input');

/** Escape HTML so pasted code renders as text, never markup. */
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ============================================================
   Tokenizer — finds {% %}, {{ }} (incl. {%- -%} variants)
   with line numbers. String-aware: tags inside quoted
   strings are ignored.
   ============================================================ */

function tokenize(src) {
  const tokens = []; // {type:'tag'|'out', open, close, line, col, raw}
  const lines = src.split('\n');
  let line = 1, col = 0, i = 0, str = null;

  const lineOf = (idx) => src.slice(0, idx).split('\n').length;

  while (i < src.length) {
    const ch = src[i];
    if (ch === '\n') { line++; col = 0; i++; continue; }
    col++;

    // Track quoted strings so "{{" inside a string isn't a tag.
    if (str) {
      if (ch === '\\') { i += 2; col++; continue; }
      if (ch === str) str = null;
      i++; continue;
    }
    if (ch === '"' || ch === "'") { str = ch; i++; continue; }

    if (ch === '{' && (src[i + 1] === '{' || src[i + 1] === '%')) {
      const isTag = src[i + 1] === '%';
      const closer = isTag ? '%}' : '}}';
      const end = src.indexOf(closer, i + 2);
      if (end === -1) {
        tokens.push({
          type: isTag ? 'tag' : 'out', raw: src.slice(i),
          line: lineOf(i), closed: false,
          closerExpected: closer
        });
        break;
      }
      tokens.push({
        type: isTag ? 'tag' : 'out',
        raw: src.slice(i, end + 2),
        line: lineOf(i), closed: true
      });
      // Advance line/col accounting roughly (exactness not critical).
      const skipped = src.slice(i, end + 2).split('\n');
      if (skipped.length > 1) { line += skipped.length - 1; col = skipped[skipped.length - 1].length; }
      i = end + 2;
      continue;
    }
    // Stray closers outside any opener.
    if (ch === '%' && src[i + 1] === '}') {
      tokens.push({ type: 'stray', raw: '%}', line: lineOf(i) });
      i += 2; continue;
    }
    if (ch === '}' && src[i + 1] === '}') {
      tokens.push({ type: 'stray', raw: '}}', line: lineOf(i) });
      i += 2; continue;
    }
    i++;
  }
  return tokens;
}

/** Inner content of a {% ... %} token, trimmed of dashes/whitespace. */
function tagInner(raw) {
  return raw.replace(/^\{%-?/, '').replace(/-?%\}$/, '').trim();
}
/** Inner content of a {{ ... }} token. */
function outInner(raw) {
  return raw.replace(/^\{\{-?/, '').replace(/-?\}\}$/, '').trim();
}
/** First keyword of a tag, e.g. "if", "endfor", "assign". */
function tagName(inner) {
  const m = inner.match(/^([a-zA-Z_][\w-]*)/);
  return m ? m[1].toLowerCase() : '';
}

/* Block openers mapped to their required closers. */
const BLOCK_PAIRS = {
  if: 'endif', unless: 'endunless', for: 'endfor', case: 'endcase',
  capture: 'endcapture', comment: 'endcomment', form: 'endform',
  paginate: 'endpaginate', tablerow: 'endtablerow', raw: 'endraw',
  style: 'endstyle', schema: 'endschema', javascript: 'endjavascript'
};
const BLOCK_CLOSERS = new Set(Object.values(BLOCK_PAIRS));

/* ============================================================
   1) Tag-balance check (with line numbers)
   ============================================================ */

function checkBalance(tokens) {
  const issues = [];
  const stack = [];

  for (const t of tokens) {
    if (t.type === 'stray') {
      issues.push({ sev: 'error', msg: `Line ${t.line}: stray closing "${t.raw}" with no matching opener.` });
      continue;
    }
    if (!t.closed) {
      issues.push({ sev: 'error', msg: `Line ${t.line}: unclosed ${t.type === 'tag' ? '"{% … %}"' : '"{{ … }}"'} — missing "${t.closerExpected}".` });
      continue;
    }
    if (t.type !== 'tag') continue;
    const name = tagName(tagInner(t.raw));
    if (BLOCK_PAIRS[name]) {
      stack.push({ name, closer: BLOCK_PAIRS[name], line: t.line });
    } else if (BLOCK_CLOSERS.has(name)) {
      const open = stack.pop();
      if (!open) {
        issues.push({ sev: 'error', msg: `Line ${t.line}: "{% ${name} %}" has no matching opening tag.` });
      } else if (open.closer !== name) {
        issues.push({ sev: 'error', msg: `Line ${t.line}: "{% ${name} %}" closes "{% ${open.name} %}" opened on line ${open.line} — expected "{% ${open.closer} %}".` });
      }
    } else if (name === 'else' || name === 'elsif' || name === 'when') {
      if (!stack.length || !['if', 'unless', 'case'].includes(stack[stack.length - 1].name)) {
        issues.push({ sev: 'warning', msg: `Line ${t.line}: "{% ${name} %}" appears outside an if/unless/case block.` });
      }
    } else if (name === 'break' || name === 'continue') {
      if (!stack.length || stack[stack.length - 1].name !== 'for') {
        issues.push({ sev: 'warning', msg: `Line ${t.line}: "{% ${name} %}" is only valid inside a for loop.` });
      }
    }
  }

  for (const open of stack) {
    issues.push({ sev: 'error', msg: `Line ${open.line}: "{% ${open.name} %}" is never closed — missing "{% ${open.closer} %}".` });
  }
  if (!issues.length) {
    issues.push({ sev: 'ok', msg: 'All {% %}, {{ }} and block tags are balanced.' });
  }
  return issues;
}

/* ============================================================
   2) Variable / filter / block-tag inventory
   ============================================================ */

function buildInventory(tokens) {
  const vars = new Map();    // name -> count
  const filters = new Map(); // name -> count
  const tags = new Map();    // tag name -> count

  const addVar = (name) => {
    // Keep dotted paths (product.title), drop literals/numbers.
    const m = name.match(/^([a-zA-Z_][\w]*(?:\.[\w-]+|\[[^\]]+\])*)/);
    if (!m || /^(true|false|nil|null|empty|blank)$/.test(m[1])) return;
    if (/^\d/.test(m[1])) return;
    vars.set(m[1], (vars.get(m[1]) || 0) + 1);
  };

  for (const t of tokens) {
    if (!t.closed) continue;
    if (t.type === 'out') {
      const inner = outInner(t.raw);
      const [expr] = inner.split('|').map(s => s.trim());
      addVar(expr);
      for (const f of inner.matchAll(/\|\s*([a-zA-Z_][\w]*)/g)) {
        filters.set(f[1], (filters.get(f[1]) || 0) + 1);
      }
    } else if (t.type === 'tag') {
      const inner = tagInner(t.raw);
      const name = tagName(inner);
      if (name) tags.set(name, (tags.get(name) || 0) + 1);
      // {% assign x = ... %} / {% capture x %}
      let m = inner.match(/^assign\s+([a-zA-Z_][\w]*)/) || inner.match(/^capture\s+([a-zA-Z_][\w]*)/);
      if (m) addVar(m[1]);
      // {% for item in collection.products %}
      m = inner.match(/^for\s+[a-zA-Z_][\w]*\s+in\s+(.+)$/);
      if (m) addVar(m[1].trim());
      // Filters inside tags too: {% assign x = y | filter %}
      for (const f of inner.matchAll(/\|\s*([a-zA-Z_][\w]*)/g)) {
        filters.set(f[1], (filters.get(f[1]) || 0) + 1);
      }
    }
  }
  return { vars, filters, tags };
}

/* ============================================================
   3) Common-mistake hints (heuristic)
   ============================================================ */

function buildHints(src, tokens) {
  const hints = [];
  const seen = new Set();
  const hint = (sev, msg) => { if (!seen.has(msg)) { seen.add(msg); hints.push({ sev, msg }); } };

  for (const t of tokens) {
    if (t.type !== 'tag' || !t.closed) continue;
    const inner = tagInner(t.raw);
    const name = tagName(inner);

    // Single = in a condition (assignment instead of comparison).
    if ((name === 'if' || name === 'elsif' || name === 'unless') && /[^=!<>]=(?!=)/.test(inner)) {
      hint('warning', `Line ${t.line}: single "=" in {% ${name} … %} — Liquid comparisons use "==".`);
    }
    // Nested output tags inside logic tags.
    if (/\{\{/.test(inner)) {
      hint('error', `Line ${t.line}: "{{ … }}" nested inside {% ${name} … %} — never nest output tags in logic tags; use the variable directly.`);
    }
    // Unquoted string literal in comparison / assign.
    if (/^(if|elsif|unless|assign)\b/.test(inner)) {
      const rhs = inner.match(/(?:==|!=|=)\s*([a-zA-Z_][\w-]*)\s*$/);
      if (rhs && !/^(true|false|nil|null|empty|blank)$/.test(rhs[1]) && !BLOCK_CLOSERS.has(rhs[1])) {
        hint('warning', `Line ${t.line}: "${rhs[1]}" looks like a string but isn't quoted — did you mean "${rhs[1]}"?`);
      }
    }
    // Deprecated include tag.
    if (name === 'include') {
      hint('warning', `Line ${t.line}: {% include %} is deprecated — use {% render %} instead (isolated scope, better performance).`);
    }
    // Empty output tag.
    if (t.type === 'tag' && inner === '') {
      hint('warning', `Line ${t.line}: empty {% %} tag — harmless but usually a typo.`);
    }
  }

  // Empty {{ }} anywhere.
  for (const t of tokens) {
    if (t.type === 'out' && t.closed && outInner(t.raw) === '') {
      hint('warning', `Line ${t.line}: empty {{ }} outputs nothing — usually a typo.`);
    }
  }

  // Whitespace-control dashes: {%- without -%} is fine, skip.

  if (!hints.length) hints.push({ sev: 'ok', msg: 'No common mistakes spotted.' });
  return hints;
}

/* ============================================================
   4) Syntax highlighting (escaped first, then token spans)
   ============================================================ */

function highlight(src) {
  const parts = [];
  let last = 0;
  for (const t of tokenize(src)) {
    if (t.type === 'stray') continue;
    const start = src.indexOf(t.raw, last);
    if (start === -1) continue;
    parts.push(esc(src.slice(last, start)));
    const inner = esc(t.raw);
    // Highlight strings inside the token.
    const withStrings = inner.replace(/(&quot;|"|&#39;|')(.*?)(\1)/g, '<span class="tok-str">$1$2$3</span>');
    const cls = t.type === 'tag' ? 'tok-tag' : 'tok-out';
    parts.push(`<span class="${cls}">${withStrings}</span>`);
    last = start + t.raw.length;
  }
  parts.push(esc(src.slice(last)));
  return parts.join('');
}

/* ============================================================
   UI wiring
   ============================================================ */

function renderIssues(listEl, countEl, issues) {
  listEl.innerHTML = '';
  if (countEl) {
    const errors = issues.filter(i => i.sev === 'error').length;
    const warns = issues.filter(i => i.sev === 'warning').length;
    countEl.textContent = issues.length;
    countEl.className = 'count-badge' + (errors ? ' has-errors' : warns ? ' has-warnings' : '');
  }
  for (const i of issues) {
    const li = document.createElement('li');
    li.className = i.sev;
    li.innerHTML = `<span class="sev">${i.sev}</span><span class="msg"></span>`;
    li.querySelector('.msg').textContent = i.msg;
    listEl.appendChild(li);
  }
}

function renderInventory(inv) {
  const fill = (ul, map, emptyMsg) => {
    ul.innerHTML = '';
    const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
      const li = document.createElement('li');
      li.className = 'empty'; li.textContent = emptyMsg;
      ul.appendChild(li); return;
    }
    for (const [name, count] of entries) {
      const li = document.createElement('li');
      const code = document.createElement('code');
      code.textContent = name;
      li.appendChild(code);
      if (count > 1) li.appendChild(document.createTextNode(` ×${count}`));
      ul.appendChild(li);
    }
  };
  fill($('varList'), inv.vars, 'none found');
  fill($('filterList'), inv.filters, 'none found');
  fill($('tagList'), inv.tags, 'none found');
  $('varCount').textContent = inv.vars.size;
  $('filterCount').textContent = inv.filters.size;
}

const SAMPLE = `{% comment %}Product card{% endcomment %}
<div class="card">
  <h2>{{ product.title }}</h2>
  {% if product.available %}
    <p>{{ product.price | money }}</p>
  {% endif %}
  {% for image in product.images limit: 3 %}
    <img src="{{ image | img_url: 'medium' }}" alt="{{ image.alt }}">
  {% endfor %}
</div>`;

$('sampleBtn').addEventListener('click', () => { inputEl.value = SAMPLE; });

$('analyzeBtn').addEventListener('click', () => {
  const src = inputEl.value;
  if (!src.trim()) return;
  const tokens = tokenize(src);

  const issues = checkBalance(tokens);
  renderIssues($('issues'), $('issueCount'), issues);
  $('issuesPanel').hidden = false;

  $('highlighted').innerHTML = highlight(src);
  $('previewPanel').hidden = false;

  renderInventory(buildInventory(tokens));
  $('inventoryPanel').hidden = false;

  renderIssues($('hints'), null, buildHints(src, tokens));
  $('hintsPanel').hidden = false;

  chrome.storage.local.set({ sld_last: src });
});

$('clearBtn').addEventListener('click', () => {
  inputEl.value = '';
  for (const id of ['issuesPanel', 'previewPanel', 'inventoryPanel', 'hintsPanel']) $(id).hidden = true;
});

// Restore last template.
chrome.storage.local.get('sld_last', ({ sld_last }) => {
  if (sld_last) inputEl.value = sld_last;
});

// Cmd/Ctrl+Enter analyzes.
inputEl.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') $('analyzeBtn').click();
});
