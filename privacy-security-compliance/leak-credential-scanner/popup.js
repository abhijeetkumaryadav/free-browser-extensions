/* Popup logic: inject scanner.js into the active tab on demand, render findings. */
'use strict';

const $ = id => document.getElementById(id);
const scanBtn = $('scanBtn'), copyBtn = $('copyBtn'), statusEl = $('status');
const resultsEl = $('results'), badgeEl = $('badge');

let lastFindings = [];
let lastUrl = '';

scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  statusEl.textContent = 'Scanning…';
  resultsEl.innerHTML = '';
  badgeEl.classList.add('hidden');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab.');
    lastUrl = tab.url || '';

    // Inject the scanner; its completion value (findings array) is returned.
    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['scanner.js']
    });
    lastFindings = (injected && injected[0] && injected[0].result) || [];
    render(lastFindings);
  } catch (err) {
    statusEl.textContent = 'Could not scan this page. (Browser pages like chrome:// are off-limits.)';
    console.warn('Leak Credential Scanner:', err);
  } finally {
    scanBtn.disabled = false;
  }
});

function render(findings) {
  if (!findings.length) {
    statusEl.textContent = 'No exposed-secret patterns found. Heuristic scan — not a guarantee.';
    copyBtn.disabled = true;
    return;
  }
  statusEl.textContent =
    `${findings.length} potential finding${findings.length === 1 ? '' : 's'} — heuristic, expect false positives.`;
  badgeEl.textContent = findings.length;
  badgeEl.classList.remove('hidden');
  copyBtn.disabled = false;

  const sevOrder = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  resultsEl.innerHTML = '';
  for (const f of findings) {
    const card = document.createElement('div');
    card.className = 'card';

    const top = document.createElement('div');
    top.className = 'top';
    const sev = document.createElement('span');
    sev.className = 'sev ' + f.severity;
    sev.textContent = f.severity;
    const kind = document.createElement('span');
    kind.className = 'kind';
    kind.textContent = f.label;
    top.append(sev, kind);

    const where = document.createElement('div');
    where.className = 'status';
    where.textContent = 'Found in: ' + f.where;

    const ctx = document.createElement('div');
    ctx.className = 'ctx';
    ctx.textContent = f.redacted + '   ';
    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = '[click to reveal]';
    ctx.append(hint);
    let revealed = false;
    ctx.addEventListener('click', () => {
      revealed = !revealed;
      ctx.textContent = (revealed ? f.match : f.redacted) + '   ';
      const h = document.createElement('span');
      h.className = 'hint';
      h.textContent = revealed ? '[click to hide]' : '[click to reveal]';
      ctx.append(h);
    });

    card.append(top, where, ctx);
    resultsEl.append(card);
  }

  // Remember the last scan (counts only, never the values) for the badge.
  chrome.storage.local.set({ lastScan: { url: lastUrl, count: findings.length, at: Date.now() } });
}

copyBtn.addEventListener('click', async () => {
  const lines = [
    'Leak Credential Scanner report',
    `Page: ${lastUrl}`,
    `Scanned: ${new Date().toISOString()}`,
    `Findings: ${lastFindings.length} (heuristic — expect false positives)`,
    ''
  ];
  for (const f of lastFindings) {
    lines.push(`[${f.severity.toUpperCase()}] ${f.label} (${f.where})`);
    lines.push(`  match: ${f.match}`);
    lines.push(`  context: ${f.context}`);
    lines.push('');
  }
  lines.push('Nothing in this report was sent anywhere; it was generated locally.');
  await navigator.clipboard.writeText(lines.join('\n'));
  copyBtn.textContent = 'Copied ✓';
  setTimeout(() => (copyBtn.textContent = 'Copy report'), 1500);
});
