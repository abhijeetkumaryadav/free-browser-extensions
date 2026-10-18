// floating-subtitle-srt-auto-generator — popup.js
// Manual SRT editor UI. Uses srt.js for parsing/formatting/validation.
// Every cue is user-typed; this extension never generates text from audio.
(function () {
  'use strict';

  var startEl = document.getElementById('start');
  var endEl = document.getElementById('end');
  var textEl = document.getElementById('text');
  var formError = document.getElementById('formError');
  var addBtn = document.getElementById('add');
  var updateBtn = document.getElementById('update');
  var cancelEditBtn = document.getElementById('cancelEdit');
  var exportBtn = document.getElementById('export');
  var clearBtn = document.getElementById('clear');
  var listEl = document.getElementById('cuelist');
  var countEl = document.getElementById('count');
  var emptyCues = document.getElementById('emptyCues');

  var cues = [];       // { id, start (ms), end (ms), text }
  var editingId = null;
  var nextId = 1;

  function save() {
    chrome.storage.local.set({ srtCues: cues, srtNextId: nextId });
  }

  function showError(msg) {
    formError.hidden = !msg;
    formError.textContent = msg || '';
  }

  function readForm() {
    var cue = {
      start: parseTimestamp(startEl.value),
      end: parseTimestamp(endEl.value),
      text: textEl.value
    };
    var errors = validateCue(cue);
    showError(errors.length ? errors.join(' ') : '');
    return errors.length ? null : cue;
  }

  function resetForm() {
    startEl.value = '';
    endEl.value = '';
    textEl.value = '';
    editingId = null;
    addBtn.hidden = false;
    updateBtn.hidden = true;
    cancelEditBtn.hidden = true;
    showError('');
    render();
  }

  addBtn.addEventListener('click', function () {
    var cue = readForm();
    if (!cue) return;
    cues.push({ id: nextId++, start: cue.start, end: cue.end, text: cue.text });
    save();
    resetForm();
  });

  updateBtn.addEventListener('click', function () {
    var cue = readForm();
    if (!cue || editingId == null) return;
    var target = cues.find(function (c) { return c.id === editingId; });
    if (target) {
      target.start = cue.start;
      target.end = cue.end;
      target.text = cue.text;
      save();
    }
    resetForm();
  });

  cancelEditBtn.addEventListener('click', resetForm);

  function render() {
    var sorted = sortCues(cues);
    countEl.textContent = cues.length;
    emptyCues.hidden = cues.length > 0;
    listEl.textContent = '';
    sorted.forEach(function (cue, i) {
      var li = document.createElement('li');
      li.className = 'cue' + (cue.id === editingId ? ' editing' : '');

      var top = document.createElement('div');
      top.className = 'cue-top';
      var num = document.createElement('span');
      num.className = 'cue-num';
      num.textContent = i + 1;
      var time = document.createElement('span');
      time.className = 'cue-time';
      time.textContent = formatTimestamp(cue.start) + ' --> ' + formatTimestamp(cue.end);
      top.appendChild(num);
      top.appendChild(time);

      var p = document.createElement('div');
      p.className = 'cue-text';
      p.textContent = cue.text;

      var actions = document.createElement('div');
      actions.className = 'cue-actions';

      var up = document.createElement('button');
      up.className = 'mini'; up.textContent = 'Up';
      up.addEventListener('click', function () { nudge(cue.id, -1); });

      var down = document.createElement('button');
      down.className = 'mini'; down.textContent = 'Down';
      down.addEventListener('click', function () { nudge(cue.id, 1); });

      var edit = document.createElement('button');
      edit.className = 'mini'; edit.textContent = 'Edit';
      edit.addEventListener('click', function () { beginEdit(cue.id); });

      var del = document.createElement('button');
      del.className = 'mini danger'; del.textContent = 'Delete';
      del.addEventListener('click', function () {
        cues = cues.filter(function (c) { return c.id !== cue.id; });
        if (editingId === cue.id) resetForm(); else { save(); render(); }
      });

      actions.appendChild(up);
      actions.appendChild(down);
      actions.appendChild(edit);
      actions.appendChild(del);

      li.appendChild(top);
      li.appendChild(p);
      li.appendChild(actions);
      listEl.appendChild(li);
    });
  }

  // Nudge a cue earlier/later among overlapping neighbours by swapping times.
  function nudge(id, dir) {
    var sorted = sortCues(cues);
    var idx = sorted.findIndex(function (c) { return c.id === id; });
    var j = idx + dir;
    if (idx < 0 || j < 0 || j >= sorted.length) return;
    var a = sorted[idx], b = sorted[j];
    var ts = a.start, te = a.end;
    a.start = b.start; a.end = b.end;
    b.start = ts; b.end = te;
    save();
    render();
  }

  function beginEdit(id) {
    var cue = cues.find(function (c) { return c.id === id; });
    if (!cue) return;
    editingId = id;
    startEl.value = formatTimestamp(cue.start);
    endEl.value = formatTimestamp(cue.end);
    textEl.value = cue.text;
    addBtn.hidden = true;
    updateBtn.hidden = false;
    cancelEditBtn.hidden = false;
    showError('');
    render();
    startEl.focus();
  }

  exportBtn.addEventListener('click', function () {
    if (!cues.length) return;
    var srt = toSrt(cues);
    var blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.srt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  });

  clearBtn.addEventListener('click', function () {
    if (!cues.length) return;
    if (!confirm('Delete all ' + cues.length + ' cues?')) return;
    cues = [];
    save();
    resetForm();
  });

  // Restore saved cues.
  chrome.storage.local.get(['srtCues', 'srtNextId'], function (data) {
    if (data && Array.isArray(data.srtCues)) cues = data.srtCues;
    if (data && typeof data.srtNextId === 'number') nextId = data.srtNextId;
    render();
  });
})();
