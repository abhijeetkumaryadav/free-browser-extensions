/* Audio Description Layer — popup logic. */
'use strict';

const $ = (id) => document.getElementById(id);
let cues = []; // {t: seconds, text}

// mm:ss (or m:ss / bare seconds) -> seconds; null if invalid
function parseTime(str) {
  const s = String(str).trim();
  const m = s.match(/^(?:(\d+):)?([0-5]?\d)$/);
  if (m) {
    const mins = m[1] ? parseInt(m[1], 10) : 0;
    return mins * 60 + parseInt(m[2], 10);
  }
  if (/^\d+$/.test(s)) return parseInt(s, 10); // bare seconds, e.g. "90"
  return null;
}

function fmt(sec) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContent(tab) {
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await new Promise(r => setTimeout(r, 150));
  }
}

function setStatus(text, cls = '') {
  const el = $('status');
  el.textContent = text;
  el.className = `status ${cls}`;
}

/* ---------- cue list UI ---------- */

function renderCues() {
  const list = $('cueList');
  list.innerHTML = '';
  if (cues.length === 0) {
    list.innerHTML = '<li class="empty">No cues yet — add one above.</li>';
    return;
  }
  const sorted = cues.map((c, i) => ({ ...c, i })).sort((a, b) => a.t - b.t);
  sorted.forEach(({ t, text, i }) => {
    const li = document.createElement('li');
    li.className = 'cue';
    li.innerHTML = `
      <input class="input time" value="${fmt(t)}" data-t="${i}" aria-label="Cue time">
      <input class="input txt" value="${esc(text)}" data-x="${i}" placeholder="Describe what is shown…" aria-label="Cue text">
      <button class="del" data-d="${i}" title="Remove cue">×</button>`;
    list.appendChild(li);
  });
  list.querySelectorAll('[data-t]').forEach(inp => {
    inp.addEventListener('change', () => {
      const v = parseTime(inp.value);
      if (v === null) { setStatus('Invalid time — use mm:ss.', 'warn'); inp.value = fmt(cues[Number(inp.dataset.t)].t); return; }
      cues[Number(inp.dataset.t)].t = v;
      renderCues();
    });
  });
  list.querySelectorAll('[data-x]').forEach(inp => {
    inp.addEventListener('change', () => { cues[Number(inp.dataset.x)].text = inp.value; });
  });
  list.querySelectorAll('[data-d]').forEach(btn => {
    btn.addEventListener('click', () => { cues.splice(Number(btn.dataset.d), 1); renderCues(); });
  });
}

function addCue() {
  cues.push({ t: 0, text: '' });
  renderCues();
  const inputs = $('cueList').querySelectorAll('.time');
  const last = inputs[inputs.length - 1];
  if (last) last.focus();
}

/* ---------- page interaction ---------- */

async function findVideos() {
  setStatus('Looking for videos…');
  try {
    const tab = await activeTab();
    if (!tab || !tab.id || /^(chrome|edge|about):/.test(tab.url || '')) {
      setStatus('Cannot access this page. Open a normal website with a video.', 'warn');
      return;
    }
    await ensureContent(tab);
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'adesc-list' });
    const sel = $('videoSel');
    sel.innerHTML = '';
    if (!res.videos || res.videos.length === 0) {
      sel.innerHTML = '<option value="">No videos found on this page</option>';
      setStatus('No <video> elements found on this page.', 'warn');
      return;
    }
    res.videos.forEach(v => {
      const o = document.createElement('option');
      o.value = v.index;
      o.textContent = v.label;
      sel.appendChild(o);
    });
    setStatus(`Found ${res.videos.length} video${res.videos.length > 1 ? 's' : ''}. Add cues, then start the track.`, 'ok');
  } catch (err) {
    setStatus('Failed: ' + (err && err.message ? err.message : err), 'warn');
  }
}

function readOpts() {
  return {
    rate: parseFloat($('rate').value),
    pitch: parseFloat($('pitch').value),
    volume: parseFloat($('vol').value)
  };
}

function validCues() {
  return cues.filter(c => c.text && c.text.trim() && typeof c.t === 'number');
}

async function start() {
  const list = validCues();
  if (list.length === 0) { setStatus('Add at least one cue with text first.', 'warn'); return; }
  const sel = $('videoSel');
  if (!sel.value) { setStatus('Find a video first.', 'warn'); return; }
  setStatus('Starting description track…');
  try {
    const tab = await activeTab();
    await ensureContent(tab);
    const res = await chrome.tabs.sendMessage(tab.id, {
      type: 'adesc-start',
      videoIndex: Number(sel.value),
      cues: list,
      opts: readOpts()
    });
    if (res && res.ok) {
      setStatus(`Track live: ${res.count} cues will be spoken as the video plays. Press Stop to end.`, 'ok');
      $('startBtn').disabled = true;
    } else {
      setStatus('Could not start: ' + ((res && res.error) || 'unknown error'), 'warn');
    }
  } catch (err) {
    setStatus('Failed: ' + (err && err.message ? err.message : err), 'warn');
  }
}

async function stop() {
  try {
    const tab = await activeTab();
    if (tab && tab.id) await chrome.tabs.sendMessage(tab.id, { type: 'adesc-stop' });
  } catch { /* not injected */ }
  $('startBtn').disabled = false;
  setStatus('Track stopped.');
}

/* ---------- persistence ---------- */

async function siteKey() {
  const tab = await activeTab();
  try {
    const u = new URL(tab.url);
    return `adesc:${u.origin}`;
  } catch { return 'adesc:unknown'; }
}

async function saveCues() {
  const key = await siteKey();
  await chrome.storage.local.set({ [key]: { cues: validCues(), opts: readOpts(), savedAt: Date.now() } });
  setStatus('Cues saved for this site.', 'ok');
}

async function loadCues() {
  const key = await siteKey();
  const data = await chrome.storage.local.get(key);
  const saved = data[key];
  if (saved && Array.isArray(saved.cues)) {
    cues = saved.cues;
    if (saved.opts) {
      $('rate').value = saved.opts.rate; $('rateV').textContent = Number(saved.opts.rate).toFixed(1);
      $('pitch').value = saved.opts.pitch; $('pitchV').textContent = Number(saved.opts.pitch).toFixed(1);
      $('vol').value = saved.opts.volume; $('volV').textContent = Number(saved.opts.volume).toFixed(1);
    }
    renderCues();
  }
}

function exportCues() {
  const blob = new Blob([JSON.stringify({ cues: validCues(), exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'audio-description-cues.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importCues(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      const arr = Array.isArray(data) ? data : data.cues;
      if (!Array.isArray(arr)) throw new Error('bad format');
      cues = arr
        .filter(c => c && typeof c.text === 'string')
        .map(c => ({ t: Number(c.t) >= 0 ? Math.floor(Number(c.t)) : 0, text: c.text }));
      renderCues();
      setStatus(`Imported ${cues.length} cues.`, 'ok');
    } catch { setStatus('Import failed: not a valid cue file.', 'warn'); }
  };
  r.readAsText(file);
}

/* ---------- wiring ---------- */

$('findBtn').addEventListener('click', findVideos);
$('addCueBtn').addEventListener('click', addCue);
$('startBtn').addEventListener('click', start);
$('stopBtn').addEventListener('click', stop);
$('saveBtn').addEventListener('click', saveCues);
$('exportBtn').addEventListener('click', exportCues);
$('importFile').addEventListener('change', (e) => { if (e.target.files[0]) importCues(e.target.files[0]); });
[['rate', 'rateV'], ['pitch', 'pitchV'], ['vol', 'volV']].forEach(([a, b]) => {
  $(a).addEventListener('input', () => { $(b).textContent = Number($(a).value).toFixed(1); });
});

renderCues();
loadCues();
