/* CertWatch popup: watchlist CRUD, crt.sh lookup with manual fallback, countdown badges. */
'use strict';

const $ = (id) => document.getElementById(id);
const DAY = 86400000;
let pendingManualDomain = null;

function cleanDomain(v) {
  return v.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}
function validDomain(v) {
  return /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/.test(v);
}

function badgeFor(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return ['unknown', '—'];
  if (daysLeft < 0) return ['crit', 'EXPIRED'];
  if (daysLeft <= 7) return ['crit', daysLeft + 'd'];
  if (daysLeft <= 30) return ['warn', daysLeft + 'd'];
  return ['ok', daysLeft + 'd'];
}

function render(st) {
  $('warnDays').value = String(st.warnDays || 14);
  $('alertCheck').checked = st.alerts !== false;
  const list = $('watchList');
  list.innerHTML = '';
  if (!st.domains.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No domains tracked yet — add one above.';
    list.appendChild(li);
    return;
  }
  const now = Date.now();
  const sorted = [...st.domains].sort((a, b) => (a.expiresAt || Infinity) - (b.expiresAt || Infinity));
  for (const d of sorted) {
    const li = document.createElement('li');

    const top = document.createElement('div'); top.className = 'w-top';
    const dom = document.createElement('span'); dom.className = 'w-domain'; dom.textContent = d.domain;
    const src = document.createElement('span'); src.className = 'w-src';
    src.textContent = d.source === 'manual' ? 'manual' : 'crt.sh';
    const del = document.createElement('button'); del.className = 'danger-ghost w-del'; del.textContent = 'Remove';
    del.addEventListener('click', async () => {
      const cur = (await chrome.runtime.sendMessage({ type: 'get-state' })).st;
      cur.domains = cur.domains.filter(x => x.domain !== d.domain);
      await chrome.runtime.sendMessage({ type: 'save-state', st: cur });
      render(cur);
    });
    top.append(dom, src, del);

    const mid = document.createElement('div'); mid.className = 'w-mid';
    const daysLeft = d.expiresAt ? Math.ceil((d.expiresAt - now) / DAY) : null;
    const [cls, label] = badgeFor(daysLeft);
    const badge = document.createElement('span'); badge.className = 'badge ' + cls; badge.textContent = label;
    const detail = document.createElement('div'); detail.className = 'w-detail';
    if (d.expiresAt) {
      const dt = new Date(d.expiresAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
      detail.innerHTML = `Expires <strong>${dt}</strong>` +
        (d.issuer ? `<br>Issuer: ${escapeHtml(d.issuer)}` : '') +
        (d.lastChecked ? `<br>Checked ${new Date(d.lastChecked).toLocaleDateString()}` : '');
    } else if (d.error) {
      detail.textContent = 'Lookup failed: ' + d.error;
    } else {
      detail.textContent = 'No certificate data yet.';
    }
    mid.append(badge, detail);
    li.append(top, mid);
    list.appendChild(li);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function refresh() {
  const { st } = await chrome.runtime.sendMessage({ type: 'get-state' });
  render(st);
}

function showError(msg) {
  const e = $('addError');
  e.textContent = msg;
  e.hidden = false;
}

$('addBtn').addEventListener('click', async () => {
  $('addError').hidden = true;
  const domain = cleanDomain($('domainInput').value);
  if (!validDomain(domain)) { showError('Enter a valid domain, e.g. example.com'); return; }

  const { st } = await chrome.runtime.sendMessage({ type: 'get-state' });
  if (st.domains.some(d => d.domain === domain)) { showError('That domain is already tracked.'); return; }

  $('addBtn').disabled = true;
  $('addBtn').textContent = 'Looking up…';
  const res = await chrome.runtime.sendMessage({ type: 'lookup', domain });
  $('addBtn').disabled = false;
  $('addBtn').textContent = 'Add';

  if (res.ok && res.cert) {
    st.domains.push({
      domain, source: 'crtsh',
      expiresAt: res.cert.expiresAt,
      issuer: res.cert.issuer,
      commonName: res.cert.commonName,
      lastChecked: Date.now(), error: null
    });
    await chrome.runtime.sendMessage({ type: 'save-state', st });
    $('domainInput').value = '';
    render(st);
  } else {
    // crt.sh failed or has no usable cert → offer manual entry.
    pendingManualDomain = domain;
    $('manualDomain').textContent = domain;
    $('manualDate').value = '';
    $('manualModal').hidden = false;
  }
});

$('manualSave').addEventListener('click', async () => {
  const v = $('manualDate').value;
  if (!v) return;
  const exp = new Date(v + 'T23:59:59').getTime();
  const { st } = await chrome.runtime.sendMessage({ type: 'get-state' });
  if (!st.domains.some(d => d.domain === pendingManualDomain)) {
    st.domains.push({ domain: pendingManualDomain, source: 'manual', expiresAt: exp, issuer: '', lastChecked: Date.now(), error: null });
    await chrome.runtime.sendMessage({ type: 'save-state', st });
  }
  $('manualModal').hidden = true;
  pendingManualDomain = null;
  $('domainInput').value = '';
  refresh();
});
$('manualCancel').addEventListener('click', () => {
  $('manualModal').hidden = true;
  pendingManualDomain = null;
});

$('refreshBtn').addEventListener('click', async () => {
  $('refreshBtn').disabled = true;
  $('refreshBtn').textContent = 'Refreshing…';
  const { st } = await chrome.runtime.sendMessage({ type: 'run-check' });
  $('refreshBtn').disabled = false;
  $('refreshBtn').textContent = 'Refresh all';
  render(st);
});

$('warnDays').addEventListener('change', async () => {
  const { st } = await chrome.runtime.sendMessage({ type: 'get-state' });
  st.warnDays = parseInt($('warnDays').value, 10);
  await chrome.runtime.sendMessage({ type: 'save-state', st });
  render(st);
});
$('alertCheck').addEventListener('change', async () => {
  const { st } = await chrome.runtime.sendMessage({ type: 'get-state' });
  st.alerts = $('alertCheck').checked;
  await chrome.runtime.sendMessage({ type: 'save-state', st });
});

document.addEventListener('DOMContentLoaded', refresh);
refresh();
