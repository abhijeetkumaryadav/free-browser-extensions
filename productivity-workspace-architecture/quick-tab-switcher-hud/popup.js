/* Quick Tab Switcher HUD — popup logic.
   Fuzzy tab search + keyboard-first jumping. All data stays on-device.
   Permissions used: "tabs" (read tab titles/URLs, switch, close). */

const searchInput = document.getElementById('search');
const listEl = document.getElementById('list');
const countEl = document.getElementById('tabCount');

let allTabs = [];      // every tab in current window, most-recent-first-ish
let visibleTabs = [];  // filtered + ranked view
let selectedIdx = 0;

/* ---------- scoring: subsequence fuzzy match ---------- */
function fuzzyScore(query, target) {
  query = query.toLowerCase();
  target = target.toLowerCase();
  if (!query) return 0;
  if (target.includes(query)) return 1000 - target.indexOf(query); // substring wins
  let qi = 0, score = 0, streak = 0, lastPos = -1;
  for (let i = 0; i < target.length && qi < query.length; i++) {
    if (target[i] === query[qi]) {
      score += 10 + (lastPos === i - 1 ? 8 : 0); // bonus for consecutive chars
      lastPos = i; streak++; qi++;
    }
  }
  if (qi < query.length) return -1; // not a subsequence → no match
  return score - streak * 0; // streak already folded in
}

/* ---------- load tabs ---------- */
async function loadTabs() {
  // currentWindow keeps the HUD scoped to what the user is looking at
  allTabs = await chrome.tabs.query({ currentWindow: true });
  countEl.textContent = allTabs.length;
  applyFilter('');
}

/* ---------- filtering + rendering ---------- */
function applyFilter(query) {
  const q = query.trim();
  if (!q) {
    visibleTabs = allTabs.slice();
  } else {
    visibleTabs = allTabs
      .map(tab => {
        const titleScore = fuzzyScore(q, tab.title || '');
        const urlScore = fuzzyScore(q, tab.url || '') * 0.6; // title slightly preferred
        return { tab, score: Math.max(titleScore, urlScore) };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.tab);
  }
  selectedIdx = 0;
  render();
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function render() {
  listEl.innerHTML = '';
  if (visibleTabs.length === 0) {
    listEl.innerHTML = '<div class="empty">No tabs match your search.</div>';
    return;
  }
  visibleTabs.forEach((tab, i) => {
    const li = document.createElement('li');
    li.className = 'tab-item' + (i === selectedIdx ? ' selected' : '') + (tab.active ? ' active' : '');
    const favicon = tab.favIconUrl
      ? `<img class="favicon" src="${escapeHtml(tab.favIconUrl)}" alt="">`
      : `<span class="favicon"></span>`;
    li.innerHTML = `
      ${favicon}
      <div class="tab-meta">
        <div class="tab-title">${escapeHtml(tab.title || 'Untitled')}</div>
        <div class="tab-url">${escapeHtml(prettyHost(tab.url))}</div>
      </div>
      <button class="close-btn" title="Close tab" aria-label="Close tab">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>`;
    li.addEventListener('click', () => jumpTo(tab));
    li.querySelector('.close-btn').addEventListener('click', e => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    li.addEventListener('mouseenter', () => {
      selectedIdx = i;
      refreshSelection();
    });
    listEl.appendChild(li);
  });
  scrollSelectedIntoView();
}

function prettyHost(url) {
  try { return new URL(url).host; } catch { return url || ''; }
}

function refreshSelection() {
  [...listEl.children].forEach((li, i) => {
    li.classList.toggle('selected', i === selectedIdx);
  });
  scrollSelectedIntoView();
}

function scrollSelectedIntoView() {
  const sel = listEl.children[selectedIdx];
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
}

/* ---------- actions ---------- */
async function jumpTo(tab) {
  await chrome.tabs.update(tab.id, { active: true });
  // bring its window forward in case it isn't the current one
  await chrome.windows.update(tab.windowId, { focused: true });
  window.close();
}

async function closeTab(tabId) {
  await chrome.tabs.remove(tabId);
  // reload list; keep the search text
  await loadTabs();
  applyFilter(searchInput.value);
}

/* ---------- keyboard ---------- */
searchInput.addEventListener('input', e => applyFilter(e.target.value));

searchInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (visibleTabs.length) selectedIdx = (selectedIdx + 1) % visibleTabs.length;
    refreshSelection();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (visibleTabs.length) selectedIdx = (selectedIdx - 1 + visibleTabs.length) % visibleTabs.length;
    refreshSelection();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const tab = visibleTabs[selectedIdx];
    if (tab) jumpTo(tab);
  } else if (e.key === 'Backspace' && searchInput.value === '') {
    // ⌫ on an empty search closes the selected tab — quick cleanup
    e.preventDefault();
    const tab = visibleTabs[selectedIdx];
    if (tab && !tab.pinned) closeTab(tab.id);
  } else if (e.key === 'Escape') {
    window.close();
  }
});

/* keep the list fresh if tabs change while open */
chrome.tabs.onRemoved.addListener(loadTabs);
chrome.tabs.onUpdated.addListener(loadTabs);

searchInput.focus();
loadTabs();
