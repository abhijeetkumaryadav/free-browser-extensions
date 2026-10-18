/* Popup: polls the background worker for this tab's tally and renders it. */

const ACCENT = '#22d3ee';
let tabId = null;

function fmtBytes(n) {
  if (!n || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return v.toFixed(v >= 100 || i === 0 ? 0 : 1) + ' ' + units[i];
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function refresh() {
  if (tabId == null) return;
  const res = await chrome.runtime.sendMessage({ type: 'getStats', tabId });
  const s = res && res.stats;
  document.getElementById('inBytes').textContent = fmtBytes(s ? s.in : 0);
  document.getElementById('outBytes').textContent = fmtBytes(s ? s.out : 0);
  document.getElementById('requests').textContent = s ? s.requests : 0;
  document.getElementById('unknown').textContent = s ? s.unknown : 0;

  const hostsEl = document.getElementById('hosts');
  if (!s || Object.keys(s.hosts).length === 0) {
    hostsEl.innerHTML = '<p class="empty">No traffic recorded for this tab yet. Reload the page to see the ticker move.</p>';
    return;
  }
  const rows = Object.entries(s.hosts)
    .map(([host, h]) => ({ host, ...h, total: h.in + h.out }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);
  const max = rows[0].total || 1;
  hostsEl.innerHTML = rows.map((r) => {
    const pct = Math.max(2, Math.round((r.total / max) * 100));
    return `<div class="host-row">
      <div class="host-top"><span class="host-name">${esc(r.host)}</span><span class="host-total">${fmtBytes(r.total)}</span></div>
      <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
      <div class="host-meta">↓ ${fmtBytes(r.in)} · ↑ ${fmtBytes(r.out)} · ${r.count} req${r.unknown ? ` · ${r.unknown} unknown` : ''}</div>
    </div>`;
  }).join('');
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  tabId = tab.id;
  try {
    const u = new URL(tab.url);
    document.getElementById('tabLabel').textContent = u.hostname || 'current tab';
  } catch { /* keep default */ }

  document.getElementById('resetBtn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'resetTab', tabId });
    refresh();
  });

  await refresh();
  setInterval(refresh, 1000); // live ticker while open
}

init();
