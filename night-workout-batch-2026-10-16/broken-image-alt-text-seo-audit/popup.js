/* ImgAudit popup — runs an on-demand image SEO audit of the active tab.
   Read-only: the content script inspects <img> elements and never modifies the page. */
'use strict';

const scanBtn = document.getElementById('scanBtn');
const exportBtn = document.getElementById('exportBtn');
const findList = document.getElementById('findList');
const scorePanel = document.getElementById('scorePanel');
const statRow = document.getElementById('statRow');

let lastReport = null;
let filter = 'all';

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    filter = chip.dataset.f;
    renderFindings();
  });
});

scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning…';
  findList.innerHTML = '<li class="empty">Scanning images…</li>';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('no active tab');
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const report = await chrome.tabs.sendMessage(tab.id, { action: 'audit' });
    lastReport = { ...report, url: tab.url, scannedAt: new Date().toISOString() };
    chrome.storage.local.set({ lastReport });
    renderReport();
  } catch (e) {
    findList.innerHTML = '<li class="empty">Scan failed: ' + escapeHtml(e.message) +
      ' (works on regular web pages, not chrome:// or store pages)</li>';
  }
  scanBtn.disabled = false;
  scanBtn.textContent = 'Scan this page';
});

exportBtn.addEventListener('click', () => {
  if (!lastReport) return;
  const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'imgaudit-report.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

/* Score: start at 100, deduct per finding (errors −8, warnings −3, floor 0). */
function scoreOf(findings) {
  let s = 100;
  for (const f of findings) s -= f.sev === 'error' ? 8 : 3;
  return Math.max(0, s);
}

function verdictOf(score) {
  if (score >= 90) return 'Excellent — images are SEO-healthy';
  if (score >= 70) return 'Good — a few issues to fix';
  if (score >= 40) return 'Needs work — several issues found';
  return 'Poor — images need attention';
}

function renderReport() {
  const r = lastReport;
  const score = scoreOf(r.findings);
  scorePanel.hidden = false;
  statRow.hidden = false;
  document.getElementById('scoreNum').textContent = score;
  document.getElementById('scoreArc').style.strokeDashoffset = (213.6 * (1 - score / 100)).toFixed(1);
  document.getElementById('verdict').textContent = verdictOf(score);
  document.getElementById('pageUrl').textContent = r.url || '';
  document.getElementById('stTotal').textContent = r.total;
  document.getElementById('stBroken').textContent = r.findings.filter((f) => f.type === 'broken').length;
  document.getElementById('stAlt').textContent = r.findings.filter((f) => f.type === 'alt').length;
  document.getElementById('stHeavy').textContent = r.findings.filter((f) => f.type === 'heavy').length;
  exportBtn.disabled = false;
  renderFindings();
}

function renderFindings() {
  const r = lastReport;
  findList.innerHTML = '';
  const items = r.findings.filter((f) => filter === 'all' || f.sev === filter);
  if (!items.length) {
    findList.innerHTML = '<li class="empty">' +
      (r.findings.length ? 'No findings match this filter. All clear otherwise!' : 'No issues found. Images look good!') + '</li>';
    return;
  }
  for (const f of items) {
    const li = document.createElement('li');
    li.className = 'find ' + f.sev;
    const sev = document.createElement('div');
    sev.className = 'sev';
    sev.textContent = f.sev;
    const msg = document.createElement('div');
    msg.className = 'msg';
    msg.textContent = f.msg;
    const detail = document.createElement('div');
    detail.className = 'detail';
    detail.textContent = f.detail;
    li.append(sev, msg, detail);
    if (f.fix) {
      const fix = document.createElement('div');
      fix.className = 'fix';
      fix.textContent = 'Fix: ' + f.fix;
      li.appendChild(fix);
    }
    findList.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Restore last report on open. */
chrome.storage.local.get({ lastReport: null }, (s) => {
  if (s.lastReport) { lastReport = s.lastReport; renderReport(); }
});
