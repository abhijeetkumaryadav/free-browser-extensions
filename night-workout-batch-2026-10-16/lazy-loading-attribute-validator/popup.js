/* LazyLoad Validator — popup logic */
'use strict';

const $ = (id) => document.getElementById(id);
const scanBtn = $('scan'), clearBtn = $('clear'), findingsBox = $('findings');
let activeFilter = 'all';
let lastFindings = [];

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
  $('summary').textContent =
    `${report.images} images · ${report.iframes} iframes · ${report.errors} issues · ${report.warns} warnings`;

  $('tiles').innerHTML = [
    [report.total, 'elements'],
    [report.errors, 'issues'],
    [report.warns, 'warnings'],
    [report.ok, 'passing'],
  ].map(([n, l]) => `<div class="tile"><b>${n}</b><span>${l}</span></div>`).join('');

  lastFindings = report.findings;
  renderFindings();
  chrome.storage.local.set({ lazyload_last: report });
}

function renderFindings() {
  const list = lastFindings.filter(f => activeFilter === 'all' || f.sev === activeFilter);
  if (!list.length) {
    findingsBox.innerHTML = '<div class="empty">No findings in this filter.</div>';
    return;
  }
  findingsBox.innerHTML = list.map(f => `
    <div class="finding">
      <div class="fh"><span class="badge ${f.sev}">${f.sev}</span><code>${escapeHtml(f.el)}</code></div>
      <div class="fix">${escapeHtml(f.fix)}</div>
    </div>`).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function runScan() {
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab.');
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
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
clearBtn.addEventListener('click', () => {
  chrome.storage.local.remove('lazyload_last');
  lastFindings = [];
  $('scoreNum').textContent = '–';
  $('verdict').textContent = 'Not scanned yet';
  $('verdict').style.color = '';
  $('summary').textContent = 'Scan this page to audit lazy-loading attributes.';
  $('tiles').innerHTML = '';
  findingsBox.innerHTML = '<div class="empty">No scan results yet.</div>';
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.dataset.f;
    renderFindings();
  });
});

// Restore last scan if present.
chrome.storage.local.get('lazyload_last', ({ lazyload_last }) => {
  if (lazyload_last) render(lazyload_last);
});
