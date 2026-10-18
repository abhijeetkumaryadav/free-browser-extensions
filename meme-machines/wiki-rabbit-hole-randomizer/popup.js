/* RabbitHole — Wiki Randomizer
 * Opens a "Special:Random" page of a chosen public wiki on user click,
 * records each landed article's title in a breadcrumb trail stored locally.
 */

const WIKIS = [
  { id: 'wikipedia',  label: 'Wikipedia (English)',   random: 'https://en.wikipedia.org/wiki/Special:Random' },
  { id: 'simple',     label: 'Simple English Wikipedia', random: 'https://simple.wikipedia.org/wiki/Special:Random' },
  { id: 'wiktionary', label: 'Wiktionary (English)',  random: 'https://en.wiktionary.org/wiki/Special:Random' },
  { id: 'wikiquote',  label: 'Wikiquote (English)',   random: 'https://en.wikiquote.org/wiki/Special:Random' },
  { id: 'commons',    label: 'Wikimedia Commons',     random: 'https://commons.wikimedia.org/wiki/Special:Random' },
];
const MAX_TRAIL = 100;

const $ = (id) => document.getElementById(id);
const wikiSelect = $('wikiSelect'), diveBtn = $('diveBtn'), trailList = $('trailList');
const emptyTrail = $('emptyTrail'), depthNum = $('depthNum');
const backBtn = $('backBtn'), copyBtn = $('copyBtn'), clearBtn = $('clearBtn'), copyToast = $('copyToast');

let trail = [];            // [{wikiId, wikiLabel, title, url, at}]
let currentWikiId = 'wikipedia';

/* ---------- storage ---------- */
async function loadState() {
  const { trail: t = [], wikiId = 'wikipedia' } = await chrome.storage.local.get(['trail', 'wikiId']);
  trail = Array.isArray(t) ? t : [];
  currentWikiId = wikiId;
}
async function saveState() {
  await chrome.storage.local.set({ trail, wikiId: currentWikiId });
}

/* ---------- wiki picker ---------- */
function renderWikiPicker() {
  wikiSelect.innerHTML = '';
  for (const w of WIKIS) {
    const opt = document.createElement('option');
    opt.value = w.id;
    opt.textContent = w.label;
    if (w.id === currentWikiId) opt.selected = true;
    wikiSelect.appendChild(opt);
  }
}

/* ---------- dive ---------- */
async function dive() {
  const wiki = WIKIS.find((w) => w.id === wikiSelect.value) || WIKIS[0];
  currentWikiId = wiki.id;

  // Open the random-article landing URL in a new tab (user-triggered).
  const tab = await chrome.tabs.create({ url: wiki.random, active: true });

  // Wait for the redirect to land, then record the real article title/url.
  const entry = { wikiId: wiki.id, wikiLabel: wiki.label, title: 'Random article…', url: wiki.random, at: Date.now() };
  trail.push(entry);
  if (trail.length > MAX_TRAIL) trail = trail.slice(trail.length - MAX_TRAIL);
  renderTrail();
  await saveState();

  try {
    const landed = await waitForTitle(tab.id);
    if (landed) {
      entry.title = landed.title || entry.title;
      entry.url = landed.url || entry.url;
      renderTrail();
      await saveState();
    }
  } catch (e) {
    // Tab may be closed quickly; trail entry keeps the fallback title.
  }
}

/* Resolve the final title/url once the random page finishes loading. */
function waitForTitle(tabId, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { cleanup(); resolve(null); }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
    }
    function onUpdated(id, info, tab) {
      if (id !== tabId || info.status !== 'complete' || !tab) return;
      cleanup();
      resolve({ title: tab.title, url: tab.url });
    }
    function onRemoved(id) {
      if (id === tabId) { cleanup(); resolve(null); }
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
  });
}

/* ---------- trail rendering ---------- */
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderTrail() {
  trailList.innerHTML = '';
  depthNum.textContent = String(trail.length);

  const hasItems = trail.length > 0;
  backBtn.disabled = copyBtn.disabled = clearBtn.disabled = !hasItems;
  emptyTrail.style.display = hasItems ? 'none' : 'block';

  trail.forEach((e, i) => {
    const li = document.createElement('li');
    if (i === trail.length - 1) li.classList.add('latest');

    const step = document.createElement('span');
    step.className = 'step';
    step.textContent = String(i + 1);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = e.title;
    title.title = e.title;
    const tag = document.createElement('div');
    tag.className = 'wiki-tag';
    tag.textContent = `${e.wikiLabel} · ${fmtTime(e.at)}`;
    meta.appendChild(title);
    meta.appendChild(tag);

    const go = document.createElement('button');
    go.className = 'go';
    go.title = 'Revisit this article';
    go.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>';
    go.addEventListener('click', (ev) => {
      ev.stopPropagation();
      chrome.tabs.create({ url: e.url });
    });

    li.appendChild(step);
    li.appendChild(meta);
    li.appendChild(go);
    li.addEventListener('click', () => chrome.tabs.create({ url: e.url }));
    trailList.appendChild(li);
  });

  trailList.scrollTop = trailList.scrollHeight;
}

/* ---------- actions ---------- */
async function goBack() {
  if (trail.length < 2) return;
  const prev = trail[trail.length - 2];
  chrome.tabs.create({ url: prev.url });
}

function trailAsText() {
  const lines = [`🐇 RabbitHole trail — ${trail.length} dives`, ''];
  trail.forEach((e, i) => {
    lines.push(`${i + 1}. ${e.title} — ${e.wikiLabel} (${e.url})`);
  });
  return lines.join('\n');
}

async function copyTrail() {
  try {
    await navigator.clipboard.writeText(trailAsText());
    copyToast.hidden = false;
    setTimeout(() => { copyToast.hidden = true; }, 1500);
  } catch (e) { /* clipboard denied */ }
}

async function clearTrail() {
  if (!confirm('Clear your entire rabbit-hole trail?')) return;
  trail = [];
  renderTrail();
  await saveState();
}

/* ---------- init ---------- */
wikiSelect.addEventListener('change', async () => {
  currentWikiId = wikiSelect.value;
  await saveState();
});
diveBtn.addEventListener('click', dive);
backBtn.addEventListener('click', goBack);
copyBtn.addEventListener('click', copyTrail);
clearBtn.addEventListener('click', clearTrail);

(async () => {
  await loadState();
  renderWikiPicker();
  renderTrail();
})();
