/* Header Tamper Notifier — popup: fetches the active tab's header report
 * from the background worker and renders findings + raw headers.
 */
'use strict';

const $ = (id) => document.getElementById(id);
let currentFilter = 'all';
let currentReport = null;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render() {
  const list = $('findingList');
  list.innerHTML = '';
  const badge = $('badge');

  if (!currentReport) {
    $('noData').classList.remove('hidden');
    $('cleanState').classList.add('hidden');
    badge.textContent = '—';
    badge.classList.remove('bad');
    $('pageInfo').textContent = '';
    $('rawHeaders').innerHTML = '';
    return;
  }
  $('noData').classList.add('hidden');

  const { findings, counts, url, checkedAt, headers } = currentReport;
  $('pageInfo').textContent = url + ' — checked ' + new Date(checkedAt).toLocaleTimeString();

  const total = findings.length;
  badge.textContent = total === 0 ? 'OK' : total + ' issue' + (total > 1 ? 's' : '');
  badge.classList.toggle('bad', counts.warn > 0);

  const shown = findings.filter((f) => currentFilter === 'all' || f.level === currentFilter);
  $('cleanState').classList.toggle('hidden', total !== 0);

  for (const f of shown) {
    const li = document.createElement('li');
    li.className = 'finding ' + f.level;
    li.innerHTML =
      '<div class="finding-title"><span class="level">' + esc(f.level) + '</span>' + esc(f.title) + '</div>' +
      '<div class="finding-detail">' + esc(f.detail) + '</div>';
    list.appendChild(li);
  }

  $('rawHeaders').innerHTML = headers
    .map((h) => '<div class="raw-row"><b>' + esc(h.name) + ':</b> ' + esc(h.value) + '</div>')
    .join('');
}

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.f;
    render();
  });
});

(async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id >= 0) {
      const res = await chrome.runtime.sendMessage({ type: 'getReport', tabId: tab.id });
      currentReport = res && res.report ? res.report : null;
    }
  } catch (e) {
    currentReport = null;
  }
  render();
})();
