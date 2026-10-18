/* Alt Text Gap Finder — popup logic. */
'use strict';

const $ = (id) => document.getElementById(id);
let lastIssues = [];

// Inject the content script if it isn't already listening.
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContent(tab) {
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    // Small wait for the listener to register.
    await new Promise(r => setTimeout(r, 150));
  }
}

function setStatus(text, cls = '') {
  const el = $('status');
  el.textContent = text;
  el.className = `status ${cls}`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function scan() {
  setStatus('Scanning…');
  $('scanBtn').disabled = true;
  try {
    const tab = await activeTab();
    if (!tab || !tab.id || /^chrome:|^edge:|^about:/.test(tab.url || '')) {
      setStatus('Cannot scan this page (browser internal page). Open a normal website.', 'warn');
      return;
    }
    await ensureContent(tab);
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'altgap-scan' });
    if (!res || !res.ok) throw new Error('no response');
    lastIssues = res.issues || [];
    $('countMissing').textContent = lastIssues.length;
    $('countTotal').textContent = res.total || 0;
    $('countEmpty').textContent = res.empty || 0;
    $('summary').classList.remove('hidden');
    renderIssues();
    $('exportBtn').classList.remove('hidden');
    if (lastIssues.length === 0) {
      setStatus('Great news — no images are missing alt text on this page.', 'ok');
    } else {
      setStatus(`${lastIssues.length} image${lastIssues.length > 1 ? 's' : ''} missing alt text. Badges are overlaid on the page.`, 'warn');
    }
  } catch (err) {
    setStatus('Scan failed: ' + (err && err.message ? err.message : err), 'warn');
  } finally {
    $('scanBtn').disabled = false;
  }
}

function renderIssues() {
  const list = $('issueList');
  list.innerHTML = '';
  if (lastIssues.length === 0) {
    list.innerHTML = '<li class="empty">No issues found.</li>';
    return;
  }
  lastIssues.forEach((issue, i) => {
    const li = document.createElement('li');
    li.className = 'issue';
    li.innerHTML = `
      <div class="fname">#${i + 1} ${esc(issue.filename)}</div>
      <div class="meta">${issue.width} × ${issue.height}px · ${issue.empty ? 'empty alt=""' : 'no alt attribute'}</div>
      <div class="suggest"><span class="tag">Heuristic draft — not AI vision</span><br>${esc(issue.suggestion)}</div>
      <div class="row">
        <button class="btn" data-copy="${i}">Copy draft</button>
      </div>`;
    list.appendChild(li);
  });
  list.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const issue = lastIssues[Number(btn.dataset.copy)];
      navigator.clipboard.writeText(issue.suggestion).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy draft'; }, 1200);
      });
    });
  });
}

async function clearBadges() {
  try {
    const tab = await activeTab();
    if (tab && tab.id) await chrome.tabs.sendMessage(tab.id, { type: 'altgap-clear' });
  } catch { /* content script may not be injected — nothing to clear */ }
  setStatus('Badges cleared. Click “Scan page” to audit the active tab.');
  $('summary').classList.add('hidden');
  $('issueList').innerHTML = '';
  $('exportBtn').classList.add('hidden');
  lastIssues = [];
}

function exportReport() {
  const report = {
    generatedAt: new Date().toISOString(),
    missingAltCount: lastIssues.length,
    issues: lastIssues.map(i => ({
      filename: i.filename, src: i.src,
      width: i.width, height: i.height,
      emptyAlt: i.empty, heuristicSuggestion: i.suggestion
    })),
    disclaimer: 'Suggestions are filename heuristics, not AI vision. Review before use.'
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'alt-text-gap-report.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

$('scanBtn').addEventListener('click', scan);
$('clearBtn').addEventListener('click', clearBadges);
$('exportBtn').addEventListener('click', exportReport);
