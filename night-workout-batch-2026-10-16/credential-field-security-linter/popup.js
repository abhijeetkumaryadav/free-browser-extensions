/* CredLint popup logic — triggers the read-only content-script audit and renders results. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const scanBtn = $('scanBtn'), statusEl = $('status'), summaryEl = $('summary'),
        issuesEl = $('issues'), filtersEl = $('filters'), actionsEl = $('actions');

  let lastResult = null;
  let activeFilter = 'all';

  function setStatus(msg, ok = false) {
    statusEl.textContent = msg;
    statusEl.classList.remove('hidden', 'ok');
    if (ok) statusEl.classList.add('ok');
  }

  function severityRank(s) { return { error: 0, warning: 1, notice: 2 }[s] ?? 3; }

  function render() {
    if (!lastResult) return;
    const { issues, counts, summary } = lastResult;

    $('errCount').textContent = counts.error;
    $('warnCount').textContent = counts.warning;
    $('noteCount').textContent = counts.notice;
    summaryEl.classList.remove('hidden');
    filtersEl.classList.remove('hidden');
    actionsEl.classList.remove('hidden');

    const shown = issues
      .filter(i => activeFilter === 'all' || i.severity === activeFilter)
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

    issuesEl.innerHTML = '';
    if (shown.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.innerHTML = '<span class="big">✅</span>No issues at this severity level.<br>' +
        (issues.length === 0 ? 'The detected credential fields follow common security practices.' : 'Try a different filter.');
      issuesEl.appendChild(li);
    } else {
      shown.forEach(i => {
        const li = document.createElement('li');
        li.className = 'issue ' + i.severity;
        li.innerHTML =
          `<div class="title"><span class="sev">${i.severity}</span>${escapeHtml(i.title)}</div>` +
          `<div class="detail">${escapeHtml(i.detail)}</div>` +
          (i.target && i.target !== 'page' ? `<div class="target">${escapeHtml(i.target)}</div>` : '');
        issuesEl.appendChild(li);
      });
    }

    if (issues.length === 0) {
      setStatus(summary + ' No security issues found — fields look well configured.', true);
    } else {
      setStatus(summary + ` Found ${issues.length} issue${issues.length === 1 ? '' : 's'} to review.`, false);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  scanBtn.addEventListener('click', async () => {
    scanBtn.disabled = true;
    setStatus('Scanning page structure… (nothing you type is read)');
    issuesEl.innerHTML = '';
    summaryEl.classList.add('hidden');
    filtersEl.classList.add('hidden');
    actionsEl.classList.add('hidden');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || tab.id == null) throw new Error('No active tab found.');
      if (/^(chrome|chrome-extension|edge|about):/.test(tab.url || '')) {
        throw new Error('This page is protected — audits only run on regular web pages.');
      }

      // Inject the audit script on demand, then run it in the page context
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => (typeof window.__credLintAudit === 'function' ? window.__credLintAudit() : { issues: [], counts: { error: 0, warning: 0, notice: 0 }, summary: 'Audit did not initialize.' })
      });

      lastResult = results[0].result;
      // Persist the latest report for the session
      await chrome.storage.local.set({ credLintLast: { at: Date.now(), url: tab.url, result: lastResult } });
      render();
    } catch (err) {
      setStatus('Scan failed: ' + (err.message || err));
    } finally {
      scanBtn.disabled = false;
    }
  });

  filtersEl.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    activeFilter = btn.dataset.f;
    filtersEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    render();
  });

  $('copyBtn').addEventListener('click', async () => {
    if (!lastResult) return;
    const lines = [
      'CredLint credential-field audit report',
      'Generated: ' + new Date().toISOString(),
      'Findings: ' + lastResult.issues.length,
      ''
    ];
    lastResult.issues.forEach(i => {
      lines.push(`[${i.severity.toUpperCase()}] ${i.title}`);
      lines.push('  ' + i.detail);
      if (i.target && i.target !== 'page') lines.push('  Target: ' + i.target);
      lines.push('');
    });
    lines.push('Note: read-only structural audit — no credentials were read, stored, or transmitted.');
    await navigator.clipboard.writeText(lines.join('\n'));
    $('copyBtn').textContent = 'Copied ✓';
    setTimeout(() => { $('copyBtn').innerHTML = 'Copy report'; }, 1500);
  });

  $('clearBtn').addEventListener('click', async () => {
    lastResult = null;
    activeFilter = 'all';
    issuesEl.innerHTML = '';
    summaryEl.classList.add('hidden');
    filtersEl.classList.add('hidden');
    actionsEl.classList.add('hidden');
    statusEl.classList.add('hidden');
    await chrome.storage.local.remove('credLintLast');
  });
})();
