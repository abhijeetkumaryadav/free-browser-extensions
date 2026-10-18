/* EverTimer popup logic — live 1s refresh while open. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var mode = 'countdown';
  var timers = [];
  var serverNow = Date.now();
  var fetchedAt = Date.now();

  function send(type, payload) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage(Object.assign({ type: type }, payload || {}), resolve);
    });
  }

  /* Local clock estimate between refreshes. */
  function now() { return serverNow + (Date.now() - fetchedAt); }

  function fmt(ms) {
    ms = Math.max(0, Math.round(ms / 1000) * 1000);
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    function p(n) { return String(n).padStart(2, '0'); }
    return h > 0 ? h + ':' + p(m) + ':' + p(sec) : p(m) + ':' + p(sec);
  }

  function liveMs(t) {
    if (t.kind === 'countdown') {
      if (t.state === 'running') return Math.max(0, t.endAt - now());
      return t.remainingMs;
    }
    if (t.state === 'running') return t.baseMs + (now() - t.startedAt);
    return t.baseMs;
  }

  function render() {
    var list = $('timerList');
    list.innerHTML = '';
    $('timerEmpty').style.display = timers.length ? 'none' : 'block';

    timers.forEach(function (t) {
      var li = document.createElement('li');
      li.className = 'timer' + (t.state === 'done' ? ' done' : '');

      var top = document.createElement('div');
      top.className = 'timer-top';
      var name = document.createElement('span');
      name.className = 'timer-name';
      name.textContent = t.name;
      var kind = document.createElement('span');
      kind.className = 'timer-kind';
      kind.textContent = t.kind === 'countdown' ? 'countdown' : 'stopwatch';
      top.appendChild(name);
      top.appendChild(kind);

      var time = document.createElement('div');
      time.className = 'timer-time' + (t.state === 'done' ? ' done' : '');
      var ms = liveMs(t);
      time.textContent = t.state === 'done' ? "Time's up!" : fmt(ms);

      li.appendChild(top);
      li.appendChild(time);

      if (t.kind === 'countdown' && t.durationMs > 0) {
        var bar = document.createElement('div');
        bar.className = 'progress';
        var fill = document.createElement('div');
        fill.style.width = (t.state === 'done' ? 100 : (100 * (1 - ms / t.durationMs))).toFixed(1) + '%';
        bar.appendChild(fill);
        li.appendChild(bar);
      }

      var actions = document.createElement('div');
      actions.className = 'timer-actions';

      function btn(label, cls, fn) {
        var b = document.createElement('button');
        b.textContent = label;
        if (cls) b.className = cls;
        b.addEventListener('click', fn);
        actions.appendChild(b);
      }

      if (t.state === 'running') btn('Pause', '', function () { act('pause', t.id); });
      if (t.state === 'paused') btn('Resume', '', function () { act('resume', t.id); });
      if (t.state !== 'done') btn('Reset', '', function () { act('reset', t.id); });
      else btn('Restart', '', function () { act('reset', t.id); });
      btn('Delete', 'danger', function () { act('remove', t.id); });

      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  async function act(type, id) {
    await send(type, { id: id });
    await refresh(false);
  }

  async function refresh(rerender) {
    var r = await send('list');
    timers = r.timers || [];
    serverNow = r.now;
    fetchedAt = Date.now();
    if (rerender !== false) render();
  }

  /* New-timer form */
  function setMode(m) {
    mode = m;
    $('modeCountdown').classList.toggle('active', m === 'countdown');
    $('modeStopwatch').classList.toggle('active', m === 'stopwatch');
    $('durationRow').style.display = m === 'countdown' ? 'flex' : 'none';
  }
  $('modeCountdown').addEventListener('click', function () { setMode('countdown'); });
  $('modeStopwatch').addEventListener('click', function () { setMode('stopwatch'); });

  document.querySelectorAll('.quick button').forEach(function (b) {
    b.addEventListener('click', function () { $('minInput').value = b.dataset.min; });
  });

  $('addBtn').addEventListener('click', async function () {
    var name = $('nameInput').value.trim();
    if (mode === 'countdown') {
      var mins = Math.max(1, Math.min(9999, parseInt($('minInput').value, 10) || 25));
      await send('addCountdown', { name: name || 'Timer', durationMs: mins * 60000 });
    } else {
      await send('addStopwatch', { name: name || 'Stopwatch' });
    }
    $('nameInput').value = '';
    await refresh(false);
  });

  /* Live tick + periodic resync with the service worker. */
  setInterval(render, 1000);
  setInterval(function () { refresh(false); }, 15000);

  setMode('countdown');
  refresh();
})();
