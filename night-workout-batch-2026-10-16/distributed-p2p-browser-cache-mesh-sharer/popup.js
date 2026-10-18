// Tab Relay — cross-tab text & file relay.
// Transfers live in chrome.storage.local as a bounded queue; every open
// popup instance re-renders on storage.onChanged, so a transfer sent from
// one tab lands in every other tab/window instantly.
// Honest scope: your own tabs only — NOT distributed P2P, 100% local.
// Files are kept small (<= 2 MB) so they fit in storage.local quotas.

const STORAGE_KEY = 'tab_relay_transfers';
const MAX_TRANSFERS = 50;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

const els = {
  tabBtns: document.querySelectorAll('.tab-btn'),
  paneText: document.getElementById('paneText'),
  paneFile: document.getElementById('paneFile'),
  textInput: document.getElementById('textInput'),
  sendTextBtn: document.getElementById('sendTextBtn'),
  copyLatestTextBtn: document.getElementById('copyLatestTextBtn'),
  fileInput: document.getElementById('fileInput'),
  dropLabel: document.getElementById('dropLabel'),
  sendFileBtn: document.getElementById('sendFileBtn'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  historyList: document.getElementById('historyList'),
  empty: document.getElementById('emptyState'),
  count: document.getElementById('transferCount'),
};

let pendingFile = null; // {name, type, size, dataUrl}

// --- Storage helpers ------------------------------------------------------
async function loadTransfers() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const items = data[STORAGE_KEY];
  return Array.isArray(items) ? items : [];
}

async function saveTransfers(items) {
  await chrome.storage.local.set({ [STORAGE_KEY]: items.slice(0, MAX_TRANSFERS) });
}

function makeId() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// --- Formatting -----------------------------------------------------------
function fmtTime(ts) {
  return new Date(ts).toLocaleString(undefined, {
    hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric',
  });
}

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

// --- Rendering ------------------------------------------------------------
async function render() {
  const items = await loadTransfers();
  els.count.textContent = items.length;
  els.empty.classList.toggle('show', items.length === 0);
  els.historyList.innerHTML = '';

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'transfer';

    const row = document.createElement('div');
    row.className = 'transfer-row';

    const badge = document.createElement('span');
    badge.className = 'badge ' + (item.kind === 'file' ? 'file' : 'text');
    badge.textContent = item.kind === 'file' ? 'file' : 'text';
    row.appendChild(badge);

    const name = document.createElement('span');
    name.className = 'transfer-name';
    name.textContent = item.kind === 'file'
      ? `${item.fileName} (${fmtBytes(item.fileSize)})`
      : (item.text.length > 42 ? item.text.slice(0, 42) + '…' : item.text);
    name.title = item.kind === 'file' ? item.fileName : item.text;
    row.appendChild(name);

    const time = document.createElement('span');
    time.className = 'transfer-time';
    time.textContent = fmtTime(item.createdAt);
    row.appendChild(time);
    card.appendChild(row);

    const preview = document.createElement('div');
    preview.className = 'transfer-preview';
    preview.textContent = item.kind === 'file'
      ? `${item.fileType || 'unknown type'} — click Download to save`
      : item.text;
    card.appendChild(preview);

    const actions = document.createElement('div');
    actions.className = 'transfer-actions';

    const useBtn = document.createElement('button');
    useBtn.className = 'icon-btn';
    if (item.kind === 'file') {
      useBtn.title = 'Download file';
      useBtn.innerHTML = downloadSvg() + '<span>Download</span>';
      useBtn.addEventListener('click', () => {
        chrome.downloads.download({
          url: item.dataUrl,
          filename: item.fileName,
          saveAs: true,
        });
      });
    } else {
      useBtn.title = 'Copy text';
      useBtn.innerHTML = copySvg() + '<span>Copy</span>';
      useBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(item.text).catch(() => {});
        useBtn.style.color = 'var(--accent)';
        setTimeout(() => { useBtn.style.color = ''; }, 800);
      });
    }
    actions.appendChild(useBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn danger';
    delBtn.title = 'Remove transfer';
    delBtn.innerHTML = trashSvg();
    delBtn.addEventListener('click', async () => {
      const all = await loadTransfers();
      await saveTransfers(all.filter(t => t.id !== item.id));
    });
    actions.appendChild(delBtn);

    card.appendChild(actions);
    els.historyList.appendChild(card);
  }
}

function copySvg() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
}

function trashSvg() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
}

function downloadSvg() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`;
}

// --- Actions --------------------------------------------------------------
async function pushTransfer(item) {
  const items = await loadTransfers();
  items.unshift(item);
  await saveTransfers(items);
}

async function sendText() {
  const text = els.textInput.value.trim();
  if (!text) { els.textInput.focus(); return; }
  await pushTransfer({ id: makeId(), kind: 'text', text, createdAt: Date.now() });
  els.textInput.value = '';
  els.textInput.focus();
}

async function copyLatestText() {
  const items = await loadTransfers();
  const latest = items.find(t => t.kind === 'text');
  if (!latest) return;
  await navigator.clipboard.writeText(latest.text).catch(() => {});
  els.copyLatestTextBtn.textContent = 'Copied ✓';
  setTimeout(() => { els.copyLatestTextBtn.textContent = 'Copy latest'; }, 1200);
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

async function sendFile() {
  if (!pendingFile) return;
  await pushTransfer({
    id: makeId(),
    kind: 'file',
    fileName: pendingFile.name,
    fileType: pendingFile.type,
    fileSize: pendingFile.size,
    dataUrl: pendingFile.dataUrl,
    createdAt: Date.now(),
  });
  pendingFile = null;
  els.fileInput.value = '';
  els.dropLabel.textContent = 'Choose a file (max 2 MB)';
  els.sendFileBtn.disabled = true;
}

async function clearHistory() {
  const items = await loadTransfers();
  if (items.length === 0) return;
  if (confirm(`Remove all ${items.length} transfer(s) from history?`)) {
    await saveTransfers([]);
  }
}

// --- Events ---------------------------------------------------------------
els.tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    els.tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    els.paneText.classList.toggle('hidden', tab !== 'text');
    els.paneFile.classList.toggle('hidden', tab !== 'file');
  });
});

els.sendTextBtn.addEventListener('click', sendText);
els.textInput.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') sendText();
});
els.copyLatestTextBtn.addEventListener('click', copyLatestText);

els.fileInput.addEventListener('change', async () => {
  const file = els.fileInput.files[0];
  pendingFile = null;
  els.sendFileBtn.disabled = true;
  if (!file) { els.dropLabel.textContent = 'Choose a file (max 2 MB)'; return; }
  if (file.size > MAX_FILE_BYTES) {
    els.dropLabel.textContent = `Too large (${fmtBytes(file.size)}) — max 2 MB`;
    els.fileInput.value = '';
    return;
  }
  try {
    const dataUrl = await readFile(file);
    pendingFile = { name: file.name, type: file.type, size: file.size, dataUrl };
    els.dropLabel.textContent = `${file.name} (${fmtBytes(file.size)})`;
    els.sendFileBtn.disabled = false;
  } catch {
    els.dropLabel.textContent = 'Could not read that file — try another.';
  }
});

els.sendFileBtn.addEventListener('click', sendFile);
els.clearHistoryBtn.addEventListener('click', clearHistory);

// Live-sync: any transfer from another tab re-renders this popup instantly.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) render();
});

render();
