// Tone Colorizer — popup logic. Engine lives in content.js (injected on click only).
// ENGINE-START
/** Normalize pair input; returns {pair} or {error}. */
function tcParsePair(hanzi, pinyin) {
  const h = (hanzi || '').trim();
  const p = (pinyin || '').trim();
  if (!h) return { error: 'Enter the hanzi.' };
  if (!p) return { error: 'Enter the pinyin (use tone numbers, e.g. ni3).' };
  return { pair: { hanzi: h, pinyin: p } };
}
/** Tone color mirror for the pair list dots. */
function tcToneColor(tone) {
  return { 1: '#f87171', 2: '#fb923c', 3: '#34d399', 4: '#60a5fa' }[tone] || '#9ca3af';
}
function tcToneOf(pinyin) {
  const m = (pinyin || '').match(/([1-5])/);
  return m ? parseInt(m[1], 10) : 5;
}
// ENGINE-END

let pairs = [];
const $ = id => document.getElementById(id);

async function load() {
  const r = await chrome.storage.local.get({ tcPairs: [] });
  pairs = r.tcPairs;
  render();
}
async function save() { await chrome.storage.local.set({ tcPairs: pairs }); }

$('addPair').addEventListener('click', async () => {
  const res = tcParsePair($('hanziIn').value, $('pinyinIn').value);
  if (res.error) { msg(res.error, false); return; }
  if (pairs.some(p => p.hanzi === res.pair.hanzi)) { msg('That hanzi is already added.', false); return; }
  pairs.push(res.pair);
  await save(); render();
  $('hanziIn').value = ''; $('pinyinIn').value = '';
  msg('Added ✓', true);
});

function msg(t, ok) { const m = $('pairMsg'); m.textContent = t; m.style.color = ok ? 'var(--ok)' : 'var(--bad)'; }

function render() {
  $('pairCount').textContent = pairs.length ? `(${pairs.length})` : '';
  const list = $('pairList'); list.innerHTML = '';
  if (!pairs.length) list.innerHTML = '<div class="empty">No pairs yet — add your first hanzi→pinyin pair above.</div>';
  pairs.forEach(p => {
    const row = document.createElement('div'); row.className = 'prow';
    const dot = document.createElement('span'); dot.className = 'dot';
    dot.style.background = tcToneColor(tcToneOf(p.pinyin));
    const hz = document.createElement('span'); hz.className = 'hz'; hz.textContent = p.hanzi;
    const py = document.createElement('span'); py.className = 'py'; py.textContent = p.pinyin;
    const del = document.createElement('button'); del.textContent = '✕'; del.title = 'Delete pair';
    del.addEventListener('click', async () => { pairs = pairs.filter(x => x.hanzi !== p.hanzi); await save(); render(); });
    row.append(dot, hz, py, del);
    list.appendChild(row);
  });
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/.test(tab.url || '')) { $('pageMsg').textContent = 'Only works on regular web pages.'; return null; }
  return tab;
}

$('colorBtn').addEventListener('click', async () => {
  $('pageMsg').textContent = '';
  if (!pairs.length) { $('pageMsg').textContent = 'Add at least one pair first.'; return; }
  const tab = await activeTab(); if (!tab) return;
  try {
    // content.js auto-runs on injection: reads pairs from storage and colorizes.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch (e) { $('pageMsg').textContent = 'Could not run on this tab.'; }
});

$('clearBtn').addEventListener('click', async () => {
  $('pageMsg').textContent = '';
  const tab = await activeTab(); if (!tab) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.querySelectorAll('span[data-tc="1"]')
        .forEach(sp => sp.parentNode.replaceChild(document.createTextNode(sp.textContent), sp))
    });
  } catch (e) { $('pageMsg').textContent = 'Could not run on this tab.'; }
});

load();
