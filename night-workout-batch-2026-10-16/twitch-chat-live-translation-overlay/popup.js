/* popup.js — Twitch Phrasebook manager + panel toggle */
'use strict';

(function () {
  const listEl = document.getElementById('entry-list');
  const phraseInput = document.getElementById('phrase-input');
  const meaningInput = document.getElementById('meaning-input');
  const addBtn = document.getElementById('add-btn');
  const clearBtn = document.getElementById('clear-btn');
  const toggleBtn = document.getElementById('toggle-panel-btn');

  let entries = [];

  function load(cb) {
    chrome.storage.local.get(['phrasebook'], (res) => {
      entries = res.phrasebook || [];
      if (cb) cb();
    });
  }

  function save() {
    chrome.storage.local.set({ phrasebook: entries });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function render() {
    listEl.innerHTML = '';
    if (!entries.length) {
      const p = document.createElement('p');
      p.className = 'empty-note';
      p.textContent = 'No phrases yet — add your first one below.';
      listEl.appendChild(p);
      return;
    }
    entries.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'entry';

      const texts = document.createElement('div');
      texts.className = 'texts';
      const phrase = document.createElement('div');
      phrase.className = 'phrase';
      phrase.textContent = e.phrase;
      const meaning = document.createElement('div');
      meaning.className = 'meaning';
      meaning.textContent = e.meaning;
      texts.appendChild(phrase);
      texts.appendChild(meaning);

      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        entries.splice(i, 1);
        save();
        render();
      });

      row.appendChild(texts);
      row.appendChild(del);
      listEl.appendChild(row);
    });
  }

  function addEntry() {
    const phrase = phraseInput.value.trim();
    const meaning = meaningInput.value.trim();
    if (!phrase || !meaning) return;
    entries.push({ phrase, meaning });
    save();
    render();
    phraseInput.value = '';
    meaningInput.value = '';
    phraseInput.focus();
  }

  addBtn.addEventListener('click', addEntry);
  [phraseInput, meaningInput].forEach((el) => {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') addEntry(); });
  });

  clearBtn.addEventListener('click', () => {
    if (!entries.length) return;
    if (confirm('Delete all phrasebook entries?')) {
      entries = [];
      save();
      render();
    }
  });

  /** Toggle the side panel on the active tab (explicit click only). */
  toggleBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    if (!/^https?:\/\/(www\.)?twitch\.tv\//.test(tab.url || '')) {
      toggleBtn.textContent = 'Open a Twitch tab first';
      setTimeout(() => { toggleBtn.textContent = 'Open panel on this tab'; }, 1800);
      return;
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => { window.__tpbToggle && window.__tpbToggle(); }
    });
    window.close();
  });

  load(render);
})();
