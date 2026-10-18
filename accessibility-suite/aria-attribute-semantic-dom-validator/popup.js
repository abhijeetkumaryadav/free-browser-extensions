/* ARIA Lens — popup logic.
 * Injects content.js into the active tab on demand, renders the audit
 * result, and toggles on-page highlighting. All local.
 */
'use strict';

const runBtn = document.getElementById('runBtn');
const statusEl = document.getElementById('status');
const summaryEl = document.getElementById('summary');
const filtersEl = document.getElementById('filters');
const issueList = document.getElementById('issueList');
const hlToggle = document.getElementById('hlToggle');

let lastResult = null;
let activeFilter = 'all';
let highlightOn = false;

const TYPE_LABELS = {
  'duplicate-id': 'Duplicate ID', 'img-missing-alt': 'Image alt', 'img-empty-alt': 'Image alt',
  'button-no-name': 'Button name', 'link-no-name': 'Link name', 'input-no-label': 'Form label',
  'invalid-role': 'Invalid role', 'role-no-name': 'Role name', 'role-missing-aria': 'Required ARIA',
  'aria-hidden-focusable': 'aria-hidden', 'invalid-aria-attr': 'Invalid ARIA',
  'positive-tabindex': 'Tab order', 'heading-skip': 'Headings', 'empty-heading': 'Headings',
  'no-h1': 'Headings', 'multiple-h1': 'Headings', 'no-main': 'Landmarks', 'no-nav': 'Landmarks'
};

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setStatus(text, done = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('done', done);
}

async function inject(file) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) throw new Error('No active tab.');
  if (!/^https?:|^file:/.test(tab.url || ''))
    throw new Error('Cannot audit this page (chrome:// pages are off-limits).');
  return chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [file] });
}

async function runAudit() {
  runBtn.disabled = true;
  setStatus('Auditing page…');
  try {
    const results = await inject('content.js');
    const res = results && results[0] && results[0].result;
    if (!res || !Array.isArray(res.issues)) throw new Error('Audit returned no data.');
    lastResult = res;
    render();
    setStatus(`Audited ${res.issues.length} issue${res.issues.length === 1 ? '' : 's'} on ${shortHost(res.url)}`, true);
  } catch (e) {
    setStatus('Error: ' + (e.message || e));
  } finally {
    runBtn.disabled = false;
  }
}

function shortHost(url) {
  try { return new URL(url).hostname; } catch { return 'this page'; }
}

function render() {
  const { issues, stats } = lastResult;
  document.getElementById('errCount').textContent = stats.error;
  document.getElementById('warnCount').textContent = stats.warning;
  document.getElementById('infoCount').textContent = stats.info;
  summaryEl.classList.remove('hidden');
  filtersEl.classList.remove('hidden');

  issueList.innerHTML = '';
  const shown = issues.filter(i => activeFilter === 'all' || i.severity === activeFilter);
  if (!shown.length) {
    const li = document.createElement('li');
    li.className = 'status done';
    li.textContent = issues.length ? 'Nothing in this category. 🎉' : 'No issues found. This page looks accessible! 🎉';
    issueList.appendChild(li);
    return;
  }
  // Group: errors first, then warnings, then info.
  const order = { error: 0, warning: 1, info: 2 };
  shown.sort((a, b) => order[a.severity] - order[b.severity]);
  for (const issue of shown) {
    const li = document.createElement('li');
    li.className = `issue sev-${issue.severity}`;
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = TYPE_LABELS[issue.type] || issue.type;
    const msg = document.createElement('div');
    msg.className = 'msg';
    msg.textContent = issue.message;
    const snip = document.createElement('div');
    snip.className = 'snip';
    snip.textContent = issue.snippet;
    li.append(tag, msg, snip);
    issueList.appendChild(li);
  }
}

async function setHighlight(on) {
  highlightOn = on;
  hlToggle.setAttribute('aria-checked', String(on));
  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (turnOn) => {
        if (turnOn) {
          if (window.__ariaHighlightIssues) window.__ariaHighlightIssues();
        } else if (window.__ariaClearHighlight) {
          window.__ariaClearHighlight();
        }
      },
      args: [on]
    });
  } catch (e) {
    // Page may not have content.js injected yet — inject it, then highlight.
    if (on) {
      try {
        await inject('content.js');
        await setHighlight(true);
      } catch { /* give up quietly */ }
    }
  }
}

runBtn.addEventListener('click', runAudit);
hlToggle.addEventListener('click', () => setHighlight(!highlightOn));
filtersEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  activeFilter = btn.dataset.f;
  filtersEl.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === btn));
  if (lastResult) render();
});
