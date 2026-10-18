/* COPPA Red Flag — popup logic.
   Injects content.js into the active tab on demand, renders the heuristic findings. */

'use strict';

const scanBtn = document.getElementById('scanBtn');
const statusEl = document.getElementById('status');
const summaryEl = document.getElementById('summary');
const resultsEl = document.getElementById('results');

const SEV_ORDER = { error: 0, warning: 1, notice: 2 };
const SEV_LABEL = { error: 'Red flag', warning: 'Warning', notice: 'Note' };

/** Escape HTML to safely render scanner-supplied strings. */
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', Boolean(isError));
}

/** Render the scan payload returned by content.js. */
function render(data) {
  resultsEl.innerHTML = '';
  summaryEl.hidden = true;

  if (!data || !Array.isArray(data.findings)) {
    setStatus('Scan failed: no data returned.', true);
    return;
  }

  const findings = [...data.findings].sort(
    (a, b) => (SEV_ORDER[a.severity] ?? 3) - (SEV_ORDER[b.severity] ?? 3)
  );

  const counts = { error: 0, warning: 0, notice: 0 };
  findings.forEach((f) => { if (counts[f.severity] !== undefined) counts[f.severity] += 1; });

  summaryEl.innerHTML = `
    <div class="count-chip sev-error"><span class="n">${counts.error}</span><span class="l">Red flags</span></div>
    <div class="count-chip sev-warning"><span class="n">${counts.warning}</span><span class="l">Warnings</span></div>
    <div class="count-chip sev-notice"><span class="n">${counts.notice}</span><span class="l">Notes</span></div>`;
  summaryEl.hidden = false;

  setStatus(`Scanned ${esc(data.host || 'this page')} — ${findings.length} item${findings.length === 1 ? '' : 's'} found.`, false);

  if (findings.length === 0) {
    resultsEl.innerHTML = `
      <div class="all-clear">
        No red flags detected by the heuristic patterns.<br>
        This is <strong>not</strong> a guarantee of compliance — always review the page yourself.
      </div>`;
    return;
  }

  const frag = document.createDocumentFragment();
  findings.forEach((f) => {
    const card = document.createElement('div');
    card.className = `finding sev-${f.severity}`;
    card.innerHTML = `
      <div class="finding-head">
        <span class="sev-badge">${esc(SEV_LABEL[f.severity] || f.severity)}</span>
        <span class="finding-title">${esc(f.title)}</span>
      </div>
      <div class="finding-detail">${esc(f.detail)}</div>
      ${f.snippet ? `<div class="finding-snippet">${esc(f.snippet)}</div>` : ''}`;
    frag.appendChild(card);
  });
  resultsEl.appendChild(frag);
}

/** Run the scan: inject the content script into the active tab. */
async function runScan() {
  scanBtn.disabled = true;
  setStatus('Scanning…', false);
  resultsEl.innerHTML = '';
  summaryEl.hidden = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/^https?:\/\//i.test(tab.url)) {
      setStatus('This page can’t be scanned (only regular http/https pages).', true);
      return;
    }

    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    const data = injected && injected[0] ? injected[0].result : null;
    render(data);
  } catch (err) {
    setStatus(`Scan failed: ${err && err.message ? err.message : err}`, true);
  } finally {
    scanBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  scanBtn.addEventListener('click', runScan);
});
