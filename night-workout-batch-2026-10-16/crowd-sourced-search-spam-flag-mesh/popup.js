/* My Spam Flags — popup logic: list CRUD, filter/restore, export/import. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var domainInput = $('domainInput'), flagList = $('flagList'), flagCount = $('flagCount');
  var statsBox = $('stats'), statusEl = $('status'), importFile = $('importFile');

  var flags = [];

  // --- helpers -----------------------------------------------------------
  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function save() {
    return chrome.storage.local.set({ msf_flags: flags, msf_mode: mode() });
  }

  function mode() {
    var checked = document.querySelector('input[name="mode"]:checked');
    return checked ? checked.value : 'dim';
  }

  function normalizeDomain(raw) {
    var s = (raw || '').trim().toLowerCase();
    s = s.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '');
    s = s.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
    return s;
  }

  function validDomain(s) {
    return /^[a-z0-9]([a-z0-9.-]{0,61}[a-z0-9])?\.[a-z]{2,}$/.test(s);
  }

  // --- list UI -----------------------------------------------------------
  function render() {
    flagCount.textContent = flags.length;
    flagList.innerHTML = '';
    if (!flags.length) {
      var empty = document.createElement('span');
      empty.className = 'empty';
      empty.textContent = 'No flagged domains yet. Add one above.';
      flagList.appendChild(empty);
      return;
    }
    flags.slice().sort().forEach(function (d) {
      var chip = document.createElement('span');
      chip.className = 'chip';
      var label = document.createElement('span');
      label.textContent = d;
      var x = document.createElement('button');
      x.textContent = '×';
      x.title = 'Remove ' + d;
      x.setAttribute('aria-label', 'Remove ' + d);
      x.addEventListener('click', function () {
        flags = flags.filter(function (f) { return f !== d; });
        save().then(render);
        setStatus('Removed ' + d + '.', 'ok');
      });
      chip.appendChild(label);
      chip.appendChild(x);
      flagList.appendChild(chip);
    });
  }

  function addDomain() {
    var d = normalizeDomain(domainInput.value);
    if (!d) { setStatus('Type a domain first.', 'err'); return; }
    if (!validDomain(d)) { setStatus('That does not look like a valid domain.', 'err'); return; }
    if (flags.indexOf(d) !== -1) { setStatus(d + ' is already flagged.', 'err'); return; }
    flags.push(d);
    domainInput.value = '';
    save().then(render);
    setStatus('Flagged ' + d + '.', 'ok');
  }

  $('addBtn').addEventListener('click', addDomain);
  domainInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') addDomain(); });

  // --- export / import ---------------------------------------------------
  $('exportBtn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify({ app: 'my-spam-flags', version: 1, flags: flags }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'my-spam-flags.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    setStatus('Exported ' + flags.length + ' flagged domain(s).', 'ok');
  });

  importFile.addEventListener('change', function () {
    var file = importFile.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var list = Array.isArray(data) ? data : data.flags;
        if (!Array.isArray(list)) throw new Error('bad format');
        var added = 0;
        list.forEach(function (raw) {
          var d = normalizeDomain(String(raw));
          if (validDomain(d) && flags.indexOf(d) === -1) { flags.push(d); added++; }
        });
        save().then(render);
        setStatus('Imported ' + added + ' new domain(s).', 'ok');
      } catch (e) {
        setStatus('Could not read that file. Expected the exported JSON format.', 'err');
      }
      importFile.value = '';
    };
    reader.readAsText(file);
  });

  // --- page engine -------------------------------------------------------
  function activeTab() {
    return chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) { return tabs[0]; });
  }

  function ensureEngine(tabId) {
    return chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] });
  }

  function stat(n, label) {
    return '<div class="stat"><b>' + n + '</b><span>' + label + '</span></div>';
  }

  $('filterBtn').addEventListener('click', function () {
    if (!flags.length) { setStatus('Flag at least one domain first.', 'err'); return; }
    var m = mode();
    save();
    setStatus('Filtering…');
    activeTab()
      .then(function (tab) {
        if (!tab || !tab.id) throw new Error('no-tab');
        return ensureEngine(tab.id).then(function () { return tab.id; });
      })
      .then(function (tabId) {
        return chrome.tabs.sendMessage(tabId, { action: 'scan', flags: flags, mode: m });
      })
      .then(function (res) {
        if (!res) { setStatus('No response from the tab.', 'err'); return; }
        if (res.error) { setStatus('Engine error: ' + res.error, 'err'); return; }
        statsBox.hidden = false;
        statsBox.innerHTML = stat(res.total, 'cards checked') + stat(res.matched, m === 'collapse' ? 'collapsed' : 'dimmed');
        setStatus(
          res.total === 0
            ? 'No result cards found on this page. Try a search results page.'
            : 'Done — ' + res.matched + ' card(s) from your flagged domains.',
          'ok'
        );
      })
      .catch(function () {
        setStatus('Could not run on this page. Use an http(s) search results page.', 'err');
      });
  });

  $('restoreBtn').addEventListener('click', function () {
    setStatus('Restoring…');
    activeTab()
      .then(function (tab) {
        if (!tab || !tab.id) throw new Error('no-tab');
        return ensureEngine(tab.id).then(function () { return tab.id; });
      })
      .then(function (tabId) {
        return chrome.tabs.sendMessage(tabId, { action: 'restore' });
      })
      .then(function (res) {
        statsBox.hidden = true;
        statsBox.innerHTML = '';
        setStatus(res && res.restored ? 'Restored ' + res.restored + ' card(s) exactly.' : 'Page restored.', 'ok');
      })
      .catch(function () {
        setStatus('Could not reach the tab. Reload the page and try again.', 'err');
      });
  });

  // --- init --------------------------------------------------------------
  chrome.storage.local.get(['msf_flags', 'msf_mode'], function (data) {
    flags = Array.isArray(data.msf_flags) ? data.msf_flags.filter(validDomain) : [];
    if (data.msf_mode) {
      var radio = document.querySelector('input[name="mode"][value="' + data.msf_mode + '"]');
      if (radio) radio.checked = true;
    }
    render();
  });
})();
