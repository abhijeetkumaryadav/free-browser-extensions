// popup.js — Scrape Export Bridge.
//
// Flow: pick a preset (or type a CSS selector) -> Scan injects content.js,
// merges all datasets into one preview, enables CSV/JSON download.
// Downloads use a blob + anchor click in the popup context (no extra perms).

(function () {
  'use strict';

  const presetBtns = Array.from(document.querySelectorAll('.preset'));
  const selectorEl = document.getElementById('selector');
  const scanBtn    = document.getElementById('scan');
  const metaEl     = document.getElementById('meta');
  const theadEl    = document.getElementById('thead');
  const tbodyEl    = document.getElementById('tbody');
  const csvBtn     = document.getElementById('csv');
  const jsonBtn    = document.getElementById('json');

  let preset = 'tables';
  /** Flat row list for export: {headers, rows} from the union of datasets. */
  let current = null;

  presetBtns.forEach(b => b.addEventListener('click', () => {
    preset = b.dataset.preset;
    presetBtns.forEach(x => x.classList.toggle('active', x === b));
    selectorEl.value = '';
  }));
  selectorEl.addEventListener('input', () => {
    if (selectorEl.value.trim()) presetBtns.forEach(x => x.classList.remove('active'));
  });
  scanBtn.addEventListener('click', scan);
  selectorEl.addEventListener('keydown', e => { if (e.key === 'Enter') scan(); });

  async function ensureContent(tabId) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    } catch (e) {
      // content.js may already be registered; ping instead.
    }
  }

  async function scan() {
    metaEl.textContent = 'Scanning…';
    clearPreview();
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || tab.url.startsWith('chrome://')) {
        metaEl.textContent = 'Cannot scan browser pages. Open a normal web page.';
        return;
      }
      await ensureContent(tab.id);
      const sel = selectorEl.value.trim();
      const resp = await chrome.tabs.sendMessage(tab.id, {
        action: 'scrape',
        preset: sel ? 'custom' : preset,
        selector: sel
      });
      if (!resp || !resp.ok) {
        metaEl.textContent = 'Scan failed: ' + ((resp && resp.error) || 'no response');
        return;
      }
      render(resp.datasets);
    } catch (e) {
      metaEl.textContent = 'Scan failed — refresh the page and try again.';
    }
  }

  function render(datasets) {
    const rowCount = datasets.reduce((n, d) => n + d.rows.length, 0);
    if (!rowCount) {
      metaEl.textContent = 'Nothing found with this preset on the current page.';
      csvBtn.disabled = jsonBtn.disabled = true;
      return;
    }
    // Union headers across datasets so mixed sources export sensibly.
    const headers = [];
    datasets.forEach(d => d.headers.forEach(h => { if (!headers.includes(h)) headers.push(h); }));
    const rows = [];
    datasets.forEach(d => {
      d.rows.forEach(r => {
        const full = new Array(headers.length).fill('');
        d.headers.forEach((h, i) => { full[headers.indexOf(h)] = r[i] || ''; });
        rows.push(full);
      });
    });
    current = { headers, rows };

    metaEl.textContent = datasets.length + ' source(s) · ' + rowCount + ' row(s). Preview shows first 50.';

    theadEl.innerHTML = '';
    const tr = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      tr.appendChild(th);
    });
    theadEl.appendChild(tr);

    tbodyEl.innerHTML = '';
    rows.slice(0, 50).forEach(r => {
      const row = document.createElement('tr');
      r.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell;
        td.title = cell;
        row.appendChild(td);
      });
      tbodyEl.appendChild(row);
    });

    csvBtn.disabled = jsonBtn.disabled = false;
  }

  function clearPreview() {
    theadEl.innerHTML = '';
    tbodyEl.innerHTML = '';
    csvBtn.disabled = jsonBtn.disabled = true;
    current = null;
  }

  function escapeCsv(cell) {
    const s = String(cell);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function download(filename, mime, text) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function stamp() {
    const d = new Date();
    return d.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  }

  csvBtn.addEventListener('click', () => {
    if (!current) return;
    const lines = [current.headers.map(escapeCsv).join(',')]
      .concat(current.rows.map(r => r.map(escapeCsv).join(',')));
    download('scrape-' + stamp() + '.csv', 'text/csv', lines.join('\n'));
  });

  jsonBtn.addEventListener('click', () => {
    if (!current) return;
    const objects = current.rows.map(r => {
      const o = {};
      current.headers.forEach((h, i) => { o[h] = r[i]; });
      return o;
    });
    download('scrape-' + stamp() + '.json', 'application/json', JSON.stringify(objects, null, 2));
  });
})();
