/* NetLock popup logic. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var state = null;

  function send(type, payload) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage(Object.assign({ type: type }, payload || {}), resolve);
    });
  }

  function render() {
    if (!state) return;
    $('domainLabel').textContent = state.domain || '—';

    var pill = $('statusPill');
    pill.textContent = state.locked ? 'Locked' : 'Open';
    pill.classList.toggle('locked', state.locked);

    var lockBtn = $('lockBtn');
    var unlockBtn = $('unlockBtn');
    lockBtn.classList.toggle('hidden', state.locked);
    unlockBtn.classList.toggle('hidden', !state.locked);
    lockBtn.disabled = !state.lockable || state.locked;
    unlockBtn.disabled = !state.locked;

    var hint = $('hint');
    hint.className = 'hint';
    if (!state.lockable) {
      hint.textContent = 'Lockout works on regular http(s) pages only.';
    } else if (state.locked) {
      hint.textContent = 'This tab is frozen. Unlock to restore its network — the page will reload.';
    } else {
      hint.textContent = 'One click freezes this tab: no fetch, XHR, WebSocket or new loads.';
    }

    var deep = $('deepToggle');
    deep.setAttribute('aria-checked', state.settings.deepBlock ? 'true' : 'false');

    var list = $('domainList');
    list.innerHTML = '';
    var domains = state.settings.autoDomains || [];
    $('domainEmpty').style.display = domains.length ? 'none' : 'block';
    domains.forEach(function (d) {
      var li = document.createElement('li');
      var span = document.createElement('span');
      span.textContent = d;
      var btn = document.createElement('button');
      btn.className = 'remove';
      btn.textContent = '×';
      btn.title = 'Remove';
      btn.addEventListener('click', async function () {
        var r = await send('removeAutoDomain', { domain: d });
        state.settings.autoDomains = r.autoDomains;
        render();
      });
      li.appendChild(span);
      li.appendChild(btn);
      list.appendChild(li);
    });

    $('addDomainBtn').disabled = !state.domain;
  }

  async function refresh() {
    state = await send('getState');
    render();
  }

  $('lockBtn').addEventListener('click', async function () {
    var hint = $('hint');
    hint.className = 'hint';
    hint.textContent = 'Locking…';
    var r = await send('lock', { tabId: state.tabId });
    if (!r.ok) {
      hint.className = 'hint error';
      hint.textContent = r.reason || 'Could not lock this tab.';
      return;
    }
    await refresh();
  });

  $('unlockBtn').addEventListener('click', async function () {
    await send('unlock', { tabId: state.tabId });
    await refresh();
  });

  $('deepToggle').addEventListener('click', async function () {
    var next = $('deepToggle').getAttribute('aria-checked') !== 'true';
    var r = await send('toggleDeepBlock', { value: next });
    state.settings.deepBlock = r.deepBlock;
    render();
  });

  $('addDomainBtn').addEventListener('click', async function () {
    if (!state.domain) return;
    var r = await send('addAutoDomain', { domain: state.domain });
    state.settings.autoDomains = r.autoDomains;
    render();
  });

  refresh();
})();
