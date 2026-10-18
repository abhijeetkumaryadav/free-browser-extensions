/* Paste Clean — clipboard formatting cleaner. 100% local: reads clipboard, strips
   formatting, writes plain text back. Keeps a history of cleaned clips in storage. */
'use strict';

let mode = 'plain';

/* ---------- Mode picker ---------- */
document.querySelectorAll('.mode').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mode = btn.dataset.mode;
  });
});

/* ---------- Cleaning logic ---------- */
// Convert pasted rich content to clean text per mode.
function cleanText(raw, cleanMode) {
  let out = raw;
  // Strip any stray HTML tags (clipboard usually gives text/plain already).
  out = out.replace(/<[^>]*>/g, '');
  // Decode common entities.
  const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
  out = out.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, m => entities[m] || m);
  // Normalize line endings + trim trailing spaces per line.
  out = out.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/[ \t]+$/g, '')).join('\n');

  if (cleanMode === 'single') {
    // One line: collapse all whitespace runs to single spaces.
    out = out.replace(/\s+/g, ' ').trim();
  } else if (cleanMode === 'tight') {
    // Tight: collapse 2+ blank lines into one, drop leading blank lines.
    out = out.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').trim();
  } else {
    // Plain: keep paragraphs, drop excess blanks.
    out = out.replace(/\n{3,}/g, '\n\n').trim();
  }
  return out;
}

/* ---------- Status + preview ---------- */
const statusEl = document.getElementById('status');
function setStatus(msg, cls) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (cls ? ' ' + cls : '');
}

/* ---------- Main action ---------- */
document.getElementById('clean').addEventListener('click', async () => {
  try {
    const raw = await navigator.clipboard.readText();
    if (!raw) {
      setStatus('Clipboard is empty — copy some text first.', 'err');
      return;
    }
    const cleaned = cleanText(raw, mode);
    await navigator.clipboard.writeText(cleaned);
    document.getElementById('preview').textContent = cleaned || '(result was empty)';
    setStatus('Cleaned and copied back — ' + cleaned.length + ' chars.', 'ok');
    await pushHistory(cleaned);
    renderHistory();
  } catch (err) {
    // Clipboard access can be denied by the browser or OS.
    setStatus('Could not access the clipboard: ' + err.message, 'err');
  }
});

/* ---------- History ---------- */
async function getHistory() {
  const { history = [] } = await chrome.storage.local.get('history');
  return history;
}

async function pushHistory(text) {
  const history = await getHistory();
  history.unshift({ id: Date.now(), mode, text: text.slice(0, 2000), at: new Date().toISOString() });
  await chrome.storage.local.set({ history: history.slice(0, 50) });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function renderHistory() {
  const history = await getHistory();
  const list = document.getElementById('history');
  const empty = document.getElementById('histEmpty');
  list.innerHTML = '';
  empty.style.display = history.length ? 'none' : 'block';
  for (const h of history) {
    const li = document.createElement('li');
    const short = h.text.length > 180 ? h.text.slice(0, 180) + '…' : h.text;
    li.innerHTML =
      '<div class="txt">' + escapeHtml(short) + '</div>' +
      '<div class="meta">' + escapeHtml(h.mode) + ' · ' + new Date(h.at).toLocaleString() + ' · ' + h.text.length + ' chars</div>' +
      '<div class="acts"><button class="ghost recopy">Copy again</button><button class="ghost del">Delete</button></div>';
    li.querySelector('.recopy').addEventListener('click', async () => {
      await navigator.clipboard.writeText(h.text);
      setStatus('Copied back to clipboard.', 'ok');
    });
    li.querySelector('.del').addEventListener('click', async () => {
      await chrome.storage.local.set({ history: (await getHistory()).filter(x => x.id !== h.id) });
      renderHistory();
    });
    list.appendChild(li);
  }
}

document.getElementById('clearHist').addEventListener('click', async () => {
  await chrome.storage.local.set({ history: [] });
  renderHistory();
});

renderHistory();
