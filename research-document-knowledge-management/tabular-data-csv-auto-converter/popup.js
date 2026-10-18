/* TableSnatch popup logic.
 * Scans the active tab on demand (scripting.executeScript), shows table
 * previews, and exports the chosen table as CSV (copy or download).
 */
'use strict';

const $ = id => document.getElementById(id);
let tables = [];   // full scan results for the current page
let tabId = null;

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/** Escape one CSV field per RFC 4180. */
function csvField(value, delim) {
  const v = String(value);
  if (v.includes('"') || v.includes('\n') || v.includes(delim)) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

function toCsv(rows, delim) {
  return rows.map(r => r.map(c => csvField(c, delim)).join(delim)).join('\r\n');
}

function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1600);
}

function currentOptions() {
  return {
    delim: $('delimiter').value,
    headerRow: $('headerRow').checked
  };
}

function saveOptions() {
  chrome.storage.local.set({ tsOpts: currentOptions() });
}

function renderTables() {
  const list = $('tableList');
  list.innerHTML = '';
  $('countBadge').textContent = tables.length;
  $('emptyState').style.display = tables.length ? 'none' : 'block';

  tables.forEach((t, i) => {
    const card = document.createElement('div');
    card.className = 'table-card';

    // Preview grid: first row as header (when enabled), up to 4 data rows.
    const { headerRow } = currentOptions();
    let html = '<div class="table-head"><span class="table-name">' + esc(t.label) +
      '</span><span class="table-meta">' + t.rows + ' × ' + t.cols + '</span></div>';
    html += '<table class="preview"><tbody>';
    t.preview.forEach((row, r) => {
      html += '<tr>';
      row.forEach(cell => {
        html += (r === 0 && headerRow ? '<th>' : '<td>') + esc(cell) +
                (r === 0 && headerRow ? '</th>' : '</td>');
      });
      html += '</tr>';
    });
    if (t.rows > t.preview.length) {
      html += '<tr class="more-row"><td colspan="6">+' + (t.rows - t.preview.length) + ' more rows</td></tr>';
    }
    html += '</tbody></table>';
    html += '<div class="table-actions">' +
      '<button class="btn small" data-act="copy">Copy CSV</button>' +
      '<button class="btn small" data-act="dl">Download CSV</button></div>';
    card.innerHTML = html;

    card.querySelector('[data-act="copy"]').addEventListener('click', () => {
      const csv = toCsv(t.full, currentOptions().delim);
      navigator.clipboard.writeText(csv)
        .then(() => toast('Copied ' + t.rows + ' rows'))
        .catch(() => toast('Copy failed'));
    });
    card.querySelector('[data-act="dl"]').addEventListener('click', () => {
      const csv = toCsv(t.full, currentOptions().delim);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const safe = t.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'table';
      chrome.downloads.download({
        url,
        filename: 'tablesnatch-' + safe + '.csv',
        saveAs: false
      }).then(() => toast('Download started'))
        .catch(() => toast('Download failed'));
    });

    list.appendChild(card);
  });
}

async function scan() {
  if (tabId == null) return;
  $('scanBtn').disabled = true;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      files: ['scanner.js']
    });
    tables = (results && results[0] && results[0].result) || [];
    if (!tables.length) {
      $('emptyState').innerHTML = 'No HTML tables found on this page.<br>Tables rendered inside canvas or shadow DOM can\'t be read.';
    }
  } catch (e) {
    $('emptyState').innerHTML = 'TableSnatch can\'t run on this page<br>(e.g. browser or store pages).';
    tables = [];
  }
  renderTables();
  $('scanBtn').disabled = false;
}

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab && tab.id;

  const stored = await chrome.storage.local.get('tsOpts');
  if (stored.tsOpts) {
    $('delimiter').value = stored.tsOpts.delim || ',';
    $('headerRow').checked = stored.tsOpts.headerRow !== false;
  }
  $('delimiter').addEventListener('change', () => { saveOptions(); renderTables(); });
  $('headerRow').addEventListener('change', () => { saveOptions(); renderTables(); });

  $('scanBtn').addEventListener('click', scan);
});
