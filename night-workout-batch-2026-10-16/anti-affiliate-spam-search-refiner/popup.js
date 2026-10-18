// Anti-Affiliate Spam Search Refiner — popup logic.
// Sends scan/restore commands to the injected content script; tracks stats.

const $ = (id) => document.getElementById(id);
let mode = 'dim'; // 'dim' | 'collapse'
let sessionScans = 0;

/** Get the active tab. */
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Inject content.js on demand (click-only), then run a command against it. */
async function runCommand(command) {
  const tab = await activeTab();
  if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) {
    throw new Error('Open an http(s) search page first.');
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  const [resp] = await chrome.tabs.sendMessage(tab.id, { command, mode });
  if (!resp || !resp.ok) throw new Error(resp && resp.error ? resp.error : 'No response from page.');
  return resp;
}

function setMode(next) {
  mode = next;
  $('dimMode').classList.toggle('seg-on', next === 'dim');
  $('hideMode').classList.toggle('seg-on', next === 'collapse');
  chrome.storage.local.set({ aasr_mode: next });
}

async function loadState() {
  const { aasr_mode, aasr_lifetime } = await chrome.storage.local.get(['aasr_mode', 'aasr_lifetime']);
  if (aasr_mode === 'collapse') setMode('collapse');
  $('lifetimeDimmed').textContent = aasr_lifetime || 0;
  $('sessionScans').textContent = sessionScans;
}

function renderMatches(matches) {
  const card = $('resultsCard');
  const list = $('matchList');
  list.innerHTML = '';
  $('matchCount').textContent = matches.length;
  card.hidden = matches.length === 0;
  for (const m of matches.slice(0, 40)) {
    const li = document.createElement('li');
    const t = document.createElement('span'); t.className = 'title'; t.textContent = m.title || '(no title)';
    const w = document.createElement('span'); w.className = 'why';
    const b = document.createElement('b'); b.textContent = 'why: ';
    w.appendChild(b); w.appendChild(document.createTextNode(m.why));
    li.appendChild(t); li.appendChild(w); list.appendChild(li);
  }
  if (matches.length > 40) {
    const li = document.createElement('li');
    li.textContent = `…and ${matches.length - 40} more`;
    list.appendChild(li);
  }
}

$('scanBtn').addEventListener('click', async () => {
  $('scanBtn').disabled = true;
  try {
    const resp = await runCommand('scan');
    sessionScans += 1;
    const { aasr_lifetime = 0 } = await chrome.storage.local.get('aasr_lifetime');
    await chrome.storage.local.set({ aasr_lifetime: aasr_lifetime + resp.dimmed });
    $('lifetimeDimmed').textContent = aasr_lifetime + resp.dimmed;
    $('sessionScans').textContent = sessionScans;
    renderMatches(resp.matches || []);
    $('restoreBtn').disabled = resp.dimmed === 0;
  } catch (e) {
    const li = document.createElement('li');
    li.textContent = 'Error: ' + e.message;
    $('matchList').innerHTML = ''; $('matchList').appendChild(li);
    $('resultsCard').hidden = false; $('matchCount').textContent = '!';
  } finally {
    $('scanBtn').disabled = false;
  }
});

$('restoreBtn').addEventListener('click', async () => {
  try {
    await runCommand('restore');
    $('restoreBtn').disabled = true;
    renderMatches([]);
  } catch (e) { /* page navigated away; nothing to restore */ }
});

$('dimMode').addEventListener('click', () => setMode('dim'));
$('hideMode').addEventListener('click', () => setMode('collapse'));

loadState();
