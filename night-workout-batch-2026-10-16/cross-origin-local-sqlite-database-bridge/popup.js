/* Scrape Export Bridge — popup logic.
   Flow: user picks a source → injects content.js on explicit click (activeTab)
   → messages it for extraction → previews 50 rows → exports CSV/JSON via blob download. */
(() => {
  'use strict';

  // --- DOM refs ------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const tabs = [...document.querySelectorAll('.tab')];
  const customRow = $('customRow'), selectorInput = $('selector');
  const extractBtn = $('extractBtn'), resultsCard = $('resultsCard');
  const countsLine = $('countsLine'), previewTable = $('previewTable');
  const csvBtn = $('csvBtn'), jsonBtn = $('jsonBtn'), statusEl = $('status');

  let source = 'tables';
  let lastHeaders = [];
  let lastRows = []; // array of objects (full set, not just preview)

  // --- helpers ---------------------------------------------------------------
  function setStatus(msg, kind = '') {
    statusEl.textContent = msg;
    statusEl.className = 'status ' + kind;
  }

  // Union of headers across mixed sources, preserving first-seen order.
  function unionHeaders(rows) {
    const seen = new Set(), out = [];
    for (const r of rows) for (const k of Object.keys(r)) {
      if (!seen.has(k)) { seen.add(k); out.push(k); }
    }
    return out;
  }

  // CSV with proper quoting (commas, quotes, newlines).
  function toCSV(headers, rows) {
    const esc = (v) => {
      const s = v === undefined || v === null ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.map(esc).join(',')];
    for (const r of rows) lines.push(headers.map(h => esc(r[h])).join(','));
    return lines.join('\r\n');
  }

  function download(filename, mime, text) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function renderPreview() {
    const headers = lastHeaders, rows = lastRows.slice(0, 50);
    countsLine.textContent = `${lastRows.length} row${lastRows.length === 1 ? '' : 's'} × ${headers.length} col${headers.length === 1 ? '' : 's'}`;
    previewTable.innerHTML = '';
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    for (const h of headers) {
      const th = document.createElement('th');
      th.textContent = h; th.title = h;
      hr.appendChild(th);
    }
    thead.appendChild(hr); previewTable.appendChild(thead);
    const tbody = document.createElement('tbody');
    for (const r of rows) {
      const tr = document.createElement('tr');
      for (const h of headers) {
        const td = document.createElement('td');
        const v = r[h] === undefined || r[h] === null ? '' : String(r[h]);
        td.textContent = v; td.title = v;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    previewTable.appendChild(tbody);
  }

  // --- tab switching -----------------------------------------------------------
  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    source = tab.dataset.source;
    customRow.classList.toggle('hidden', source !== 'custom');
  }));

  // --- restore last choices --------------------------------------------------------
  chrome.storage.local.get(['seb_source', 'seb_selector'], (d) => {
    if (d.seb_source) {
      const match = tabs.find(t => t.dataset.source === d.seb_source);
      if (match) match.click();
    }
    if (d.seb_selector) selectorInput.value = d.seb_selector;
  });

  // --- extraction --------------------------------------------------------------
  extractBtn.addEventListener('click', async () => {
    if (source === 'custom' && !selectorInput.value.trim()) {
      setStatus('Enter a CSS selector for the Custom source.', 'error');
      return;
    }
    // Remember choices locally.
    chrome.storage.local.set({ seb_source: source, seb_selector: selectorInput.value.trim() });
    extractBtn.disabled = true;
    setStatus('Extracting…');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) throw new Error('No active tab.');
      if (/^chrome:|^edge:|^about:|^chrome-extension:|^moz-extension:/.test(tab.url || '')) {
        throw new Error('Cannot run on browser internal pages.');
      }
      // Inject the extractor (guarded against double injection inside the file).
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      const res = await chrome.tabs.sendMessage(tab.id, {
        type: 'SEB_EXTRACT',
        source,
        selector: selectorInput.value.trim()
      });
      if (!res || !res.ok) throw new Error((res && res.error) || 'Extraction failed.');
      if (!res.rows.length) {
        setStatus('No data found for this source on the page.', 'error');
        resultsCard.classList.add('hidden');
        return;
      }
      lastHeaders = unionHeaders(res.rows);
      lastRows = res.rows;
      renderPreview();
      resultsCard.classList.remove('hidden');
      setStatus(`Extracted ${res.rows.length} rows.`, 'ok');
    } catch (err) {
      setStatus(String(err && err.message || err), 'error');
    } finally {
      extractBtn.disabled = false;
    }
  });

  // --- exports -------------------------------------------------------------------
  csvBtn.addEventListener('click', () => {
    if (!lastRows.length) return;
    download('scrape-export.csv', 'text/csv;charset=utf-8', toCSV(lastHeaders, lastRows));
    setStatus('CSV downloaded.', 'ok');
  });

  jsonBtn.addEventListener('click', () => {
    if (!lastRows.length) return;
    download('scrape-export.json', 'application/json;charset=utf-8', JSON.stringify(lastRows, null, 2));
    setStatus('JSON downloaded.', 'ok');
  });
})();
