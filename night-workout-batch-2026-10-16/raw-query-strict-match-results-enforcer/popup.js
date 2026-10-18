/* Strict Match Filter — popup logic. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var termsInput = $('terms'), statsBox = $('stats'), statusEl = $('status');

  // Restore last-used terms and mode.
  chrome.storage.local.get(['smf_terms', 'smf_mode'], function (data) {
    if (data.smf_terms) termsInput.value = data.smf_terms;
    if (data.smf_mode) {
      var radio = document.querySelector('input[name="mode"][value="' + data.smf_mode + '"]');
      if (radio) radio.checked = true;
    }
  });

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function mode() {
    var checked = document.querySelector('input[name="mode"]:checked');
    return checked ? checked.value : 'dim';
  }

  function activeTab() {
    return chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) { return tabs[0]; });
  }

  function ensureEngine(tabId) {
    return chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] });
  }

  $('filterBtn').addEventListener('click', function () {
    var raw = termsInput.value.trim();
    if (!raw) { setStatus('Type at least one term first.', 'err'); return; }
    var terms = raw.toLowerCase().split(/\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var m = mode();
    chrome.storage.local.set({ smf_terms: raw, smf_mode: m });
    setStatus('Filtering…');
    activeTab()
      .then(function (tab) {
        if (!tab || !tab.id) throw new Error('no-tab');
        return ensureEngine(tab.id).then(function () { return tab.id; });
      })
      .then(function (tabId) {
        return chrome.tabs.sendMessage(tabId, { action: 'scan', terms: terms, mode: m });
      })
      .then(function (res) {
        if (!res) { setStatus('No response from the tab.', 'err'); return; }
        if (res.error) { setStatus('Engine error: ' + res.error, 'err'); return; }
        statsBox.hidden = false;
        statsBox.innerHTML =
          stat(res.total, 'cards checked') +
          stat(res.kept, 'matched all terms') +
          stat(res.dimmed, m === 'collapse' ? 'collapsed' : 'dimmed');
        setStatus(
          res.total === 0
            ? 'No result cards found on this page. Try a search results page.'
            : 'Done — cards missing any term were ' + (m === 'collapse' ? 'collapsed' : 'dimmed') + '.',
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

  function stat(n, label) {
    return '<div class="stat"><b>' + n + '</b><span>' + label + '</span></div>';
  }

  termsInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('filterBtn').click();
  });
})();
