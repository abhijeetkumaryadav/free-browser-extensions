/* Local Code Sandbox — popup logic.
   Owns: editor, snippet history (chrome.storage.local), run lifecycle,
   and the hidden sandboxed runner <iframe>. The runner page executes
   user code; this file only relays messages and renders output. */
(function () {
  'use strict';

  var STORE_KEY = 'sandbox_snippets_v1';
  var MAX_SNIPPETS = 50;

  var editor = document.getElementById('editor');
  var nameInput = document.getElementById('snippetName');
  var runBtn = document.getElementById('runBtn');
  var saveBtn = document.getElementById('saveBtn');
  var clearBtn = document.getElementById('clearBtn');
  var outputEl = document.getElementById('output');
  var statusEl = document.getElementById('status');
  var listEl = document.getElementById('snippetList');

  // ---- Hidden sandboxed runner frame -------------------------------------
  var runner = document.createElement('iframe');
  runner.setAttribute('sandbox', 'allow-scripts');
  runner.style.display = 'none';
  runner.src = chrome.runtime.getURL('sandbox.html');
  document.body.appendChild(runner);

  var runnerReady = false;
  var pendingRun = null; // { runId, code } queued while runner boots
  var runSeq = 0;
  var activeRunId = null;

  window.addEventListener('message', function (ev) {
    var d = ev.data || {};
    if (d.type === 'sandbox-ready') {
      runnerReady = true;
      if (pendingRun) { startRun(pendingRun.code); pendingRun = null; }
      return;
    }
    if (d.runId !== activeRunId) return; // ignore stale runs
    if (d.type === 'sandbox-output') appendLine(d.kind, d.text);
    if (d.type === 'sandbox-done') finishRun();
  });

  // ---- Output rendering ----------------------------------------------------
  function clearOutputPlaceholder() {
    var ph = outputEl.querySelector('.empty');
    if (ph) ph.remove();
  }

  function appendLine(kind, text) {
    clearOutputPlaceholder();
    var div = document.createElement('div');
    div.className = 'line ' + kind;
    var tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = kind === 'error' ? 'ERROR' : kind === 'warn' ? 'WARN' : kind === 'result' ? 'RETURN' : 'LOG';
    div.appendChild(tag);
    div.appendChild(document.createTextNode(text));
    outputEl.appendChild(div);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (cls ? ' ' + cls : '');
  }

  function startRun(code) {
    activeRunId = ++runSeq;
    setStatus('Running…', 'running');
    runner.contentWindow.postMessage({ type: 'sandbox-run', runId: activeRunId, code: code }, '*');
  }

  function finishRun() {
    activeRunId = null;
    setStatus('Done');
  }

  runBtn.addEventListener('click', function () {
    var code = editor.value;
    if (!code.trim()) { setStatus('Nothing to run'); return; }
    if (runnerReady) startRun(code);
    else { pendingRun = { code: code }; setStatus('Starting runner…', 'running'); }
  });

  clearBtn.addEventListener('click', function () {
    outputEl.innerHTML = '<div class="empty">Run a snippet to see output here.</div>';
    setStatus('');
  });

  // ---- Snippet history ------------------------------------------------------
  function loadSnippets(cb) {
    chrome.storage.local.get([STORE_KEY], function (res) {
      cb(Array.isArray(res[STORE_KEY]) ? res[STORE_KEY] : []);
    });
  }

  function saveSnippets(snippets, cb) {
    var o = {}; o[STORE_KEY] = snippets;
    chrome.storage.local.set(o, cb || function () {});
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderList(snippets) {
    listEl.innerHTML = '';
    if (!snippets.length) {
      listEl.innerHTML = '<li class="empty">No saved snippets yet.</li>';
      return;
    }
    snippets.forEach(function (s) {
      var li = document.createElement('li');
      li.className = 'snippet';
      var when = new Date(s.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      li.innerHTML =
        '<span class="name" title="' + esc(s.name) + '">' + esc(s.name) + '</span>' +
        '<span class="date">' + esc(when) + '</span>' +
        '<button class="icon-btn load" title="Load into editor"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg></button>' +
        '<button class="icon-btn danger del" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
      li.querySelector('.load').addEventListener('click', function () {
        editor.value = s.code;
        nameInput.value = s.name;
        setStatus('Loaded "' + s.name + '"');
      });
      li.querySelector('.del').addEventListener('click', function () {
        loadSnippets(function (all) {
          saveSnippets(all.filter(function (x) { return x.id !== s.id; }), function () { refreshList(); });
        });
      });
      listEl.appendChild(li);
    });
  }

  function refreshList() { loadSnippets(renderList); }

  saveBtn.addEventListener('click', function () {
    var name = nameInput.value.trim() || ('Snippet ' + new Date().toLocaleString());
    var code = editor.value;
    if (!code.trim()) { setStatus('Nothing to save'); return; }
    loadSnippets(function (all) {
      var entry = { id: 's' + Date.now(), name: name, code: code, updatedAt: Date.now() };
      all.unshift(entry);
      saveSnippets(all.slice(0, MAX_SNIPPETS), function () {
        nameInput.value = '';
        setStatus('Saved');
        refreshList();
      });
    });
  });

  refreshList();
})();
