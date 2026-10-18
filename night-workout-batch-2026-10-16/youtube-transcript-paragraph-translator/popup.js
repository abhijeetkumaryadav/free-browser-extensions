/* popup.js — Transcript Paragrapher UI logic */
'use strict';

(function () {
  const rawInput = document.getElementById('raw-input');
  const formatBtn = document.getElementById('format-btn');
  const clearBtn = document.getElementById('clear-btn');
  const backBtn = document.getElementById('back-btn');
  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');
  const pastePanel = document.getElementById('paste-panel');
  const resultPanel = document.getElementById('result-panel');
  const paraList = document.getElementById('para-list');
  const paraCount = document.getElementById('para-count');

  let current = [];   // parsed paragraphs
  let notes = {};     // index -> note text

  /** Restore last paste draft. */
  chrome.storage.local.get(['draft'], (res) => {
    if (res.draft) rawInput.value = res.draft;
  });
  rawInput.addEventListener('input', () => {
    chrome.storage.local.set({ draft: rawInput.value });
  });

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function render() {
    paraList.innerHTML = '';
    paraCount.textContent = current.length + (current.length === 1 ? ' paragraph' : ' paragraphs');
    current.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'para-card';

      if (p.timestamp) {
        const ts = document.createElement('span');
        ts.className = 'ts';
        ts.textContent = p.timestamp;
        card.appendChild(ts);
      }
      const body = document.createElement('div');
      body.className = 'body';
      body.textContent = p.text;
      card.appendChild(body);

      const note = document.createElement('input');
      note.className = 'note-input';
      note.type = 'text';
      note.placeholder = 'Add a note for this paragraph…';
      note.value = notes[String(i)] || '';
      note.addEventListener('input', () => {
        if (note.value.trim()) notes[String(i)] = note.value.trim();
        else delete notes[String(i)];
        chrome.storage.local.set({ notes });
      });
      card.appendChild(note);

      paraList.appendChild(card);
    });
  }

  formatBtn.addEventListener('click', () => {
    current = parseTranscript(rawInput.value);
    chrome.storage.local.get(['notes'], (res) => {
      notes = res.notes || {};
      render();
    });
    pastePanel.classList.add('hidden');
    resultPanel.classList.remove('hidden');
  });

  backBtn.addEventListener('click', () => {
    resultPanel.classList.add('hidden');
    pastePanel.classList.remove('hidden');
  });

  clearBtn.addEventListener('click', () => {
    rawInput.value = '';
    notes = {};
    current = [];
    chrome.storage.local.remove(['draft', 'notes']);
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(renderPlainText(current, notes));
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
    } catch (e) {
      copyBtn.textContent = 'Copy failed';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
    }
  });

  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([renderPlainText(current, notes)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcript-paragraphs.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
})();
