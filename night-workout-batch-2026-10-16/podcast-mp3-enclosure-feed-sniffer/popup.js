// podcast-mp3-enclosure-feed-sniffer — popup.js
// Wires up the popup: injects content.js ONLY on explicit user click,
// renders found audio/feed links, and persists the last scan.
(function () {
  'use strict';

  var scanBtn = document.getElementById('scan');
  var clearBtn = document.getElementById('clear');
  var emptyEl = document.getElementById('empty');
  var resultsEl = document.getElementById('results');
  var summaryEl = document.getElementById('summary');
  var listEl = document.getElementById('list');

  function render(scan) {
    if (!scan || !scan.items || scan.items.length === 0) {
      emptyEl.hidden = false;
      resultsEl.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    resultsEl.hidden = false;
    var audioCount = scan.items.filter(function (i) { return i.type !== 'feed'; }).length;
    var feedCount = scan.items.length - audioCount;
    summaryEl.textContent =
      'Found ' + audioCount + ' audio link' + (audioCount === 1 ? '' : 's') +
      ' and ' + feedCount + ' feed link' + (feedCount === 1 ? '' : 's') +
      (scan.page ? ' on "' + scan.page + '"' : '') + '.';

    listEl.textContent = '';
    scan.items.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'card';

      var head = document.createElement('div');
      head.className = 'card-head';
      var badge = document.createElement('span');
      badge.className = 'badge' + (item.type === 'feed' ? ' feed' : '');
      badge.textContent = item.type === 'feed' ? 'FEED' : item.format;
      var name = document.createElement('span');
      name.className = 'card-name';
      name.textContent = item.name;
      head.appendChild(badge);
      head.appendChild(name);

      var hint = document.createElement('div');
      hint.className = 'card-hint';
      hint.textContent = item.hint;

      var actions = document.createElement('div');
      actions.className = 'card-actions';

      var open = document.createElement('a');
      open.className = 'chip';
      open.href = item.url;
      open.target = '_blank';
      open.rel = 'noopener';
      open.textContent = 'Open link';
      actions.appendChild(open);

      var copy = document.createElement('a');
      copy.className = 'chip';
      copy.href = '#';
      copy.textContent = 'Copy URL';
      copy.addEventListener('click', function (ev) {
        ev.preventDefault();
        navigator.clipboard.writeText(item.url).then(function () {
          copy.textContent = 'Copied!';
          setTimeout(function () { copy.textContent = 'Copy URL'; }, 1200);
        });
      });
      actions.appendChild(copy);

      li.appendChild(head);
      li.appendChild(hint);
      li.appendChild(actions);
      listEl.appendChild(li);
    });
  }

  scanBtn.addEventListener('click', function () {
    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning…';
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab || !tab.id) {
        scanBtn.textContent = 'Scan this page';
        scanBtn.disabled = false;
        return;
      }
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, files: ['content.js'] },
        function (injection) {
          scanBtn.textContent = 'Scan this page';
          scanBtn.disabled = false;
          if (chrome.runtime.lastError || !injection || !injection[0]) {
            summaryEl.textContent = 'Could not scan this page (browser pages are protected).';
            emptyEl.hidden = true;
            resultsEl.hidden = false;
            listEl.textContent = '';
            return;
          }
          var scan = injection[0].result || { items: [] };
          chrome.storage.local.set({ lastScan: scan });
          render(scan);
        }
      );
    });
  });

  clearBtn.addEventListener('click', function () {
    chrome.storage.local.remove('lastScan', function () { render(null); });
  });

  // Restore the last scan.
  chrome.storage.local.get('lastScan', function (data) {
    if (data && data.lastScan) render(data.lastScan);
  });
})();
