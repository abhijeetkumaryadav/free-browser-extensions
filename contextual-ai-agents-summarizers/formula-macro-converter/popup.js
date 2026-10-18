// Formula Macro Converter — on-device function mapping.
// Best-effort translation: function names are rewritten per target,
// cell references are kept as-is, and anything unmapped is flagged.
// Entries: xl name → {sheets, js, py} replacements; null = no direct
// equivalent (name kept, flagged for manual review).

const FN = [
  ["SUM",        "SUM",        "SUM",            "sum",                 "JS: implement SUM as arr.reduce((a,b)=>a+b,0)"],
  ["AVERAGE",    "AVERAGE",    "AVERAGE",        "statistics.mean",     "Python: import statistics"],
  ["COUNT",      "COUNT",      "COUNT",          "len",                 null],
  ["COUNTA",     "COUNTA",     "COUNTA",         "len",                 null],
  ["MAX",        "MAX",        "Math.max",       "max",                 "JS: spread the array — Math.max(...arr)"],
  ["MIN",        "MIN",        "Math.min",       "min",                 "JS: spread the array — Math.min(...arr)"],
  ["IF",         "IF",         null,             null,                  "JS: use ternary cond ? a : b · Python: a if cond else b"],
  ["AND",        "AND",        "&&",             "and",                 null],
  ["OR",         "OR",         "||",             "or",                  null],
  ["NOT",        "NOT",        "!",              "not",                 null],
  ["IFERROR",    "IFERROR",    null,             null,                  "JS: use ?? or try/catch · Python: try/except"],
  ["VLOOKUP",    "VLOOKUP",    null,             null,                  "No direct equivalent — rewrite with a lookup loop/dict"],
  ["HLOOKUP",    "HLOOKUP",    null,             null,                  "No direct equivalent — rewrite manually"],
  ["XLOOKUP",    "XLOOKUP",    null,             null,                  "Sheets supports XLOOKUP; JS/Python need a manual lookup"],
  ["INDEX",      "INDEX",      null,             null,                  "JS: arr[i] · Python: arr[i]"],
  ["MATCH",      "MATCH",      "indexOf",        null,                  "JS: arr.indexOf(x) (0-based!) · Python: list.index(x)"],
  ["SUMIF",      "SUMIF",      null,             null,                  "Filter + sum manually in JS/Python"],
  ["SUMIFS",     "SUMIFS",     null,             null,                  "Filter + sum manually in JS/Python"],
  ["COUNTIF",    "COUNTIF",    null,             null,                  "JS: arr.filter(f).length · Python: sum(1 for x in arr if f)"],
  ["COUNTIFS",   "COUNTIFS",   null,             null,                  "Filter + count manually"],
  ["AVERAGEIF",  "AVERAGEIF",  null,             null,                  "Filter + average manually"],
  ["ROUND",      "ROUND",      "Math.round",     "round",               "Rounding of .5 differs across languages — verify"],
  ["ROUNDUP",    "ROUNDUP",    "Math.ceil",      "math.ceil",           "Python: import math"],
  ["ROUNDDOWN",  "ROUNDDOWN",  "Math.floor",     "math.floor",          "Python: import math"],
  ["ABS",        "ABS",        "Math.abs",       "abs",                 null],
  ["SQRT",       "SQRT",       "Math.sqrt",      "math.sqrt",           "Python: import math"],
  ["POWER",      "POWER",      null,             null,                  "JS/Python: use a ** b"],
  ["MOD",        "MOD",        null,             null,                  "JS/Python: use a % b (sign of result may differ)"],
  ["INT",        "INT",        "Math.floor",     "int",                 "int() truncates toward zero; use math.floor for negatives"],
  ["LEN",        "LEN",        null,             "len",                 "JS: use str.length"],
  ["LEFT",       "LEFT",       null,             null,                  "JS: str.slice(0,n) · Python: s[:n]"],
  ["RIGHT",      "RIGHT",      null,             null,                  "JS: str.slice(-n) · Python: s[-n:]"],
  ["MID",        "MID",        null,             null,                  "JS: str.substr(start-1,n) · Python: s[start-1:start-1+n]"],
  ["TRIM",       "TRIM",       null,             null,                  "JS: str.trim() · Python: s.strip()"],
  ["UPPER",      "UPPER",      null,             null,                  "JS: str.toUpperCase() · Python: s.upper()"],
  ["LOWER",      "LOWER",      null,             null,                  "JS: str.toLowerCase() · Python: s.lower()"],
  ["CONCAT",     "CONCAT",     null,             null,                  "JS: a + b · Python: a + b"],
  ["CONCATENATE","CONCATENATE",null,             null,                  "JS: a + b · Python: a + b"],
  ["TEXTJOIN",   "TEXTJOIN",   null,             null,                  "JS: arr.join(delim) · Python: delim.join(arr)"],
  ["TODAY",      "TODAY",      "new Date()",     "datetime.date.today()","Python: import datetime"],
  ["NOW",        "NOW",        "new Date()",     "datetime.datetime.now()","Python: import datetime"],
  ["DATE",       "DATE",       "new Date(y,m-1,d)","datetime.date",     "JS months are 0-based"],
  ["YEAR",       "YEAR",       "getFullYear()",  ".year",               null],
  ["MONTH",      "MONTH",      "getMonth()+1",   ".month",              "JS getMonth() is 0-based"],
  ["DAY",        "DAY",        "getDate()",      ".day",                null],
  ["EOMONTH",    "EOMONTH",    null,             null,                  "No direct equivalent — compute manually"],
  ["DATEDIF",    "DATEDIF",    null,             null,                  "No direct equivalent — subtract dates manually"],
  ["NETWORKDAYS","NETWORKDAYS",null,             null,                  "No direct equivalent — needs a workday loop"],
  ["PMT",        "PMT",        null,             "numpy_financial.pmt", "JS: no built-in — implement formula · Python: pip install numpy-financial"],
  ["FV",         "FV",         null,             "numpy_financial.fv",  "JS: no built-in · Python: numpy-financial"],
  ["PV",         "PV",         null,             "numpy_financial.pv",  "JS: no built-in · Python: numpy-financial"],
  ["NPV",        "NPV",        null,             "numpy_financial.npv", "JS: no built-in · Python: numpy-financial"],
  ["IRR",        "IRR",        null,             "numpy_financial.irr", "JS: no built-in · Python: numpy-financial"],
  ["RAND",       "RAND",       "Math.random()",  "random.random()",     "Python: import random"],
  ["RANDBETWEEN","RANDBETWEEN",null,             "random.randint",      "JS: Math.floor(Math.random()*(b-a+1))+a"],
  ["LARGE",      "LARGE",      null,             null,                  "Sort descending and index"],
  ["SMALL",      "SMALL",      null,             null,                  "Sort ascending and index"],
  ["MEDIAN",     "MEDIAN",     null,             "statistics.median",   "JS: sort + middle element"],
  ["STDEV",      "STDEV",      null,             "statistics.stdev",    "JS: no built-in"],
  ["VAR",        "VAR",        null,             "statistics.variance", "JS: no built-in"],
  ["PRODUCT",    "PRODUCT",    null,             "math.prod",           "JS: arr.reduce((a,b)=>a*b,1) · Python 3.8+"],
  ["SUMPRODUCT", "SUMPRODUCT", null,             null,                  "JS: zip+reduce · Python: sum(a*b for a,b in zip(x,y))"],
  ["UNIQUE",     "UNIQUE",     null,             null,                  "JS: [...new Set(arr)] · Python: list(dict.fromkeys(arr))"],
  ["SORT",       "SORT",       null,             "sorted",              "JS: [...arr].sort()"],
  ["FILTER",     "FILTER",     null,             null,                  "JS: arr.filter(f) · Python: [x for x in arr if f]"],
  ["SEQUENCE",   "SEQUENCE",   null,             "range",               "JS: Array.from({length:n},(_,i)=>i+1)"],
  ["LET",        "LET",        null,             null,                  "JS: const name = value · Python: walrus or plain assignment"],
  ["TEXT",       "TEXT",       null,             null,                  "JS: toFixed()/toLocaleString() · Python: format()"],
  ["VALUE",      "VALUE",      "Number",         "float",               null],
].map(([xl, sheets, js, py, note]) => ({ xl, sheets, js, py, note }));

const MAP = Object.fromEntries(FN.map((f) => [f.xl, f]));

const $ = (id) => document.getElementById(id);
const outputs = { sheets: "", js: "", py: "" };

document.addEventListener("DOMContentLoaded", () => {
  $("convert").addEventListener("click", convert);
  $("input").addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") convert();
  });
  document.querySelectorAll(".copy").forEach((b) =>
    b.addEventListener("click", async () => {
      const t = outputs[b.dataset.t];
      if (!t) return;
      try { await navigator.clipboard.writeText(t); b.textContent = "Copied ✓"; }
      catch (e) { b.textContent = "Copy failed"; }
      setTimeout(() => (b.textContent = "Copy"), 1200);
    })
  );
});

// Replace function names for one target column.
function translate(formula, col) {
  let out = formula;
  for (const f of FN) {
    const rep = f[col];
    if (!rep) continue;
    out = out.replace(new RegExp("\\b" + f.xl + "\\b(?=\\s*\\()", "gi"), rep);
  }
  return out;
}

function convert() {
  let formula = $("input").value.trim();
  if (!formula) return;
  if (!formula.startsWith("=")) formula = "=" + formula;

  const jsBody = translate(formula, "js")
    .replace(/<>/g, "!=")          // Excel not-equal
    .replace(/([^=!<>])=([^=])/g, "$1==$2"); // assignment-style = → == (heuristic)
  outputs.sheets = translate(formula, "sheets");
  outputs.js = jsBody;
  outputs.py = translate(formula, "py").replace(/<>/g, "!=");

  $("oSheets").textContent = outputs.sheets;
  $("oJs").textContent = outputs.js;
  $("oPy").textContent = outputs.py;

  // Detect every function call in the original formula.
  const seen = new Set();
  for (const m of formula.toUpperCase().matchAll(/([A-Z][A-Z0-9.]*)\s*\(/g)) {
    if (!seen.has(m[1])) seen.add(m[1]);
  }
  const box = $("notes");
  box.innerHTML = "";
  let flagged = 0;
  for (const name of [...seen].sort()) {
    const f = MAP[name];
    const row = document.createElement("div");
    row.className = "note-row" + (f ? "" : " warn");
    const fn = document.createElement("span"); fn.className = "fn"; fn.textContent = name;
    const tx = document.createElement("span"); tx.className = "tx";
    if (!f) {
      flagged++;
      tx.textContent = "No mapping in the table — verify and rewrite manually.";
    } else {
      const eq = [];
      if (f.sheets && f.sheets !== name) eq.push("Sheets: " + f.sheets);
      if (f.js) eq.push("JS: " + f.js);
      if (f.py) eq.push("Python: " + f.py);
      tx.textContent = (eq.length ? eq.join(" · ") + ". " : "") + (f.note || "Direct equivalent.");
    }
    row.append(fn, tx);
    box.appendChild(row);
  }
  if (flagged) {
    const head = document.createElement("div");
    head.className = "note-row warn";
    head.innerHTML = `<span class="fn">⚠</span><span class="tx">${flagged} function${flagged > 1 ? "s have" : " has"} no mapping — check outputs carefully.</span>`;
    box.prepend(head);
  }
  // Syntax-level gotchas beyond function names.
  const syntaxNotes = [];
  if (/&/.test(formula)) syntaxNotes.push("Excel & concatenates text → in JS/Python use + instead.");
  if (/;/.test(formula)) syntaxNotes.push("Semicolon separators are a locale setting — Sheets/JS/Python outputs above assume commas.");
  for (const t of syntaxNotes) {
    const row = document.createElement("div");
    row.className = "note-row";
    row.innerHTML = `<span class="fn">§</span>`;
    const tx = document.createElement("span"); tx.className = "tx"; tx.textContent = t;
    row.appendChild(tx);
    box.appendChild(row);
  }
  $("notesCard").hidden = seen.size === 0 && syntaxNotes.length === 0;
}
