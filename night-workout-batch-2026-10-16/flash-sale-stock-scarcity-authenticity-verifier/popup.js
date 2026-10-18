// Scarcity Check — popup logic. Injects a self-contained scanner into the active tab.
'use strict';

/**
 * Runs INSIDE the page (injected via chrome.scripting). Must be fully
 * self-contained: no references to anything outside this function.
 * Returns a heuristic pressure report. Heuristic only — cannot verify stock.
 */
function scanSalePage() {
  const STOCK_PATTERNS = [
    /only\s+\d+\s+(left|remaining|in stock)/i,
    /hurry[,!]?\s+only\s+\d+/i,
    /\d+\s+(people|shoppers|buyers)\s+(are\s+)?(viewing|watching|buying)/i,
    /selling\s+fast/i,
    /low\s+stock/i,
    /stock\s+(almost|nearly)\s+gone/i,
    /while\s+supplies\s+last/i,
  ];
  const TIMER_SELECTORS = '[class*="countdown"],[class*="timer"],[id*="countdown"],[id*="timer"],[data-countdown]';
  const PRESSURE_PHRASES = [
    'act now', 'limited time', "don't miss", 'deal ends', 'offer ends', 'ends tonight',
    'last chance', 'final hours', 'going fast', "before it's gone", 'almost sold out',
    'selling out', 'once in a lifetime', 'exclusive deal', 'today only', 'order now',
  ];

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const parts = [];
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent) continue;
    const tag = parent.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
    const style = getComputedStyle(parent);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const t = node.textContent.trim();
    if (t.length > 2) parts.push(t);
  }
  const text = parts.join(' ');

  const stockExamples = [];
  for (const re of STOCK_PATTERNS) {
    const m = text.match(re);
    if (m) stockExamples.push(m[0].slice(0, 120));
  }

  const timerSamples = [];
  document.querySelectorAll(TIMER_SELECTORS).forEach((el) => {
    const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
    if (/(\d{1,2}[:\s]){1,3}\d{1,2}/.test(t) || /\d+\s*(min|sec|hrs?|hours|minutes|seconds)/i.test(t)) {
      timerSamples.push(t.slice(0, 60));
    }
  });

  const lower = text.toLowerCase();
  const pressureHits = PRESSURE_PHRASES.filter((p) => lower.indexOf(p) !== -1);

  let score = 0;
  const findings = [];
  stockExamples.forEach((ex) => {
    score += 22;
    findings.push({ severity: 'high', title: 'Stock-scarcity claim detected',
      detail: 'Page asserts limited remaining stock. Such claims are frequently fabricated to rush shoppers.',
      example: ex });
  });
  if (timerSamples.length > 0) {
    score += 18;
    findings.push({ severity: 'high',
      title: timerSamples.length + ' countdown timer' + (timerSamples.length > 1 ? 's' : '') + ' found',
      detail: 'Timers create urgency. Reload the page later: if the timer resets or the "deal" continues, it was pressure theater, not a real deadline.',
      example: timerSamples[0] });
  }
  if (pressureHits.length >= 3) {
    score += 15;
    findings.push({ severity: 'medium', title: pressureHits.length + ' urgency phrases detected',
      detail: 'Repeated pressure language ("act now", "last chance"…) is a classic sales-pressure pattern.',
      example: pressureHits.slice(0, 4).join(' · ') });
  } else if (pressureHits.length > 0) {
    score += 6;
    findings.push({ severity: 'low', title: pressureHits.length + ' urgency phrase' + (pressureHits.length > 1 ? 's' : '') + ' detected',
      detail: 'Mild urgency language present — worth a pause before buying.',
      example: pressureHits.join(' · ') });
  }
  score = Math.min(100, score);
  const verdict = score === 0 ? 'No pressure signals found'
    : score < 35 ? 'Low pressure' : score < 65 ? 'Moderate pressure' : 'High pressure';

  return { score, verdict, timerCount: timerSamples.length,
    stockClaimCount: stockExamples.length, pressureCount: pressureHits.length, findings };
}

const $ = (id) => document.getElementById(id);

function render(report, host) {
  $('results').classList.remove('hidden');
  $('ring').style.background =
    `conic-gradient(var(--accent) ${report.score * 3.6}deg, rgba(255,255,255,.08) 0)`;
  $('scoreNum').textContent = report.score;
  $('verdict').textContent = report.verdict;
  $('scanNote').textContent = 'Scanned ' + host + ' — pattern flags only, not proof of fake stock.';
  $('tiles').innerHTML =
    tile(report.score, 'pressure score') +
    tile(report.stockClaimCount, 'stock claims') +
    tile(report.timerCount, 'timers') +
    tile(report.pressureCount, 'urgency phrases');
  $('findings').innerHTML = report.findings.length === 0
    ? '<div class="card low"><span class="sev">Clear</span><b>No pressure signals</b><p>This page showed no stock-scarcity or urgency patterns in visible text.</p></div>'
    : report.findings.map((f) =>
        `<div class="card ${f.severity}"><span class="sev">${f.severity}</span><b>${esc(f.title)}</b><p>${esc(f.detail)}</p><div class="ex">"${esc(f.example)}"</div></div>`
      ).join('');
}

function tile(num, label) {
  return `<div class="tile"><b>${num}</b><span>${label}</span></div>`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

$('scanBtn').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab.');
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanSalePage,
    });
    const report = results && results[0] && results[0].result;
    if (!report) throw new Error('Scan returned no data.');
    let host = 'this page';
    try { host = new URL(tab.url).hostname; } catch (_) { /* keep fallback */ }
    await chrome.storage.local.set({ lastScan: { report, host, at: Date.now() } });
    render(report, host);
  } catch (err) {
    $('results').classList.remove('hidden');
    $('verdict').textContent = 'Scan failed';
    $('scanNote').textContent = String(err.message || err) +
      ' (Some pages, e.g. browser internal pages, block injection.)';
  }
});

$('clearBtn').addEventListener('click', async () => {
  await chrome.storage.local.remove('lastScan');
  $('results').classList.add('hidden');
});

// Restore last scan.
(async () => {
  const { lastScan } = await chrome.storage.local.get('lastScan');
  if (lastScan && lastScan.report) render(lastScan.report, lastScan.host || 'this page');
})();
