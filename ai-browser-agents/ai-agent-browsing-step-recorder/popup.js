/* StepLog popup — session list, timeline detail, annotations, exports. */
'use strict';

const $ = (id) => document.getElementById(id);
const toggleBtn = $('toggle'), statusEl = $('status'), recDot = $('recDot');
const listView = $('listView'), detailView = $('detailView');
const sessionList = $('sessionList'), timeline = $('timeline');
const toast = $('toast');

let recording = false;
let activeSessionId = null;

const ICONS = {
  navigation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  click: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 9 5 12 1.8-5.2L21 14Z"/><path d="M7.2 2.2 8 5.1"/><path d="M5.1 8 2.2 7.2"/><path d="M14 4.1 12 6"/><path d="m6 12-1.9 2"/></svg>',
  fill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
};

function msg(kind, extra) {
  return chrome.runtime.sendMessage({ kind, ...extra });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showToast(t) {
  toast.textContent = t;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 1600);
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ---------------- recording controls ---------------- */
async function refresh() {
  const r = await msg('stepLog:list');
  recording = r.recording;
  activeSessionId = r.sessionId;
  toggleBtn.textContent = recording ? '■ Stop recording' : '● Start recording';
  toggleBtn.classList.toggle('stop', recording);
  recDot.classList.toggle('hidden', !recording);
  statusEl.textContent = recording ? 'Recording… (red REC badge on toolbar)' : 'Not recording';
  statusEl.classList.toggle('on', recording);
  renderSessions(r.sessions);
}

toggleBtn.addEventListener('click', async () => {
  if (recording) await msg('stepLog:stop');
  else await msg('stepLog:start');
  await refresh();
});

/* ---------------- session list ---------------- */
function renderSessions(sessions) {
  sessionList.innerHTML = '';
  if (!sessions.length) {
    sessionList.innerHTML = '<div class="empty">No sessions yet. Press Start recording.</div>';
    return;
  }
  for (const s of sessions) {
    const el = document.createElement('div');
    el.className = 'session' + (recording && s.id === activeSessionId ? ' live' : '');
    el.innerHTML =
      '<div class="session-info">' +
        '<div class="session-title">' + escapeHtml(s.title) + '</div>' +
        '<div class="session-meta">' + escapeHtml(new Date(s.startedAt).toLocaleString()) +
        ' · ' + s.stepCount + ' steps' + (s.endedAt ? '' : ' · live') + '</div>' +
      '</div>' +
      '<button class="session-del" title="Delete session">×</button>';
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('session-del')) {
        if (confirm('Delete this session?')) msg('stepLog:delete', { id: s.id }).then(refresh);
      } else {
        openDetail(s.id);
      }
    });
    sessionList.appendChild(el);
  }
}

$('clearAll').addEventListener('click', async () => {
  if (confirm('Delete ALL sessions?')) { await msg('stepLog:clearAll'); await refresh(); }
});

/* ---------------- detail view ---------------- */
let detailSession = null;

async function openDetail(id) {
  const r = await msg('stepLog:getSession', { id });
  if (!r.session) { showToast('Session not found'); return; }
  detailSession = r.session;
  $('detailTitle').textContent = detailSession.title;
  listView.classList.add('hidden');
  detailView.classList.remove('hidden');
  renderTimeline();
}

$('back').addEventListener('click', async () => {
  detailView.classList.add('hidden');
  listView.classList.remove('hidden');
  detailSession = null;
  await refresh();
});

function stepDescription(step) {
  switch (step.type) {
    case 'navigation': return 'Visited <b>' + escapeHtml(step.title || step.url) + '</b><br><span class="step-time">' + escapeHtml(step.url) + '</span>';
    case 'click': return 'Clicked <b>' + escapeHtml(step.label) + '</b><br><span class="step-time">' + escapeHtml(step.selector) + '</span>';
    case 'fill': return 'Filled <b>' + escapeHtml(step.label) + '</b>' +
      (step.value ? ' with <b>' + escapeHtml(step.value) + '</b>' : '') +
      '<br><span class="step-time">' + escapeHtml(step.selector) + '</span>';
    default: return escapeHtml(step.type);
  }
}

function renderTimeline() {
  timeline.innerHTML = '';
  if (!detailSession.steps.length) {
    timeline.innerHTML = '<div class="empty">No steps recorded yet.</div>';
    return;
  }
  detailSession.steps.forEach((step, i) => {
    const el = document.createElement('div');
    el.className = 'step';
    const iconCls = step.type === 'navigation' ? 'nav' : step.type === 'fill' ? 'fill' : 'click';
    el.innerHTML =
      '<div class="step-top">' +
        '<div class="step-icon ' + iconCls + '">' + (ICONS[step.type] || ICONS.click) + '</div>' +
        '<div class="step-body">' +
          '<div class="step-desc">' + stepDescription(step) + '</div>' +
          '<div class="step-time">' + fmtTime(step.ts) + ' · step ' + (i + 1) + '</div>' +
        '</div>' +
      '</div>' +
      '<input class="step-note" placeholder="Add annotation…" value="' + escapeHtml(step.note || '') + '">';
    const noteInput = el.querySelector('.step-note');
    let t = null;
    noteInput.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        msg('stepLog:annotate', { sessionId: detailSession.id, index: i, note: noteInput.value });
      }, 500);
    });
    timeline.appendChild(el);
  });
}

/* ---------------- exports ---------------- */
function download(filename, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'session'; }

$('exportJson').addEventListener('click', () => {
  if (!detailSession) return;
  download('steplog-' + slug(detailSession.title) + '.json', JSON.stringify(detailSession, null, 2), 'application/json');
  showToast('JSON exported');
});

$('exportMd').addEventListener('click', () => {
  if (!detailSession) return;
  const lines = [
    '# ' + detailSession.title,
    '',
    'Started: ' + new Date(detailSession.startedAt).toLocaleString(),
    detailSession.endedAt ? 'Ended: ' + new Date(detailSession.endedAt).toLocaleString() : 'Ended: (still recording)',
    'Steps: ' + detailSession.steps.length,
    '',
  ];
  detailSession.steps.forEach((s, i) => {
    const desc = s.type === 'navigation' ? 'Visited ' + (s.title || s.url)
      : s.type === 'click' ? 'Clicked "' + s.label + '"'
      : s.type === 'fill' ? 'Filled "' + s.label + '"' + (s.value ? ' = "' + s.value + '"' : '')
      : s.type;
    lines.push((i + 1) + '. [' + fmtTime(s.ts) + '] ' + desc);
    if (s.url) lines.push('   URL: ' + s.url);
    if (s.selector) lines.push('   Selector: `' + s.selector + '`');
    if (s.note) lines.push('   Note: ' + s.note);
  });
  download('steplog-' + slug(detailSession.title) + '.md', lines.join('\n'), 'text/markdown');
  showToast('Markdown exported');
});

refresh().catch(() => { statusEl.textContent = 'Could not reach background.'; });
