// Offline Page Indexer — popup logic
// Save pages (user-triggered text extraction), instant keyword search
// over title + body. Pure keyword scoring — title hits weigh more.
// NOT AI, NOT RAG, NOT semantic: no embeddings, no synonym expansion.
(function () {
  'use strict';

  const STORAGE_KEY = 'pageindexer_library_v1';
  const $ = (id) => document.getElementById(id);

  // --- Page-text extraction, runs in the page context via `func` ---
  function extractPage() {
    const clone = document.cloneNode(true);
    clone.querySelectorAll('script,style,noscript,iframe,nav,header,footer,aside').forEach(n => n.remove());
    const pick = clone.querySelector('main,article,[role="main"]') || clone.body;
    let text = (pick.innerText || '').split('\n').map(l => l.trim())
      .filter(l => l.length > 1).join('\n');
    if (text.length > 120000) text = text.slice(0, 120000);
    return { url: location.href.split('#')[0], title: document.title || location.hostname, text, savedAt: Date.now() };
  }

  // --- Storage helpers ---
  async function loadLib() {
    return (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || [];
  }
  async function saveLib(lib) {
    await chrome.storage.local.set({ [STORAGE_KEY]: lib });
  }

  // --- Keyword search ---
  const STOP = new Set(['the','a','an','and','or','of','to','in','on','for','is','it','this','that','with','as','at','by','from','was','are','be','has','have','you','your','we','our','they','their','but','not']);
  function tokens(q) {
    return q.toLowerCase().split(/[^a-z0-9]+/i).filter(t => t.length > 1 && !STOP.has(t));
  }
  // Score: title hits ×10, body hits ×1, all-terms bonus ×1.5
  function score(entry, terms) {
    const title = entry.title.toLowerCase();
    const body = entry.text.toLowerCase();
    let s = 0, matched = 0;
    for (const t of terms) {
      const inTitle = title.includes(t);
      const inBody = body.includes(t);
      if (inTitle || inBody) {
        matched++;
        if (inTitle) s += 10;
        if (inBody) s += Math.min(20, (body.split(t).length - 1)); // cap body frequency
      }
    }
    if (matched === terms.length && terms.length > 1) s *= 1.5;
    return matched ? s : 0;
  }
  function snippet(entry, terms) {
    const lower = entry.text.toLowerCase();
    let idx = -1, term = '';
    for (const t of terms) { const i = lower.indexOf(t); if (i !== -1 && (idx === -1 || i < idx)) { idx = i; term = t; } }
    if (idx === -1) return entry.text.slice(0, 140) + '…';
    const start = Math.max(0, idx - 60);
    const raw = (start > 0 ? '…' : '') + entry.text.slice(start, idx + 140) + '…';
    const esc = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.replace(new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'i'), '<mark>$1</mark>');
  }

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function render() {
    const lib = await loadLib();
    const q = $('query').value.trim();
    const terms = tokens(q);
    $('pageCount').textContent = lib.length;
    $('wordCount').textContent = lib.reduce((n, e) => n + e.text.split(/\s+/).length, 0).toLocaleString();

    let rows = lib.map(e => ({ e, s: terms.length ? score(e, terms) : 1 }))
      .filter(r => r.s > 0)
      .sort((a, b) => b.s - a.s);

    $('empty').style.display = lib.length ? 'none' : 'block';
    const box = $('results');
    box.innerHTML = '';
    if (terms.length && !rows.length) {
      box.innerHTML = '<div class="empty">No matches. Keyword search only — try different words.</div>';
      return;
    }
    rows.slice(0, 50).forEach(({ e, s }) => {
      const div = document.createElement('div');
      div.className = 'result';
      div.innerHTML =
        '<div class="title">' + escHtml(e.title) + '</div>' +
        '<div class="url">' + escHtml(e.url) + '</div>' +
        '<div class="snippet">' + snippet(e, terms) + '</div>' +
        '<div class="meta"><span class="score">score ' + Math.round(s) + '</span>' +
        '<button class="del" data-url="' + escHtml(e.url) + '">Remove</button></div>';
      div.querySelector('.del').addEventListener('click', async (ev) => {
        ev.stopPropagation();
        await saveLib((await loadLib()).filter(x => x.url !== e.url));
        render();
      });
      div.addEventListener('click', () => chrome.tabs.create({ url: e.url }));
      box.appendChild(div);
    });
  }

  $('query').addEventListener('input', render);

  $('savePage').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^(https?|file):/.test(tab.url || '')) return;
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPage });
    if (!result || !result.text) return;
    const lib = await loadLib();
    const i = lib.findIndex(e => e.url === result.url);
    if (i !== -1) lib[i] = result; else lib.unshift(result);
    await saveLib(lib.slice(0, 500)); // cap library size
    render();
  });

  $('exportBtn').addEventListener('click', async () => {
    const lib = await loadLib();
    const blob = new Blob([JSON.stringify(lib, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'page-indexer-library.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });

  $('clearAll').addEventListener('click', async () => {
    if (!confirm('Delete the entire saved-page library?')) return;
    await chrome.storage.local.remove(STORAGE_KEY);
    render();
  });

  render();
})();
