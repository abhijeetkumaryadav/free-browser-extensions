/* =====================================================================
 * FormulaLint — popup logic
 * Pure on-device formula linter. No network, no remote code.
 * Checks: leading "=", paren balance, quote balance, function-name
 * spelling (with Levenshtein did-you-mean), argument counts, and
 * common mistakes (semicolons, doubled operators, empty args…).
 * ===================================================================== */
'use strict';

/* ------------------------------------------------------------------ */
/* Function catalog: [NAME, minArgs, maxArgs] (Infinity = variadic).   */
/* Covers ~200 common Excel & Google Sheets functions.                 */
/* ------------------------------------------------------------------ */
const FUNCTIONS = [
  ['ABS',1,1],['ACOS',1,1],['ACOSH',1,1],['ACOT',1,1],['ACOTH',1,1],
  ['ADDRESS',2,5],['AGGREGATE',3,19],['AND',1,Infinity],['ARABIC',1,1],
  ['ASIN',1,1],['ASINH',1,1],['ATAN',1,1],['ATAN2',2,2],['ATANH',1,1],
  ['AVERAGE',1,Infinity],['AVERAGEA',1,Infinity],['AVERAGEIF',2,3],
  ['AVERAGEIFS',3,Infinity],['BASE',2,3],['BIN2DEC',1,1],['BIN2HEX',1,2],
  ['BIN2OCT',1,2],['CEILING',2,2],['CEILING.MATH',1,3],['CELL',1,2],
  ['CHAR',1,1],['CHOOSE',2,Infinity],['CLEAN',1,1],['CODE',1,1],
  ['COLUMN',0,1],['COLUMNS',1,1],['COMBIN',2,2],['COMBINA',2,2],
  ['CONCAT',1,Infinity],['CONCATENATE',1,Infinity],['CORREL',2,2],
  ['COS',1,1],['COSH',1,1],['COT',1,1],['COTH',1,1],['COUNT',1,Infinity],
  ['COUNTA',1,Infinity],['COUNTBLANK',1,1],['COUNTIF',2,2],
  ['COUNTIFS',2,Infinity],['COVAR',2,2],['COVARIANCE.P',2,2],
  ['COVARIANCE.S',2,2],['DATE',3,3],['DATEDIF',3,3],['DATEVALUE',1,1],
  ['DAY',1,1],['DAYS',2,2],['DAYS360',2,3],['DEC2BIN',1,2],['DEC2HEX',1,2],
  ['DEC2OCT',1,2],['DECIMAL',2,2],['DEGREES',1,1],['DOLLAR',1,2],
  ['EDATE',2,2],['EFFECT',2,2],['EOMONTH',2,2],['EVEN',1,1],['EXACT',2,2],
  ['EXP',1,1],['FALSE',0,0],['FILTER',2,3],['FIND',2,3],['FIXED',1,3],
  ['FLOOR',2,2],['FLOOR.MATH',1,3],['FORECAST',3,3],['FORMULATEXT',1,1],
  ['FV',3,5],['GCD',1,Infinity],['GEOMEAN',1,Infinity],['HARMEAN',1,Infinity],
  ['HEX2BIN',1,2],['HEX2DEC',1,1],['HEX2OCT',1,2],['HLOOKUP',3,4],
  ['HOUR',1,1],['HYPERLINK',1,2],['IF',2,3],['IFERROR',2,2],['IFNA',2,2],
  ['IFS',2,Infinity],['INDEX',2,4],['INT',1,1],['IPMT',4,6],['IRR',1,2],
  ['ISBLANK',1,1],['ISERROR',1,1],['ISEVEN',1,1],['ISFORMULA',1,1],
  ['ISLOGICAL',1,1],['ISNA',1,1],['ISNONTEXT',1,1],['ISNUMBER',1,1],
  ['ISODD',1,1],['ISREF',1,1],['ISTEXT',1,1],['KURT',1,Infinity],
  ['LARGE',2,2],['LCM',1,Infinity],['LEFT',1,2],['LEN',1,1],['LET',3,Infinity],
  ['LN',1,1],['LOG',1,2],['LOG10',1,1],['LOWER',1,1],['MATCH',2,3],
  ['MAX',1,Infinity],['MAXA',1,Infinity],['MAXIFS',3,Infinity],
  ['MEDIAN',1,Infinity],['MID',3,3],['MIN',1,Infinity],['MINA',1,Infinity],
  ['MINIFS',3,Infinity],['MINUTE',1,1],['MOD',2,2],['MONTH',1,1],
  ['MROUND',2,2],['N',1,1],['NA',0,0],['NETWORKDAYS',2,3],['NOMINAL',2,2],
  ['NOT',1,1],['NOW',0,0],['NPER',3,5],['NPV',2,Infinity],['OCT2BIN',1,2],
  ['OCT2DEC',1,1],['OCT2HEX',1,2],['ODD',1,1],['OFFSET',3,5],['OR',1,Infinity],
  ['PERCENTILE',2,2],['PERCENTRANK',2,3],['PI',0,0],['PMT',3,5],
  ['POWER',2,2],['PPMT',4,6],['PRODUCT',1,Infinity],['PROPER',1,1],
  ['PV',3,5],['QUARTILE',2,2],['RADIANS',1,1],['RAND',0,0],
  ['RANDBETWEEN',2,2],['RANK',2,3],['RATE',3,6],['REPLACE',4,4],
  ['REPT',2,2],['RIGHT',1,2],['ROMAN',1,2],['ROUND',2,2],
  ['ROUNDDOWN',2,2],['ROUNDUP',2,2],['ROW',0,1],['ROWS',1,1],
  ['SEARCH',2,3],['SECOND',1,1],['SHEET',0,1],['SHEETS',0,1],
  ['SIGN',1,1],['SIN',1,1],['SINH',1,1],['SKEW',1,Infinity],
  ['SLN',3,3],['SMALL',2,2],['SORT',1,4],['SQRT',1,1],['SQRTPI',1,1],
  ['STDEV',1,Infinity],['STDEVA',1,Infinity],['STDEV.P',1,Infinity],
  ['STDEV.S',1,Infinity],['STDEVP',1,Infinity],['SUBSTITUTE',3,4],
  ['SUBTOTAL',2,Infinity],['SUM',1,Infinity],['SUMIF',2,3],
  ['SUMIFS',3,Infinity],['SUMPRODUCT',1,Infinity],['SUMSQ',1,Infinity],
  ['SWITCH',3,Infinity],['SYD',4,4],['T',1,1],['TAN',1,1],['TANH',1,1],
  ['TEXT',2,2],['TEXTJOIN',3,Infinity],['TIME',3,3],['TIMEVALUE',1,1],
  ['TODAY',0,0],['TRANSPOSE',1,1],['TREND',1,4],['TRIM',1,1],
  ['TRUE',0,0],['TRUNC',1,2],['TYPE',1,1],['UNIQUE',1,3],
  ['UPPER',1,1],['VALUE',1,1],['VAR',1,Infinity],['VARA',1,Infinity],
  ['VAR.P',1,Infinity],['VAR.S',1,Infinity],['VARP',1,Infinity],
  ['VLOOKUP',3,4],['WEEKDAY',1,2],['WEEKNUM',1,2],['WORKDAY',2,3],
  ['XIRR',2,3],['XLOOKUP',3,6],['XNPV',3,3],['XOR',1,Infinity],
  ['YEAR',1,1],['YEARFRAC',2,3],['ARRAYFORMULA',1,1],['QUERY',1,3],
  ['IMPORTRANGE',2,2],['GOOGLEFINANCE',1,4],['SPARKLINE',1,4],
  ['SORTN',2,4],['FLATTEN',1,Infinity],['SEQUENCE',1,4],['RANDARRAY',0,2],
  ['REGEXMATCH',2,2],['REGEXEXTRACT',2,2],['REGEXREPLACE',3,3],
  ['SPLIT',2,4],['JOIN',2,Infinity],['COUNTUNIQUE',1,Infinity],
];
const FN = new Map(FUNCTIONS.map(f => [f[0], { min: f[1], max: f[2] }]));

/* ---------------- Levenshtein distance (did-you-mean) --------------- */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function suggest(name) {
  let best = null, bestD = 3; // only suggest close matches
  for (const fn of FN.keys()) {
    const d = levenshtein(name, fn);
    if (d < bestD) { bestD = d; best = fn; }
  }
  return best;
}

/* ------------------------- Token scanner ---------------------------- */
/* Walk the formula, skipping string literals, tracking parens and      */
/* identifying tokens: NAME(  function calls. Returns issues + calls.  */
function scan(formula) {
  const issues = [];
  const calls = [];            // {name, argCount, col, hasContent}
  const stack = [];            // open-paren frames {col, fn, args, content, inString…}
  let inStr = false, strCol = 0, i = 0;
  const n = formula.length;

  // Track semicolons outside strings.
  let sawSemicolon = false;

  while (i < n) {
    const ch = formula[i];

    if (inStr) {
      if (ch === '"') {
        // "" is an escaped quote in Excel.
        if (formula[i + 1] === '"') { i += 2; continue; }
        inStr = false;
      }
      i++; continue;
    }
    if (ch === '"') { inStr = true; strCol = i; i++; continue; }

    if (ch === ';') sawSemicolon = true;

    if (ch === '(') {
      // Look back for the token immediately before '('.
      let j = i - 1;
      while (j >= 0 && /\s/.test(formula[j])) j--;
      let end = j;
      while (j >= 0 && /[A-Za-z0-9_.$]/.test(formula[j])) j--;
      const word = formula.slice(j + 1, end + 1);
      let fn = null;
      if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(word)) {
        // Strip sheet qualifiers: Sheet1!SUM -> SUM.
        const bare = word.split('!').pop().toUpperCase();
        fn = { name: bare, raw: word, col: j + 1 };
      }
      stack.push({ col: i, fn, args: 1, content: false, depth: stack.length });
      i++; continue;
    }
    if (ch === ')') {
      if (stack.length === 0) {
        issues.push({ sev: 'error', col: i, title: 'Unmatched closing parenthesis',
          hint: 'There is a <code>)</code> with no matching <code>(</code>. Remove it or add the missing opening paren.' });
      } else {
        const f = stack.pop();
        if (f.fn) {
          const argCount = f.content ? f.args : 0;
          calls.push({ name: f.fn.name, raw: f.fn.raw, argCount, col: f.fn.col });
        }
      }
      i++; continue;
    }
    if (ch === ',') {
      if (stack.length) { stack[stack.length - 1].args++; stack[stack.length - 1].content = true; }
      i++; continue;
    }
    if (!/\s/.test(ch) && stack.length) stack[stack.length - 1].content = true;
    i++;
  }

  if (inStr) {
    issues.push({ sev: 'error', col: strCol, title: 'Unterminated string literal',
      hint: 'A quote opened here was never closed. Add a closing <code>"</code> — use <code>""</code> for a literal quote inside text.' });
  }
  for (const f of stack) {
    issues.push({ sev: 'error', col: f.col, title: 'Unclosed parenthesis',
      hint: 'Add a matching <code>)</code> for the opening paren here.' });
  }
  return { issues, calls, sawSemicolon };
}

/* --------------------------- Linter -------------------------------- */
function lintFormula(raw, opts) {
  const issues = [];
  const formula = raw.trim();
  if (!formula) return { issues, ok: true };

  // 1. Missing leading '='.
  if (formula[0] !== '=') {
    issues.push({ sev: 'warn', col: 0, title: 'Formula does not start with =',
      hint: 'In Excel & Sheets, formulas begin with <code>=</code>. Without it the cell is treated as plain text.' });
  }
  const body = formula[0] === '=' ? formula.slice(1) : formula;

  // 2. Doubled comparison operators.
  const dbl = body.search(/==|<>|><|=<|=>/);
  if (dbl !== -1 && !/<>/.test(body.slice(dbl, dbl + 2))) {
    issues.push({ sev: 'warn', col: dbl + 1, title: 'Doubled comparison operator',
      hint: 'Use a single <code>=</code> for comparison; <code>==</code> is not valid. (Note: <code>&lt;&gt;</code> is the correct “not equal”.)' });
  }

  // 3. Structural scan.
  const { issues: sIssues, calls, sawSemicolon } = scan(body);
  issues.push(...sIssues.map(x => ({ ...x, col: x.col + (formula[0] === '=' ? 1 : 0) })));

  // 4. Semicolons (locale separator issue).
  if (sawSemicolon) {
    issues.push({ sev: 'info', col: 0, title: 'Semicolons found in formula',
      hint: 'Some locales use <code>;</code> as the argument separator. In US/UK locales use commas <code>,</code> — check your spreadsheet locale if you see a <code>#ERROR!</code>.' });
  }

  // 5. Function checks.
  for (const c of calls) {
    const info = FN.get(c.name);
    if (!info) {
      // Might be a defined name, a table ref, or a typo. Only flag when it
      // looks function-like and has a close known match.
      const s = suggest(c.name);
      if (s) {
        issues.push({ sev: 'error', col: c.col + (formula[0] === '=' ? 1 : 0),
          title: `Unknown function “${c.raw}”`,
          hint: `Did you mean <code>${s}</code>? If “${c.raw}” is a named range, ignore this.` });
      }
      continue;
    }
    if (opts.strict) {
      if (c.argCount < info.min || c.argCount > info.max) {
        const exp = info.min === info.max
          ? `exactly ${info.min}`
          : info.max === Infinity ? `at least ${info.min}` : `${info.min}–${info.max}`;
        issues.push({ sev: 'error', col: c.col + (formula[0] === '=' ? 1 : 0),
          title: `${c.name} called with ${c.argCount} argument${c.argCount === 1 ? '' : 's'}`,
          hint: `<code>${c.name}</code> expects ${exp} argument${info.min === 1 && info.max === 1 ? '' : 's'}.` });
      }
    }
  }

  // 6. Empty argument slots like SUM(A1,,B2) or trailing comma.
  const emptyArg = body.search(/\(\s*,|,\s*,|,\s*\)/);
  if (emptyArg !== -1) {
    issues.push({ sev: 'warn', col: emptyArg + (formula[0] === '=' ? 1 : 0),
      title: 'Empty argument slot',
      hint: 'There is a missing value between separators here. Remove the extra comma or fill in the argument.' });
  }

  // 7. Trailing operator: =A1+  or =SUM(A1,)
  if (/[+\-*/^&=:<>]\s*$/.test(body)) {
    issues.push({ sev: 'error', col: body.length - 1 + (formula[0] === '=' ? 1 : 0),
      title: 'Formula ends with an operator',
      hint: 'An operator needs a value after it. Complete the expression or remove the trailing operator.' });
  }

  return { issues, ok: issues.length === 0 };
}

/* ----------------------------- UI ---------------------------------- */
const $ = id => document.getElementById(id);
const ta = $('formula'), resultsEl = $('results'), statusEl = $('status'), statusText = $('statusText');

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render(issues) {
  resultsEl.innerHTML = '';
  if (!issues.length) {
    resultsEl.classList.add('empty');
    statusEl.className = 'status ok';
    statusText.textContent = ta.value.trim()
      ? 'No issues found — formula looks clean.'
      : 'Paste a formula to lint it.';
    return;
  }
  resultsEl.classList.remove('empty');
  const errs = issues.filter(i => i.sev === 'error').length;
  statusEl.className = 'status ' + (errs ? 'err' : 'warn');
  statusText.textContent = `${issues.length} issue${issues.length > 1 ? 's' : ''} found (${errs} error${errs === 1 ? '' : 's'}).`;
  const order = { error: 0, warn: 1, info: 2 };
  for (const it of [...issues].sort((a, b) => order[a.sev] - order[b.sev])) {
    const d = document.createElement('div');
    d.className = 'issue ' + it.sev;
    d.innerHTML = `<h3>${escapeHtml(it.title)} <span class="col">col ${it.col + 1}</span></h3><p>${it.hint}</p>`;
    resultsEl.appendChild(d);
  }
}

let debounce = null;
function lint() {
  const raw = ta.value;
  const { issues } = lintFormula(raw, { strict: $('strict').checked });
  render(issues);
  chrome.storage.local.set({ formulaDraft: raw }).catch(() => {});
}

ta.addEventListener('input', () => {
  if (!$('live').checked) return;
  clearTimeout(debounce);
  debounce = setTimeout(lint, 250);
});
ta.addEventListener('change', lint);
$('strict').addEventListener('change', lint);
$('clearBtn').addEventListener('click', () => {
  ta.value = '';
  render([]);
  chrome.storage.local.remove('formulaDraft').catch(() => {});
  ta.focus();
});

// Restore draft + show function count.
$('fnCount').textContent = `${FN.size} functions in catalog`;
chrome.storage.local.get('formulaDraft').then(r => {
  if (r.formulaDraft) { ta.value = r.formulaDraft; lint(); }
}).catch(() => {});
