/* Network Request Logger — popup logic.
 * Fetches the read-only log for the active tab from the background worker,
 * renders filterable rows, and exports a JSON snapshot on demand. */

const logList = document.getElementById('logList');
const searchInput = document.getElementById('searchInput');
const chipsBox = document.getElementById('typeChips');
const statsEl = document.getElementById('stats');

let entries = [];
let activeType = 'all';
let query = '';
let tabId = null;

/** Map a chrome request type to a short label for the chip. */
function typeLabel(type) {
  const map = {
    main_frame: 'doc', sub_frame: 'doc', stylesheet: 'css', script: 'js',
    image: 'img', font: 'font', xmlhttprequest: 'xhr', media: 'media',
    websocket: 'ws', ping: 'ping', csp_report: 'csp', other: 'other',
  };
  return map[type] || type;
}

/** Status code -> CSS class for coloring. */
function statusClass(status) {
  if (status == null) return 'status-err';
  if (status >= 200 && status < 300) return 'status-ok';
  if (status >= 300 && status < 400) return 'status-warn';
  return 'status-err';
}

/** Human-friendly byte size. */
function fmtSize(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

/** Escape HTML in untrusted URL text. */
function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function matchesFilters(e) {
  if (activeType !== 'all') {
    const allowed = activeType.split(',');
    if (!allowed.includes(e.type)) return false;
  }
  if (query) {
    const q = query.toLowerCase();
    if (!e.url.toLowerCase().includes(q) && !e.method.toLowerCase().includes(q)) return false;
  }
  return true;
}

function render() {
  const shown = entries.filter(matchesFilters);

  const total = entries.length;
  const errs = entries.filter((e) => e.error || (e.status != null && e.status >= 400)).length;
  const bytes = entries.reduce((sum, e) => sum + (e.size || 0), 0);
  statsEl.innerHTML =
    `<strong>${shown.length}</strong> of <strong>${total}</strong> requests` +
    (errs ? ` · <span class="status-err">${errs} failed</span>` : '') +
    ` · ${fmtSize(bytes)} transferred`;

  if (!shown.length) {
    logList.innerHTML = total
      ? '<div class="empty">No requests match the current filters.</div>'
      : '<div class="empty">No requests captured for this tab yet.<br>Reload the page or browse — the log fills in live.</div>';
    return;
  }

  logList.innerHTML = shown.slice(0, 300).map((e) => {
    const statusText = e.error ? 'ERR' : (e.status != null ? e.status : '…');
    return `
      <div class="log-row" title="${esc(e.url)}">
        <span class="method">${esc(e.method)}</span>
        <div class="row-main">
          <div class="row-url">${esc(e.url)}</div>
          <div class="row-meta">
            <span class="${statusClass(e.error ? 0 : e.status)}">${esc(String(statusText))}</span>
            <span>${fmtSize(e.size)}</span>
            <span>${e.ms != null ? e.ms + ' ms' : '—'}</span>
          </div>
        </div>
        <span class="row-type">${esc(typeLabel(e.type))}</span>
      </div>`;
  }).join('');
}

async function load() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    logList.innerHTML = '<div class="empty">Could not determine the active tab.</div>';
    return;
  }
  tabId = tab.id;
  const res = await chrome.runtime.sendMessage({ type: 'getLog', tabId });
  entries = res.entries || [];
  render();
}

chipsBox.addEventListener('click', (ev) => {
  const chip = ev.target.closest('.chip');
  if (!chip) return;
  chipsBox.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  chip.classList.add('active');
  activeType = chip.dataset.type;
  render();
});

searchInput.addEventListener('input', () => {
  query = searchInput.value.trim();
  render();
});

document.getElementById('clearBtn').addEventListener('click', async () => {
  if (tabId == null) return;
  await chrome.runtime.sendMessage({ type: 'clearLog', tabId });
  entries = [];
  render();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    tabId,
    entries: entries.filter(matchesFilters),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `network-log-tab-${tabId || 'unknown'}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// Refresh while open so the log feels live.
load();
setInterval(load, 2000);
