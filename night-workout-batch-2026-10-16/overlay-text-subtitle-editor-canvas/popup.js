/* Subtitle Editor — SRT parse/edit with a canvas preview. All local. */

const $ = (id) => document.getElementById(id);
let cues = []; // { start(ms), end(ms), text }

$('file').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => loadSrt(String(r.result || ''));
  r.readAsText(f);
  e.target.value = '';
});
$('pasteBtn').addEventListener('click', () => {
  $('pasteArea').classList.toggle('hidden');
  $('loadPaste').classList.toggle('hidden');
});
$('loadPaste').addEventListener('click', () => {
  loadSrt($('pasteArea').value);
  $('pasteArea').classList.add('hidden');
  $('loadPaste').classList.add('hidden');
});
$('clearBtn').addEventListener('click', () => { cues = []; render(); });

/* ---------- SRT parse / serialize ---------- */
function tsToMs(ts) {
  const m = /^(\d+):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(ts.trim());
  if (!m) return null;
  return (+m[1]) * 3600000 + (+m[2]) * 60000 + (+m[3]) * 1000 + (+('' + m[4]).padEnd(3, '0'));
}
function msToTs(ms) {
  ms = Math.max(0, Math.round(ms));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000);
  const s = Math.floor(ms % 60000 / 1000), x = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(x).padStart(3, '0')}`;
}
function loadSrt(text) {
  const parsed = [];
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
  for (const b of blocks) {
    const lines = b.split('\n').map((l) => l.trimEnd()).filter((l) => l.length);
    if (lines.length < 2) continue;
    let ti = 0;
    if (/^\d+$/.test(lines[0])) ti = 1; // optional cue number
    if (ti >= lines.length) continue;
    const m = /^(.+?)\s*-->\s*(.+)$/.exec(lines[ti]);
    if (!m) continue;
    const start = tsToMs(m[1]), end = tsToMs(m[2]);
    if (start === null || end === null) continue;
    parsed.push({ start, end, text: lines.slice(ti + 1).join('\n') });
  }
  if (!parsed.length) { showErr('No valid SRT cues found.'); return; }
  showErr('');
  cues = parsed;
  render();
}
function serialize() {
  return cues.map((c, i) => `${i + 1}\n${msToTs(c.start)} --> ${msToTs(c.end)}\n${c.text}`).join('\n\n') + '\n';
}
function showErr(m) { $('err').textContent = m; }

/* ---------- cue list ---------- */
function render() {
  const box = $('cues');
  box.innerHTML = '';
  if (!cues.length) box.innerHTML = '<p class="empty">No subtitles loaded yet.</p>';
  cues.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'cue';
    div.innerHTML = `
      <div class="times">
        <input class="tStart" value="${msToTs(c.start)}" title="Start time">
        <span>→</span>
        <input class="tEnd" value="${msToTs(c.end)}" title="End time">
        <button title="Delete cue">✕</button>
      </div>
      <textarea rows="2"></textarea>`;
    const ta = div.querySelector('textarea');
    ta.value = c.text;
    ta.addEventListener('input', () => { c.text = ta.value; drawPreview(); });
    const sync = () => {
      const s = tsToMs(div.querySelector('.tStart').value), e = tsToMs(div.querySelector('.tEnd').value);
      if (s !== null) c.start = s;
      if (e !== null) c.end = e;
      updateScrubRange();
      drawPreview();
    };
    div.querySelector('.tStart').addEventListener('change', sync);
    div.querySelector('.tEnd').addEventListener('change', sync);
    div.querySelector('button').addEventListener('click', () => { cues.splice(i, 1); render(); });
    box.appendChild(div);
  });
  $('download').disabled = cues.length === 0;
  updateScrubRange();
  drawPreview();
}

$('addCue').addEventListener('click', () => {
  const lastEnd = cues.length ? cues[cues.length - 1].end : 0;
  cues.push({ start: lastEnd, end: lastEnd + 2000, text: 'New subtitle' });
  render();
});
$('download').addEventListener('click', () => {
  const blob = new Blob([serialize()], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'edited.srt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

/* ---------- canvas preview ---------- */
const stage = $('stage');
const ctx = stage.getContext('2d');

function cueAt(ms) { return cues.find((c) => ms >= c.start && ms <= c.end) || null; }

function drawPreview() {
  const t = +$('time').value || 0;
  const W = stage.width, H = stage.height;
  ctx.fillStyle = '#0a0a10';
  ctx.fillRect(0, 0, W, H);
  // faint letterbox guides
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  ctx.strokeRect(8.5, 8.5, W - 17, H - 17);
  const cue = cueAt(t);
  if (!cue || !cue.text.trim()) {
    ctx.fillStyle = '#55556a';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('— no cue at this time —', W / 2, H / 2);
    return;
  }
  const size = +$('fontSize').value;
  ctx.font = `${size}px system-ui`;
  ctx.textAlign = 'center';
  const lines = cue.text.split('\n');
  const lh = size * 1.35;
  const y0 = H - 14 - lh * (lines.length - 1);
  lines.forEach((ln, i) => {
    const y = y0 + i * lh;
    const w = ctx.measureText(ln).width;
    ctx.fillStyle = $('bg').value + 'cc';
    ctx.fillRect(W / 2 - w / 2 - 8, y - size - 4, w + 16, size + 10);
    ctx.fillStyle = $('fg').value;
    ctx.fillText(ln, W / 2, y);
  });
}

function updateScrubRange() {
  const max = cues.length ? Math.max(...cues.map((c) => c.end)) : 0;
  const t = $('time');
  t.max = max;
  if (+t.value > max) t.value = 0;
  label();
}
function label() {
  const ms = +$('time').value || 0;
  $('timeLabel').textContent = `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
}
$('time').addEventListener('input', () => { label(); drawPreview(); });
['fontSize', 'fg', 'bg'].forEach((id) => $(id).addEventListener('input', drawPreview));

drawPreview();
