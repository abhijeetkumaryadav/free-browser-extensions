/* Outline Linter popup — on-demand heading analysis, read-only, 100% local. */
'use strict';

const $ = (id) => document.getElementById(id);
let last = null; // {headings, issues}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function runScan() {
  $('scanBtn').disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) {
      throw new Error('Open a regular web page (http/https) to scan it.');
    }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => analyzeHeadings(),
    });
    last = res.result || { headings: [], issues: [] };
    render();
    chrome.storage.local.set({ outlinelinter_last: { at: Date.now(), ...last } });
  } catch (err) {
    $('outlineWrap').classList.remove('hidden');
    $('outline').innerHTML = `<p class="all-clear" style="color:var(--red)">Scan failed: ${escapeHtml(err.message || String(err))}</p>`;
  } finally {
    $('scanBtn').disabled = false;
  }
}

function render() {
  const { headings, issues } = last;
  const errors = issues.filter(i => i.severity === 'error').length;
  const warns = issues.filter(i => i.severity === 'warn').length;
  $('nHeadings').textContent = headings.length;
  $('nIssues').textContent = warns;
  $('nErrors').textContent = errors;
  $('summary').classList.remove('hidden');

  // Issues list.
  const issueIdx = new Map(); // heading index -> has issue
  issues.forEach(i => i.targets.forEach(t => issueIdx.set(t, true)));
  $('issuesWrap').classList.remove('hidden');
  $('issues').innerHTML = issues.length
    ? issues.map((iss, k) => `
      <div class="issue">
        <div class="top"><span class="sev ${iss.severity}">${iss.severity}</span><b style="font-size:12px">${escapeHtml(iss.title)}</b></div>
        <p><b>Fix:</b> ${escapeHtml(iss.fix)}</p>
        <button class="goto" data-issue="${k}">Jump to heading</button>
      </div>`).join('')
    : '<p class="all-clear">No structural heading issues found 🎉</p>';
  $('issues').querySelectorAll('[data-issue]').forEach(btn => {
    btn.addEventListener('click', () => {
      const iss = issues[parseInt(btn.dataset.issue, 10)];
      if (iss && iss.targets.length) reveal(iss.targets[0]);
    });
  });

  // Interactive outline tree.
  $('outlineWrap').classList.remove('hidden');
  const box = $('outline');
  if (!headings.length) {
    box.innerHTML = '<p class="all-clear">This page has no heading elements (h1–h6) at all.</p>';
  } else {
    box.innerHTML = headings.map(h => `
      <button class="node${issueIdx.has(h.index) ? ' has-issue' : ''}" data-idx="${h.index}" style="padding-left:${6 + (h.level - 1) * 14}px">
        <span class="lvl">H${h.level}</span>
        <span class="txt">${escapeHtml(h.text || '(empty heading)')}</span>
      </button>`).join('');
    box.querySelectorAll('.node').forEach(n => {
      n.addEventListener('click', () => reveal(parseInt(n.dataset.idx, 10)));
    });
  }
  $('actions').classList.remove('hidden');
}

async function reveal(index) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (i) => revealHeading(i),
    args: [index],
  });
}

document.addEventListener('DOMContentLoaded', () => {
  $('scanBtn').addEventListener('click', runScan);
  $('exportJson').addEventListener('click', () => {
    if (!last) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...last }, null, 2)], { type: 'application/json' }));
    a.download = 'outline-linter-report.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  $('clearBtn').addEventListener('click', () => {
    last = null;
    ['summary', 'issuesWrap', 'outlineWrap', 'actions'].forEach(id => $(id).classList.add('hidden'));
    chrome.storage.local.remove('outlinelinter_last');
  });
});
