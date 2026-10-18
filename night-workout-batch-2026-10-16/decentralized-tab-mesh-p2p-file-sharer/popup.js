'use strict';
/* ------------------------------------------------------------------
 * Local Tab Mesh — popup
 *
 * The popup is itself a mesh node: it opens BroadcastChannel
 * 'local-tab-mesh', tracks member presence heartbeats, sends snippets
 * (optionally targeted at one member), and sends small files chunked
 * as base64. Nothing is persisted — members expire ~12s after their
 * last heartbeat, and the inbox lives only while the popup is open.
 * ------------------------------------------------------------------ */

const CHANNEL = 'local-tab-mesh';
const MAX_FILE = 5 * 1024 * 1024;   // 5 MB cap for file shares
const CHUNK = 48 * 1024;            // base64 chars per chunk
const EXPIRE_MS = 12000;

const nodeId = 'popup-' + Math.random().toString(36).slice(2, 10);
const bc = new BroadcastChannel(CHANNEL);
const members = new Map();          // nodeId -> {nodeId, title, url, lastSeen}

const membersEl = document.getElementById('members');
const countEl = document.getElementById('count');
const targetEl = document.getElementById('target');
const inboxEl = document.getElementById('inbox');
const msgEl = document.getElementById('msg');
const fileEl = document.getElementById('file');
const fnameEl = document.getElementById('fname');
const sendFileBtn = document.getElementById('sendfile');

let selectedFile = null;

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

/* ---------- presence ---------- */

function pruneMembers() {
  const now = Date.now();
  let changed = false;
  for (const [id, m] of members) {
    if (now - m.lastSeen > EXPIRE_MS) { members.delete(id); changed = true; }
  }
  if (changed) renderMembers();
}

function renderMembers() {
  const list = [...members.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  countEl.textContent = String(list.length);
  membersEl.innerHTML = list.length
    ? ''
    : '<li class="empty">No joined tabs yet.<br>Click “Join this tab” on the tabs you want to link.</li>';
  const frag = document.createDocumentFragment();
  for (const m of list) {
    const li = document.createElement('li');
    li.className = 'member';
    li.innerHTML = '<div class="t"><span class="dot"></span>' + escapeHtml(m.title) + '</div>' +
      '<div class="u">' + escapeHtml(hostOf(m.url)) + '</div>';
    frag.appendChild(li);
  }
  membersEl.appendChild(frag);

  // Rebuild target dropdown, preserving selection.
  const prev = targetEl.value;
  targetEl.innerHTML = '<option value="*">Everyone (broadcast)</option>';
  for (const m of list) {
    const opt = document.createElement('option');
    opt.value = m.nodeId;
    opt.textContent = 'Only: ' + (m.title || m.nodeId).slice(0, 34);
    targetEl.appendChild(opt);
  }
  if ([...targetEl.options].some(o => o.value === prev)) targetEl.value = prev;
}

/* ---------- inbox ---------- */

function clearEmpty() {
  const e = inboxEl.querySelector('.empty');
  if (e) e.remove();
}

function addInbox(fromLabel, bodyHtml, onDownload) {
  clearEmpty();
  const li = document.createElement('li');
  li.className = 'imsg';
  li.innerHTML = '<div class="from">' + escapeHtml(fromLabel) + '</div>' +
    '<div class="body">' + bodyHtml + '</div><div class="acts"></div>';
  const acts = li.querySelector('.acts');
  if (onDownload) {
    const b = document.createElement('button');
    b.className = 'mini';
    b.type = 'button';
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>Download';
    b.addEventListener('click', onDownload);
    acts.appendChild(b);
  } else {
    const b = document.createElement('button');
    b.className = 'mini';
    b.type = 'button';
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy';
    b.addEventListener('click', () => {
      const t = li.querySelector('.body').textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
    });
    acts.appendChild(b);
  }
  inboxEl.prepend(li);
  while (inboxEl.children.length > 20) inboxEl.lastChild.remove();
}

/* ---------- receiving ---------- */

const pendingFiles = new Map(); // fileId -> {meta, chunks[]}

bc.onmessage = (ev) => {
  const m = ev.data;
  if (!m || typeof m !== 'object' || m.nodeId === nodeId) return;

  if (m.type === 'presence') {
    members.set(m.nodeId, {
      nodeId: m.nodeId, title: m.title, url: m.url, lastSeen: Date.now()
    });
    renderMembers();
  } else if (m.type === 'snippet') {
    if (m.target && m.target !== '*' && m.target !== nodeId) return;
    addInbox(m.fromLabel || 'mesh tab', escapeHtml(m.text || ''));
  } else if (m.type === 'file-meta') {
    if (m.target && m.target !== '*' && m.target !== nodeId) return;
    pendingFiles.set(m.fileId, { meta: m, chunks: new Array(m.totalChunks) });
  } else if (m.type === 'file-chunk') {
    const rec = pendingFiles.get(m.fileId);
    if (!rec) return;
    rec.chunks[m.index] = m.data;
    if (rec.chunks.filter(Boolean).length === rec.meta.totalChunks) {
      pendingFiles.delete(m.fileId);
      const dataUrl = 'data:' + rec.meta.mime + ';base64,' + rec.chunks.join('');
      addInbox(rec.meta.fromLabel || 'mesh tab',
        '📦 File: <strong>' + escapeHtml(rec.meta.name) + '</strong> (' +
        (rec.meta.size / 1024).toFixed(1) + ' KB)',
        () => {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = rec.meta.name || 'shared-file';
          document.body.appendChild(a);
          a.click();
          a.remove();
        });
    }
  }
};

/* ---------- sending ---------- */

function currentTabLabel(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const t = tabs && tabs[0];
    cb(t ? (t.title || 'this tab') : 'this tab');
  });
}

document.getElementById('send').addEventListener('click', () => {
  const text = msgEl.value.trim();
  if (!text) return;
  currentTabLabel(label => {
    bc.postMessage({
      type: 'snippet', nodeId, target: targetEl.value,
      fromLabel: label, text
    });
    msgEl.value = '';
  });
});

msgEl.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('send').click();
  }
});

fileEl.addEventListener('change', () => {
  selectedFile = fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;
  fnameEl.textContent = selectedFile ? selectedFile.name : 'none selected';
  sendFileBtn.disabled = !selectedFile;
  if (selectedFile && selectedFile.size > MAX_FILE) {
    fnameEl.textContent = selectedFile.name + ' — too large (max 5 MB)';
    sendFileBtn.disabled = true;
  }
});

sendFileBtn.addEventListener('click', () => {
  if (!selectedFile || selectedFile.size > MAX_FILE) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result || '');
    const base64 = dataUrl.split(',')[1] || '';
    const fileId = 'file-' + Math.random().toString(36).slice(2, 10);
    const totalChunks = Math.max(1, Math.ceil(base64.length / CHUNK));
    currentTabLabel(label => {
      const meta = {
        type: 'file-meta', nodeId, target: targetEl.value, fileId,
        fromLabel: label, name: selectedFile.name,
        mime: selectedFile.type || 'application/octet-stream',
        size: selectedFile.size, totalChunks
      };
      bc.postMessage(meta);
      for (let i = 0; i < totalChunks; i++) {
        bc.postMessage({
          type: 'file-chunk', nodeId, target: targetEl.value,
          fileId, index: i, data: base64.slice(i * CHUNK, (i + 1) * CHUNK)
        });
      }
      fnameEl.textContent = 'sent ✓ (' + selectedFile.name + ')';
      selectedFile = null;
      fileEl.value = '';
      sendFileBtn.disabled = true;
    });
  };
  reader.readAsDataURL(selectedFile);
});

/* ---------- join this tab ---------- */

document.getElementById('join').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) return;
    if (!/^https?:|^file:/.test(tab.url || '')) {
      // chrome://, edge://, store pages etc. cannot be scripted.
      return;
    }
    chrome.scripting.executeScript(
      { target: { tabId: tab.id }, files: ['content.js'] },
      () => {
        // chrome.runtime.lastError is informational here (e.g. already joined).
        if (chrome.runtime.lastError) { /* ignore */ }
      }
    );
  });
});

/* ---------- init ---------- */

setInterval(pruneMembers, 4000);
renderMembers();
