/* Keyword Result Filter — popup logic.
 *
 * Keyword list manager (persisted in chrome.storage.local) + on-demand
 * injection of the page engine. Filtering runs only on explicit click and is
 * fully reversible via Restore.
 */

const $ = id => document.getElementById(id);
const kwInput = $('kwInput');
const addKwBtn = $('addKw');
const kwList = $('kwList');
const filterBtn = $('filterBtn');
const restoreBtn = $('restoreBtn');
const statusEl = $('status');
const hitsEl = $('hits');
const modeDim = $('modeDim');
const modeCollapse = $('modeCollapse');

let keywords = []; // user's keyword list
let mode = 'dim';  // persisted display mode

/* ---------- state ---------- */

async function loadState() {
  const { kwFilterKeywords, kwFilterMode } = await chrome.storage.local.get({
    kwFilterKeywords: [],
    kwFilterMode: 'dim'
  });
  keywords = Array.isArray(kwFilterKeywords) ? kwFilterKeywords.filter(k => typeof k === 'string') : [];
  mode = kwFilterMode === 'collapse' ? 'collapse' : 'dim';
  renderKeywords();
  syncModeButtons();
}

async function saveState() {
  await chrome.storage.local.set({ kwFilterKeywords: keywords, kwFilterMode: mode });
}

/* ---------- keyword list UI ---------- */

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderKeywords() {
  kwList.innerHTML = '';
  if (!keywords.length) {
    const span = document.createElement('span');
    span.className = 'kw-empty';
    span.textContent = 'No keywords yet — add some above.';
    kwList.appendChild(span);
    return;
  }
  keywords.forEach((kw, idx) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    const label = document.createElement('span');
    label.textContent = kw;
    const x = document.createElement('button');
    x.textContent = '×';
    x.title = `Remove "${kw}"`;
    x.addEventListener('click', () => removeKeyword(idx));
    chip.appendChild(label);
    chip.appendChild(x);
    kwList.appendChild(chip);
  });
}

async function addKeyword() {
  const kw = kwInput.value.trim();
  if (!kw) return;
  if (keywords.some(k => k.toLowerCase() === kw.toLowerCase())) {
    kwInput.value = '';
    kwInput.placeholder = 'Already in the list…';
    return;
  }
  keywords.push(kw);
  kwInput.value = '';
  kwInput.placeholder = 'Add a keyword… (e.g. freemium)';
  renderKeywords();
  await saveState();
}

async function removeKeyword(idx) {
  keywords.splice(idx, 1);
  renderKeywords();
  await saveState();
}

addKwBtn.addEventListener('click', addKeyword);
kwInput.addEventListener('keydown', e => { if (e.key === 'Enter') addKeyword(); });

/* ---------- mode ---------- */

function syncModeButtons() {
  modeDim.classList.toggle('active', mode === 'dim');
  modeCollapse.classList.toggle('active', mode === 'collapse');
}
modeDim.addEventListener('click', () => setMode('dim'));
modeCollapse.addEventListener('click', () => setMode('collapse'));
async function setMode(m) {
  mode = m;
  syncModeButtons();
  await saveState();
}

/* ---------- page actions ---------- */

function isRestrictedTab(tab) {
  return !tab || !tab.url || /^(chrome|edge|about|chrome-extension|moz-extension):/.test(tab.url);
}

async function ensureEngine(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

function showStatus(html) {
  statusEl.innerHTML = html;
  statusEl.classList.remove('hidden');
}

function renderHits(labels) {
  hitsEl.innerHTML = '';
  for (const label of labels) {
    const li = document.createElement('li');
    li.textContent = label;
    hitsEl.appendChild(li);
  }
}

filterBtn.addEventListener('click', async () => {
  filterBtn.disabled = true;
  try {
    if (!keywords.length) {
      showStatus('⚠️ Add at least one keyword first — filtering needs your list.');
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (isRestrictedTab(tab)) {
      showStatus('⚠️ Cannot run on browser-internal pages. Try a normal website tab.');
      return;
    }
    await ensureEngine(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, { cmd: 'filter', keywords, mode });
    if (!res || !res.ok) throw new Error(res && res.error || 'No response from page engine.');
    if (res.newly === 0) {
      showStatus(`<span class="big">0</span> cards matched your ${keywords.length} keyword${keywords.length === 1 ? '' : 's'} — nothing hidden.`);
    } else {
      showStatus(`<span class="big">${res.newly}</span> card${res.newly === 1 ? '' : 's'} ${mode === 'collapse' ? 'collapsed' : 'dimmed'} (${res.total} total hidden). <b>Restore</b> brings them back.`);
      renderHits(res.labels || []);
    }
  } catch (e) {
    showStatus(`⚠️ ${e.message}`);
  } finally {
    filterBtn.disabled = false;
  }
});

restoreBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (isRestrictedTab(tab)) {
      showStatus('⚠️ Cannot touch browser-internal pages.');
      return;
    }
    await ensureEngine(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, { cmd: 'restore' });
    if (!res || !res.ok) throw new Error(res && res.error || 'No response from page engine.');
    showStatus(res.restored > 0
      ? `✅ Restored <b>${res.restored}</b> card${res.restored === 1 ? '' : 's'} — page is back to normal.`
      : 'Nothing to restore — no cards are currently hidden.');
    renderHits([]);
  } catch (e) {
    showStatus(`⚠️ ${e.message}`);
  }
});

loadState();
