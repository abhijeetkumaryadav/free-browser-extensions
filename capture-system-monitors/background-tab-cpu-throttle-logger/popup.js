/* TabState Log popup: renders the current tab table + the stored event log,
 * and offers JSON/TXT export via blob downloads (no `downloads` permission). */

var $ = function (id) { return document.getElementById(id); };

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtTime(ts) {
  var d = new Date(ts);
  return d.toLocaleTimeString([], { hour12: false }) + '.' +
    String(d.getMilliseconds()).padStart(3, '0');
}
function fmtDateTime(ts) {
  var d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour12: false });
}

/* ---------- current tabs ---------- */

async function renderTabs() {
  var list = $('tabList');
  try {
    var tabs = await chrome.tabs.query({});
    if (!tabs.length) {
      list.innerHTML = '<div class="empty">No tabs found.</div>';
      return;
    }
    list.innerHTML = tabs.map(function (t) {
      var badges = '';
      if (t.active) badges += '<span class="badge active">ACTIVE</span>';
      if (t.audible) badges += '<span class="badge audible">AUDIBLE</span>';
      if (t.discarded) badges += '<span class="badge discarded">DISCARDED</span>';
      if (!badges) badges = '<span class="badge">IDLE</span>';
      var title = t.title || '(no title)';
      return '<div class="tab-row"><span class="tab-title" title="' + esc(title) + '">' +
        esc(title) + '</span><span class="badges">' + badges + '</span></div>';
    }).join('');
  } catch (e) {
    list.innerHTML = '<div class="empty">Could not read tabs.</div>';
  }
}

/* ---------- event log ---------- */

async function renderLog() {
  var list = $('logList');
  var data = await chrome.storage.local.get({ tabLog: [] });
  var log = data.tabLog;
  if (!log.length) {
    list.innerHTML = '<div class="empty">No events yet. Events appear as tabs change state.</div>';
    return;
  }
  // Newest first.
  var rows = log.slice().reverse().map(function (ev) {
    return '<div class="log-row"><span class="log-time">' + fmtTime(ev.ts) + '</span>' +
      '<span class="log-type">' + esc(ev.type) + '</span>' +
      '<span class="log-detail">' + esc(ev.detail || ('tab ' + ev.tabId)) + '</span></div>';
  });
  list.innerHTML = rows.join('');
}

/* ---------- export ---------- */

function download(filename, text, mime) {
  var blob = new Blob([text], { type: mime });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

function logToText(log) {
  return log.map(function (ev) {
    return '[' + fmtDateTime(ev.ts) + '] ' + ev.type +
      ' (tab ' + ev.tabId + ')' + (ev.detail ? ' — ' + ev.detail : '');
  }).join('\n');
}

document.addEventListener('DOMContentLoaded', function () {
  renderTabs();
  renderLog();

  $('refreshTabs').addEventListener('click', renderTabs);

  $('exportJson').addEventListener('click', async function () {
    var data = await chrome.storage.local.get({ tabLog: [] });
    download('tabstate-log.json', JSON.stringify(data.tabLog, null, 2), 'application/json');
  });

  $('exportTxt').addEventListener('click', async function () {
    var data = await chrome.storage.local.get({ tabLog: [] });
    download('tabstate-log.txt', logToText(data.tabLog), 'text/plain');
  });

  $('clearLog').addEventListener('click', async function () {
    await chrome.storage.local.set({ tabLog: [] });
    renderLog();
  });
});
