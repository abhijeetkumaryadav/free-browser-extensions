/* PageDiff — Page Change Tracker
 * Snapshots a page's text blocks (normalized + djb2 hashed), then diffs a
 * later visit block-by-block: added / removed / unchanged. Snapshots are
 * stored per URL in chrome.storage.local. Everything is on-device. */

/* ---------- Page-side helpers (self-contained; injected via chrome.scripting) ---------- */

// Extract leaf-ish text blocks from the page
// NOTE: fully self-contained — chrome.scripting serializes this function alone,
// so it cannot reference anything outside its own body.
function extractBlocks() {
  const hash = s => {
    const norm = s.trim().replace(/\s+/g, ' ');
    let h = 5381;
    for (let i = 0; i < norm.length; i++) h = ((h << 5) + h + norm.charCodeAt(i)) >>> 0;
    return { hash: h.toString(36), text: norm };
  };
  const blocks = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('h1,h2,h3,h4,p,li,td,th,blockquote')) {
    const text = (el.innerText || '').trim().replace(/\s+/g, ' ');
    if (text.length < 15) continue;
    if (el.querySelector('p,h1,h2,h3,h4,li')) continue; // skip containers, keep leaves
    const r = hash(text);
    if (seen.has(r.hash)) continue; // de-dupe repeated boilerplate
    seen.add(r.hash);
    blocks.push({ hash: r.hash, text: r.text.slice(0, 300) });
    if (blocks.length >= 600) break;
  }
  return blocks;
}

// Highlight blocks whose hash is in the addedHashes list (self-contained, see above)
function highlightAdded(addedHashes) {
  const hash = s => {
    const norm = s.trim().replace(/\s+/g, ' ');
    let h = 5381;
    for (let i = 0; i < norm.length; i++) h = ((h << 5) + h + norm.charCodeAt(i)) >>> 0;
    return h.toString(36);
  };
  // Clear previous markers
  document.querySelectorAll('[data-pagediff-mark]').forEach(el => {
    el.style.outline = '';
    el.style.backgroundColor = '';
    el.removeAttribute('data-pagediff-mark');
  });
  if (!addedHashes || !addedHashes.length) return 0;
  const want = new Set(addedHashes);
  let count = 0;
  for (const el of document.querySelectorAll('h1,h2,h3,h4,p,li,td,th,blockquote')) {
    const text = (el.innerText || '').trim().replace(/\s+/g, ' ');
    if (text.length < 15) continue;
    if (el.querySelector('p,h1,h2,h3,h4,li')) continue;
    if (want.has(hash(text))) {
      el.setAttribute('data-pagediff-mark', '1');
      el.style.outline = '2px solid #34d399';
      el.style.backgroundColor = 'rgba(52,211,153,.12)';
      count++;
      if (count >= 200) break;
    }
  }
  return count;
}

/* ---------- Diff logic (runs in the popup) ---------- */
function diffBlocks(oldBlocks, newBlocks) {
  const oldSet = new Set(oldBlocks.map(b => b.hash));
  const newSet = new Set(newBlocks.map(b => b.hash));
  const added = newBlocks.filter(b => !oldSet.has(b.hash));
  const removed = oldBlocks.filter(b => !newSet.has(b.hash));
  const unchanged = newBlocks.length - added.length;
  return { added, removed, unchanged };
}

/* ---------- Popup wiring ---------- */
const $ = id => document.getElementById(id);
let tabId = null, pageUrl = '', snapshots = [], lastDiff = null;

function setStatus(msg, isError = false) {
  const el = $('status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

function storageKey() { return 'pd:' + pageUrl; }

async function loadSnapshots() {
  const r = await chrome.storage.local.get([storageKey()]);
  snapshots = r[storageKey()] || [];
  renderHistory();
  const n = snapshots.length;
  $('snap-info').textContent = n
    ? `${n} snapshot${n > 1 ? 's' : ''} for this page. Latest: ${new Date(snapshots[n - 1].at).toLocaleString()}`
    : 'No snapshot for this page yet.';
  $('btn-compare').disabled = n === 0;
}

function renderHistory() {
  const box = $('history');
  box.innerHTML = '';
  if (!snapshots.length) {
    box.innerHTML = '<div class="history-empty">Snapshots you take will appear here.</div>';
    return;
  }
  [...snapshots].reverse().forEach(s => {
    const row = document.createElement('div');
    row.className = 'history-row';
    const when = document.createElement('span');
    when.className = 'when';
    when.textContent = new Date(s.at).toLocaleString();
    const blocks = document.createElement('span');
    blocks.className = 'blocks';
    blocks.textContent = s.blocks.length + ' blocks';
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.title = 'Delete snapshot';
    del.addEventListener('click', async () => {
      snapshots = snapshots.filter(x => x.at !== s.at);
      await chrome.storage.local.set({ [storageKey()]: snapshots });
      loadSnapshots();
      setStatus('Snapshot deleted.');
    });
    row.append(when, blocks, del);
    box.appendChild(row);
  });
}

async function runInPage(func, args = []) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId }, func, args
  });
  return result;
}

$('btn-snapshot').addEventListener('click', async () => {
  setStatus('Capturing snapshot…');
  try {
    const blocks = await runInPage(extractBlocks);
    if (!blocks || !blocks.length) throw new Error('No readable text blocks found on this page.');
    snapshots.push({ at: Date.now(), blocks });
    if (snapshots.length > 20) snapshots = snapshots.slice(-20); // keep history bounded
    await chrome.storage.local.set({ [storageKey()]: snapshots });
    await loadSnapshots();
    setStatus(`Snapshot saved — ${blocks.length} text blocks.`);
  } catch (e) {
    setStatus('Snapshot failed: ' + (e.message || e), true);
  }
});

$('btn-compare').addEventListener('click', async () => {
  if (!snapshots.length) return;
  setStatus('Comparing…');
  try {
    const latest = snapshots[snapshots.length - 1];
    const current = await runInPage(extractBlocks);
    if (!current || !current.length) throw new Error('No readable text blocks found on this page.');
    lastDiff = diffBlocks(latest.blocks, current);
    $('diff-added').textContent = lastDiff.added.length;
    $('diff-removed').textContent = lastDiff.removed.length;
    $('diff-same').textContent = lastDiff.unchanged;
    const rl = $('removed-list');
    rl.innerHTML = '';
    lastDiff.removed.slice(0, 30).forEach(b => {
      const d = document.createElement('div');
      d.className = 'removed-item';
      d.innerHTML = '<b>− removed</b> ' + escapeHtml(b.text.slice(0, 140));
      rl.appendChild(d);
    });
    if (lastDiff.removed.length > 30) {
      const more = document.createElement('div');
      more.className = 'removed-item';
      more.textContent = `…and ${lastDiff.removed.length - 30} more removed blocks`;
      rl.appendChild(more);
    }
    $('diff-card').classList.remove('hidden');
    $('btn-highlight').disabled = lastDiff.added.length === 0;
    setStatus(`Compared against snapshot from ${new Date(latest.at).toLocaleString()}.`);
  } catch (e) {
    setStatus('Compare failed: ' + (e.message || e), true);
  }
});

$('btn-highlight').addEventListener('click', async () => {
  if (!lastDiff) return;
  try {
    const count = await runInPage(highlightAdded, [lastDiff.added.map(b => b.hash)]);
    setStatus(count ? `${count} new block${count > 1 ? 's' : ''} highlighted on the page.` : 'No additions to highlight.');
  } catch (e) {
    setStatus('Highlight failed: ' + (e.message || e), true);
  }
});

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Init
(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab.');
    tabId = tab.id;
    pageUrl = tab.url || '';
    $('page-url').textContent = pageUrl;
    await loadSnapshots();
  } catch (e) {
    setStatus(e.message || 'Could not read the current tab.', true);
  }
})();
