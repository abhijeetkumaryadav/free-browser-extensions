// Download Queue — popup logic.
// Simple personal download queue: add URLs, track progress via
// chrome.downloads, pause/resume/remove. NOT multi-threaded, NOT a mesh.

const STORE_KEY = 'queueItems';
const MAX_DONE_HISTORY = 50;

const addForm = document.getElementById('addForm');
const urlInput = document.getElementById('urlInput');
const activeList = document.getElementById('activeList');
const doneList = document.getElementById('doneList');
const activeEmpty = document.getElementById('activeEmpty');
const doneEmpty = document.getElementById('doneEmpty');
const clearDoneBtn = document.getElementById('clearDoneBtn');

// Read the whole queue from storage.
async function getItems() {
  const { [STORE_KEY]: items = [] } = await chrome.storage.local.get(STORE_KEY);
  return items;
}

async function saveItems(items) {
  await chrome.storage.local.set({ [STORE_KEY]: items });
}

// Build a real download state map from the downloads API.
async function downloadStateMap() {
  const map = {};
  try {
    const all = await chrome.downloads.search({});
    for (const d of all) {
      map[d.id] = {
        bytesReceived: d.bytesReceived,
        totalBytes: d.totalBytes,
        state: d.state,
        paused: d.paused,
        filename: d.filename
      };
    }
  } catch (e) { /* best effort */ }
  return map;
}

// Guess a file name from a URL for display.
function nameFromUrl(url) {
  try {
    const u = new URL(url);
    const part = u.pathname.split('/').filter(Boolean).pop() || u.hostname;
    return decodeURIComponent(part);
  } catch (e) {
    return url;
  }
}

// Add form: queue a URL and ask the worker to start it.
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = urlInput.value.trim();
  if (!raw) return;
  let url;
  try {
    url = new URL(raw);
  } catch (err) {
    alert('Please enter a valid URL.');
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    alert('Only http:// and https:// URLs can be queued.');
    return;
  }

  const items = await getItems();
  const item = {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
    url: url.href,
    name: nameFromUrl(url.href),
    state: 'queued',       // queued | downloading | paused | error | complete
    progress: 0,
    downloadId: null,
    error: null,
    addedAt: Date.now()
  };
  items.push(item);
  await saveItems(items);
  urlInput.value = '';

  // Ask the service worker to start the download.
  chrome.runtime.sendMessage({ type: 'startDownload', id: item.id, url: item.url }, (resp) => {
    if (chrome.runtime.lastError) {
      console.warn('startDownload error:', chrome.runtime.lastError);
    } else if (resp && !resp.ok) {
      console.warn('Download failed to start:', resp.error);
    }
    render();
  });
  render();
});

// Buttons inside the lists (event delegation).
document.querySelector('.app').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  const items = await getItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const item = items[idx];

  if (action === 'pause' && item.downloadId != null) {
    await new Promise((res) => chrome.runtime.sendMessage({ type: 'pause', downloadId: item.downloadId }, res));
    item.state = 'paused';
  } else if (action === 'resume' && item.downloadId != null) {
    await new Promise((res) => chrome.runtime.sendMessage({ type: 'resume', downloadId: item.downloadId }, res));
    item.state = 'downloading';
  } else if (action === 'retry') {
    item.state = 'queued';
    item.error = null;
    item.downloadId = null;
    item.progress = 0;
    chrome.runtime.sendMessage({ type: 'startDownload', id: item.id, url: item.url }, () => render());
  } else if (action === 'remove') {
    if (item.downloadId != null) {
      try {
        await chrome.downloads.cancel(item.downloadId);
        await chrome.downloads.erase({ id: item.downloadId });
      } catch (err) { /* already gone */ }
    }
    items.splice(idx, 1);
  }
  await saveItems(items);
  render();
});

// Clear completed history.
clearDoneBtn.addEventListener('click', async () => {
  const items = await getItems();
  await saveItems(items.filter((i) => i.state !== 'complete'));
  render();
});

// Render both lists.
async function render() {
  const items = await getItems();
  const states = await downloadStateMap();

  // Refresh live progress from the downloads API.
  for (const item of items) {
    if (item.state === 'downloading' && item.downloadId != null) {
      const s = states[item.downloadId];
      if (s) {
        if (typeof s.filename === 'string' && s.filename) {
          item.name = s.filename.split('/').pop().split('\\').pop() || item.name;
        }
        if (s.totalBytes > 0) {
          item.progress = Math.min(100, Math.round((s.bytesReceived / s.totalBytes) * 100));
        }
        if (s.state === 'complete') {
          item.state = 'complete';
          item.progress = 100;
          item.doneAt = Date.now();
        }
      }
    }
  }
  await saveItems(items);

  // Trim completed history.
  const done = items.filter((i) => i.state === 'complete').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const active = items.filter((i) => i.state !== 'complete');
  if (done.length > MAX_DONE_HISTORY) {
    const keep = items.filter((i) => i.state !== 'complete').concat(done.slice(0, MAX_DONE_HISTORY));
    await saveItems(keep);
  }

  activeList.innerHTML = '';
  doneList.innerHTML = '';
  activeEmpty.style.display = active.length ? 'none' : 'block';
  doneEmpty.style.display = done.length ? 'none' : 'block';
  clearDoneBtn.classList.toggle('hidden', done.length === 0);

  for (const item of active) {
    activeList.appendChild(buildActiveItem(item));
  }
  for (const item of done) {
    doneList.appendChild(buildDoneItem(item));
  }
}

// One active queue item row.
function buildActiveItem(item) {
  const div = document.createElement('div');
  div.className = 'item';

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = item.name;
  div.appendChild(name);

  const prog = document.createElement('div');
  prog.className = 'progress';
  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.style.width = (item.progress || 0) + '%';
  prog.appendChild(bar);
  div.appendChild(prog);

  const row = document.createElement('div');
  row.className = 'row';

  const status = document.createElement('span');
  status.className = 'status';
  status.textContent = statusText(item);
  row.appendChild(status);

  const spacer = document.createElement('span');
  spacer.style.flex = '1';
  row.appendChild(spacer);

  if (item.state === 'downloading' && item.downloadId != null) {
    row.appendChild(actionBtn('pause', item.id, 'Pause'));
  } else if (item.state === 'paused' && item.downloadId != null) {
    row.appendChild(actionBtn('resume', item.id, 'Resume'));
  }
  if (item.state === 'error') {
    row.appendChild(actionBtn('retry', item.id, 'Retry'));
  }
  row.appendChild(actionBtn('remove', item.id, 'Remove'));
  div.appendChild(row);
  return div;
}

// One completed-history row.
function buildDoneItem(item) {
  const div = document.createElement('div');
  div.className = 'item done';

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = item.name;
  div.appendChild(name);

  const row = document.createElement('div');
  row.className = 'row';
  const status = document.createElement('span');
  status.className = 'status';
  status.textContent = 'Completed' + (item.doneAt ? ' · ' + new Date(item.doneAt).toLocaleString() : '');
  row.appendChild(status);
  div.appendChild(row);
  return div;
}

function actionBtn(action, id, label) {
  const b = document.createElement('button');
  b.className = 'btn icon-btn';
  b.dataset.action = action;
  b.dataset.id = id;
  b.textContent = label;
  return b;
}

function statusText(item) {
  if (item.state === 'queued') return 'Starting…';
  if (item.state === 'downloading') return (item.progress || 0) + '%';
  if (item.state === 'paused') return 'Paused · ' + (item.progress || 0) + '%';
  if (item.state === 'error') return 'Error' + (item.error ? ': ' + item.error : '');
  return item.state;
}

// Initial render + 1s live refresh while the popup is open.
render();
setInterval(render, 1000);
