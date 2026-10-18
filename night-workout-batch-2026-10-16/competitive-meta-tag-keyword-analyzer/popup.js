/* MetaTag Keyword Analyzer — popup logic */
'use strict';

const $ = (id) => document.getElementById(id);
const scanBtn = $('scan');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function verdictFor(score) {
  if (score >= 90) return ['Excellent', 'var(--ok)'];
  if (score >= 70) return ['Good', 'var(--accent)'];
  if (score >= 50) return ['Needs work', 'var(--warn)'];
  return ['Poor', 'var(--danger)'];
}

function render(report) {
  const [verdict, color] = verdictFor(report.score);
  $('scoreNum').textContent = report.score;
  document.querySelector('.score-ring').style.background =
    `conic-gradient(var(--accent) ${report.score * 3.6}deg, rgba(255,255,255,.08) 0deg)`;
  $('verdict').textContent = verdict;
  $('verdict').style.color = color;
  $('summary').textContent = `${report.wordCount} words analyzed · ${report.checks.length} checks`;

  $('tagCards').innerHTML = report.tags.map(t => `
    <div class="tagcard">
      <div class="th"><b>${escapeHtml(t.name)}</b><span class="len ${t.lenCls}">${t.len} chars</span></div>
      <code>${escapeHtml(t.value)}</code>
    </div>`).join('');

  $('keywords').innerHTML = report.keywords.length
    ? report.keywords.map(k => `<span class="kw">${escapeHtml(k.word)}<small>${k.count}× · ${k.density}%</small></span>`).join('')
    : '<div class="empty">Not enough text on this page.</div>';

  $('findings').innerHTML = report.checks.map(c => `
    <div class="finding">
      <div class="fh"><span class="badge ${c.sev}">${c.sev}</span><span>${escapeHtml(c.title)}</span></div>
      ${c.fix ? `<div class="fix">${escapeHtml(c.fix)}</div>` : ''}
    </div>`).join('');

  chrome.storage.local.set({ metatag_last: report });
}

function reset() {
  chrome.storage.local.remove('metatag_last');
  $('scoreNum').textContent = '–';
  $('verdict').textContent = 'Not scanned yet';
  $('verdict').style.color = '';
  $('summary').textContent = 'Scan this page to audit its own meta tags.';
  $('tagCards').innerHTML = '';
  $('keywords').innerHTML = '<div class="empty">No scan results yet.</div>';
  $('findings').innerHTML = '<div class="empty">No scan results yet.</div>';
}

async function runScan() {
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab.');
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const report = results && results[0] && results[0].result;
    if (!report) throw new Error('Scan returned nothing. Try reloading the page.');
    render(report);
  } catch (e) {
    $('summary').textContent = 'Error: ' + e.message;
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan this page';
  }
}

scanBtn.addEventListener('click', runScan);
$('clear').addEventListener('click', reset);
chrome.storage.local.get('metatag_last', ({ metatag_last }) => { if (metatag_last) render(metatag_last); });
