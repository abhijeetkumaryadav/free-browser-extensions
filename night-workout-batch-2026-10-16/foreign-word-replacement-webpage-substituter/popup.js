/* Foreign Word Substituter — popup logic.
   Manages the user's word→translation pairs and drives the content-script
   engine (content.js) on the active tab via click-only chrome.scripting
   injection. Nothing runs on any page until the user clicks a button. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const wordInput = $('wordInput'), transInput = $('transInput');
  const pairList = $('pairList'), pairCount = $('pairCount'), emptyMsg = $('emptyMsg');
  const status = $('status');

  let pairs = [];

  function setStatus(msg, kind) {
    status.textContent = msg;
    status.className = 'status' + (kind ? ' ' + kind : '');
  }

  function save() {
    chrome.storage.local.set({ pairs });
  }

  function render() {
    pairList.innerHTML = '';
    pairCount.textContent = pairs.length ? `(${pairs.length})` : '';
    emptyMsg.style.display = pairs.length ? 'none' : 'block';
    pairs.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'pair';
      const w = document.createElement('span'); w.className = 'w'; w.textContent = p.word;
      const a = document.createElement('span'); a.className = 'arrow'; a.textContent = '→';
      const t = document.createElement('span'); t.className = 't'; t.textContent = p.translation;
      const del = document.createElement('button');
      del.className = 'del'; del.type = 'button'; del.textContent = '×';
      del.setAttribute('aria-label', 'Delete pair ' + p.word);
      del.addEventListener('click', () => {
        pairs.splice(i, 1);
        save(); render();
      });
      li.append(w, a, t, del);
      pairList.appendChild(li);
    });
  }

  function addPair() {
    const word = wordInput.value.trim();
    const translation = transInput.value.trim();
    if (!word || !translation) {
      setStatus('Enter both a word and its translation.', 'err');
      return;
    }
    const exists = pairs.some((p) => p.word.toLowerCase() === word.toLowerCase());
    if (exists) {
      setStatus(`"${word}" is already in your list.`, 'err');
      return;
    }
    pairs.push({ word, translation });
    save(); render();
    wordInput.value = ''; transInput.value = '';
    wordInput.focus();
    setStatus(`Added "${word}".`, 'ok');
  }

  /** Inject the engine file into the active tab (idempotent), then run fn with args. */
  async function withEngine(tabId, fn, args) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    const results = await chrome.scripting.executeScript({ target: { tabId }, func: fn, args });
    return results && results[0] ? results[0].result : null;
  }

  async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function onApply() {
    if (!pairs.length) {
      setStatus('Add at least one pair first.', 'err');
      return;
    }
    try {
      const tab = await activeTab();
      if (!tab || !tab.id) { setStatus('No active tab found.', 'err'); return; }
      // Self-contained driver: only touches window.__fws defined by content.js.
      const count = await withEngine(tab.id, (ps) => window.__fws.apply(ps), [pairs]);
      setStatus(count > 0 ? `Replaced ${count} word${count === 1 ? '' : 's'} on this page.` : 'No matches found on this page.', 'ok');
    } catch (e) {
      setStatus('Cannot run here (protected pages like chrome:// are off-limits).', 'err');
    }
  }

  async function onRestore() {
    try {
      const tab = await activeTab();
      if (!tab || !tab.id) { setStatus('No active tab found.', 'err'); return; }
      const count = await withEngine(tab.id, () => window.__fws.remove(), []);
      setStatus(count > 0 ? `Restored ${count} span${count === 1 ? '' : 's'}.` : 'Nothing to restore on this page.', 'ok');
    } catch (e) {
      setStatus('Cannot run here (protected pages like chrome:// are off-limits).', 'err');
    }
  }

  $('addBtn').addEventListener('click', addPair);
  transInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addPair(); });
  wordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') transInput.focus(); });
  $('applyBtn').addEventListener('click', onApply);
  $('restoreBtn').addEventListener('click', onRestore);

  chrome.storage.local.get({ pairs: [] }, (s) => {
    pairs = Array.isArray(s.pairs) ? s.pairs : [];
    render();
  });
})();
