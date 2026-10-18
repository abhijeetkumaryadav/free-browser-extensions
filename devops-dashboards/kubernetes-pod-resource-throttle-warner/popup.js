/* ThrottleWatch — Pod Resource Throttle Warner
   Manual-paste analyzer: parse `kubectl top pods` output (or CSV), compare each
   pod's usage against the limits you set, and flag throttle risk. 100% local. */
'use strict';

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const cpuLimitEl = $('cpuLimit'), memLimitEl = $('memLimit');
const warnPctEl = $('warnPct'), critPctEl = $('critPct');
const inputEl = $('input'), statusEl = $('status');
const resultsEl = $('results'), summaryEl = $('summary');
const fmtHintEl = $('fmtHint');
const tabKubectl = $('tabKubectl'), tabCsv = $('tabCsv');

let mode = 'kubectl';       // 'kubectl' | 'csv'
let lastAnalysis = null;    // kept for the Export button

const SAMPLE = `NAME                        CPU(cores)   MEMORY(bytes)
api-7d9c8f4b5-x2kqz          12m          128Mi
api-7d9c8f4b5-9plm4          940m         980Mi
worker-5b6a9c2d-h8tnv        250m         512Mi
redis-0                      45m          300Mi
frontend-6f4e2a1c-q7wzr      5m           64Mi`;

/* ------------------------------------------------------------------ */
/* Quantity parsers                                                    */
/* ------------------------------------------------------------------ */

// CPU: "12m" -> 12 (millicores); "1" or "0.5" -> cores converted to millicores
function parseCPU(s) {
  s = String(s).trim();
  if (/^[0-9.]+m$/i.test(s)) return parseFloat(s.slice(0, -1));
  if (/^[0-9.]+$/.test(s)) return parseFloat(s) * 1000;
  return NaN;
}

// Memory -> MiB: "128Mi" -> 128; "2Gi" -> 2048; "512Ki" -> 0.5; plain bytes -> MiB
function parseMem(s) {
  s = String(s).trim();
  const m = s.match(/^([0-9.]+)\s*([KMGTPE]i|[KMGTPE])?$/i);
  if (!m) return NaN;
  const val = parseFloat(m[1]);
  const unit = (m[2] || '').toLowerCase();
  const BINARY = { ki: 1 / 1024, mi: 1, gi: 1024, ti: 1024 * 1024, pi: 1024 ** 3, ei: 1024 ** 4 };
  const DECIMAL = { k: 1000 / 1048576, m: 1e6 / 1048576, g: 1e9 / 1048576, t: 1e12 / 1048576, p: 1e15 / 1048576, e: 1e18 / 1048576 };
  if (unit in BINARY) return val * BINARY[unit];
  if (unit in DECIMAL) return val * DECIMAL[unit];
  return val / 1048576; // plain bytes
}

/* Parse `kubectl top pods` output: NAME  CPU(cores)  MEMORY(bytes) */
function parseKubectl(text) {
  const pods = [];
  const errors = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^name\s/i.test(line)) continue; // skip header
    const parts = line.split(/\s+/);
    if (parts.length < 3) { errors.push('Skipped malformed line: ' + line); continue; }
    const [name, cpuRaw, memRaw] = parts;
    const cpuM = parseCPU(cpuRaw);
    const memMi = parseMem(memRaw);
    if (isNaN(cpuM) || isNaN(memMi)) { errors.push(`Skipped "${name}": unreadable quantities`); continue; }
    pods.push({ name, cpuM, memMi });
  }
  return { pods, errors };
}

/* Parse CSV: pod,cpu_millicores,memory_Mi (CPU accepts m-suffix or plain millicores;
   memory accepts Mi-suffix or plain Mi). */
function parseCSV(text) {
  const pods = [];
  const errors = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^pod[,\s]/i.test(line) && /cpu/i.test(line)) continue; // skip header
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length < 3) { errors.push('Skipped malformed line: ' + line); continue; }
    const [name, cpuRaw, memRaw] = parts;
    const cpuM = parseCSVQuantity(cpuRaw, parseCPU);
    const memMi = parseCSVQuantity(memRaw, parseMem);
    if (isNaN(cpuM) || isNaN(memMi)) { errors.push(`Skipped "${name}": unreadable quantities`); continue; }
    pods.push({ name, cpuM, memMi });
  }
  return { pods, errors };
}

// CSV quantities: plain numbers are millicores / Mi; suffixed values use the normal parsers.
function parseCSVQuantity(s, fallback) {
  if (/^[0-9.]+$/.test(s.trim())) return parseFloat(s);
  return fallback(s);
}

/* ------------------------------------------------------------------ */
/* Analysis                                                            */
/* ------------------------------------------------------------------ */
const SEV = { OK: 'ok', WARN: 'warn', CRIT: 'crit' };

function severityFor(ratio, warn, crit) {
  if (ratio >= crit) return SEV.CRIT;
  if (ratio >= warn) return SEV.WARN;
  return SEV.OK;
}
function worse(a, b) {
  const rank = { ok: 0, warn: 1, crit: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function analyze(pods, cfg) {
  return pods.map((p) => {
    const cpuRatio = cfg.cpuLimit > 0 ? (p.cpuM / cfg.cpuLimit) * 100 : 0;
    const memRatio = cfg.memLimit > 0 ? (p.memMi / cfg.memLimit) * 100 : 0;
    const cpuSev = severityFor(cpuRatio, cfg.warn, cfg.crit);
    const memSev = severityFor(memRatio, cfg.warn, cfg.crit);
    return { ...p, cpuRatio, memRatio, cpuSev, memSev, sev: worse(cpuSev, memSev) };
  });
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function setStatus(msg, cls) {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + (cls || '');
}

function sevLabel(sev) {
  return sev === SEV.CRIT ? 'Critical' : sev === SEV.WARN ? 'Warning' : 'OK';
}

function meterRow(key, ratio, text, sev) {
  const w = Math.min(100, ratio);
  return `<div class="meter"><span class="k">${key}</span>` +
    `<span class="bar"><span class="fill" style="width:${w.toFixed(1)}%"></span></span>` +
    `<span class="v">${esc(text)}</span></div>`;
}

function render(results, cfg) {
  resultsEl.innerHTML = '';
  summaryEl.innerHTML = '';

  const counts = { crit: 0, warn: 0, ok: 0 };
  for (const r of results) counts[r.sev]++;

  summaryEl.classList.remove('hidden');
  summaryEl.innerHTML =
    `<div class="chip crit"><div class="n">${counts.crit}</div><div class="t">Critical</div></div>` +
    `<div class="chip warn"><div class="n">${counts.warn}</div><div class="t">Warning</div></div>` +
    `<div class="chip okc"><div class="n">${counts.ok}</div><div class="t">OK</div></div>`;

  // Worst first so risks are on top.
  const rank = { crit: 0, warn: 1, ok: 2 };
  const sorted = [...results].sort((a, b) => rank[a.sev] - rank[b.sev]);

  for (const r of sorted) {
    const card = document.createElement('div');
    card.className = 'pod ' + r.sev;
    card.innerHTML =
      `<div class="pod-name">${esc(r.name)}<span class="sev ${r.sev}">${sevLabel(r.sev)}</span></div>` +
      meterRow('CPU', r.cpuRatio, `${fmtNum(r.cpuM)}m · ${r.cpuRatio.toFixed(0)}%`, r.cpuSev) +
      meterRow('MEM', r.memRatio, `${fmtNum(r.memMi)}Mi · ${r.memRatio.toFixed(0)}%`, r.memSev);
    resultsEl.appendChild(card);
  }
}

function fmtNum(n) {
  return n >= 100 ? Math.round(n).toString() : n.toFixed(1);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */
function readConfig() {
  const cfg = {
    cpuLimit: Math.max(1, parseFloat(cpuLimitEl.value) || 1000),
    memLimit: Math.max(1, parseFloat(memLimitEl.value) || 1024),
    warn: Math.min(99, Math.max(1, parseFloat(warnPctEl.value) || 70)),
    crit: Math.min(100, Math.max(2, parseFloat(critPctEl.value) || 90))
  };
  if (cfg.warn >= cfg.crit) cfg.warn = cfg.crit - 1;
  return cfg;
}

function runAnalyze() {
  const raw = inputEl.value;
  if (!raw.trim()) { setStatus('Paste some pod metrics first (or load the Sample).', 'err'); return; }
  const cfg = readConfig();
  const { pods, errors } = mode === 'csv' ? parseCSV(raw) : parseKubectl(raw);

  if (pods.length === 0) {
    setStatus('No valid pod rows found. Check the format hint.', 'err');
    resultsEl.innerHTML = '';
    summaryEl.classList.add('hidden');
    lastAnalysis = null;
    return;
  }

  const results = analyze(pods, cfg);
  lastAnalysis = { results, cfg, mode, at: new Date().toISOString() };
  render(results, cfg);

  const nCrit = results.filter((r) => r.sev === SEV.CRIT).length;
  const nWarn = results.filter((r) => r.sev === SEV.WARN).length;
  setStatus(
    `Analyzed ${results.length} pod${results.length === 1 ? '' : 's'}: ` +
    `${nCrit} critical, ${nWarn} warning.` +
    (errors.length ? ` (${errors.length} line${errors.length === 1 ? '' : 's'} skipped)` : ''),
    nCrit ? 'err' : nWarn ? '' : 'ok'
  );

  chrome.storage.local.set({
    tw_input: raw, tw_mode: mode,
    tw_cpu: cfg.cpuLimit, tw_mem: cfg.memLimit, tw_warn: cfg.warn, tw_crit: cfg.crit
  });
}

function exportReport() {
  if (!lastAnalysis) { setStatus('Nothing to export — run Analyze first.', 'err'); return; }
  const { results, cfg, at } = lastAnalysis;
  const lines = [
    'ThrottleWatch report — ' + at,
    `Limits: CPU ${cfg.cpuLimit}m, Memory ${cfg.memLimit}Mi | Warn >= ${cfg.warn}%, Critical >= ${cfg.crit}%`,
    'NOTE: manual-paste analysis; no live cluster data.',
    ''
  ];
  for (const r of results) {
    lines.push(`${r.name}  [${sevLabel(r.sev).toUpperCase()}]`);
    lines.push(`  CPU: ${fmtNum(r.cpuM)}m (${r.cpuRatio.toFixed(1)}% of limit)`);
    lines.push(`  MEM: ${fmtNum(r.memMi)}Mi (${r.memRatio.toFixed(1)}% of limit)`);
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'throttlewatch-report.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  setStatus('Report downloaded.', 'ok');
}

function setMode(m) {
  mode = m;
  tabKubectl.classList.toggle('active', m === 'kubectl');
  tabCsv.classList.toggle('active', m === 'csv');
  fmtHintEl.textContent = m === 'csv'
    ? 'CSV format: pod-name,cpu_millicores,memory_Mi  (one per line)'
    : 'kubectl top pods format: NAME, CPU(cores), MEMORY(bytes)';
  inputEl.placeholder = m === 'csv'
    ? 'api-7d9c8f…,12,128\nworker-5b6a…,250,512'
    : 'NAME\napi-7d9c8f…\nworker-5b6a…';
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */
$('analyze').addEventListener('click', runAnalyze);
$('export').addEventListener('click', exportReport);
$('sample').addEventListener('click', () => { setMode('kubectl'); inputEl.value = SAMPLE; });
tabKubectl.addEventListener('click', () => setMode('kubectl'));
tabCsv.addEventListener('click', () => setMode('csv'));

// Restore previous inputs + settings.
chrome.storage.local.get(
  ['tw_input', 'tw_mode', 'tw_cpu', 'tw_mem', 'tw_warn', 'tw_crit'],
  (v) => {
    if (v.tw_mode) setMode(v.tw_mode);
    if (v.tw_input) inputEl.value = v.tw_input;
    if (v.tw_cpu) cpuLimitEl.value = v.tw_cpu;
    if (v.tw_mem) memLimitEl.value = v.tw_mem;
    if (v.tw_warn) warnPctEl.value = v.tw_warn;
    if (v.tw_crit) critPctEl.value = v.tw_crit;
  }
);
