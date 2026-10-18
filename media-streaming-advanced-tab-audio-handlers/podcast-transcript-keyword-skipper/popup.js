/* Transcript Keyword Skipper — popup logic.
 * Injects content.js on demand, then drives highlight / prev-next navigation. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const keywordsEl = $('keywords'), findBtn = $('find');
  const caseEl = $('case'), wholeEl = $('whole');
  const resultsEl = $('results'), countEl = $('count'), posEl = $('pos');
  const chipsEl = $('chips'), clearBtn = $('clear'), errorEl = $('error');

  let total = 0;
  let current = -1;
  let activeKeywords = [];

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = !msg;
  }

  // Get the active tab, injecting the content script if it isn't there yet.
  async function withContentScript() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab found.');
    if (!/^https?:/.test(tab.url || '')) {
      throw new Error('Open a web page (not a browser page) to scan its transcript.');
    }
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
    } catch (_) {
      // Content script not present yet — inject it on demand.
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    }
    return tab.id;
  }

  function renderResults() {
    resultsEl.hidden = total === 0;
    clearBtn.hidden = total === 0;
    countEl.textContent = total + (total === 1 ? ' match' : ' matches');
    posEl.textContent = total ? (current + 1) + ' / ' + total : '–';
    chipsEl.innerHTML = '';
    activeKeywords.forEach(k => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = k;
      chipsEl.appendChild(chip);
    });
  }

  async function goto(index) {
    try {
      const tabId = await withContentScript();
      const res = await chrome.tabs.sendMessage(tabId, { action: 'goto', index });
      if (res && res.ok) { current = res.index; renderResults(); }
    } catch (err) {
      showError('Navigation failed: ' + err.message);
    }
  }

  findBtn.addEventListener('click', async () => {
    showError('');
    const keywords = keywordsEl.value.split(',').map(k => k.trim()).filter(Boolean);
    if (!keywords.length) { showError('Enter at least one keyword.'); return; }
    findBtn.disabled = true;
    try {
      const tabId = await withContentScript();
      const res = await chrome.tabs.sendMessage(tabId, {
        action: 'highlight',
        keywords,
        caseSensitive: caseEl.checked,
        wholeWords: wholeEl.checked
      });
      if (!res || !res.ok) throw new Error((res && res.error) || 'Scan failed.');
      total = res.count;
      current = total ? 0 : -1;
      activeKeywords = keywords;
      renderResults();
      if (total) await goto(0);
      else showError('No matches found for these keywords on this page.');
      // Remember preferences (not page content) on-device.
      chrome.storage.local.set({ tksPrefs: { caseSensitive: caseEl.checked, wholeWords: wholeEl.checked } });
    } catch (err) {
      showError(err.message);
    } finally {
      findBtn.disabled = false;
    }
  });

  keywordsEl.addEventListener('keydown', e => { if (e.key === 'Enter') findBtn.click(); });
  $('prev').addEventListener('click', () => total && goto(current - 1));
  $('next').addEventListener('click', () => total && goto(current + 1));

  clearBtn.addEventListener('click', async () => {
    try {
      const tabId = await withContentScript();
      await chrome.tabs.sendMessage(tabId, { action: 'clear' });
    } catch (_) { /* page may be gone; just reset UI */ }
    total = 0; current = -1; activeKeywords = [];
    renderResults(); showError('');
  });

  // Restore saved toggle preferences on-device.
  chrome.storage.local.get('tksPrefs', ({ tksPrefs }) => {
    if (tksPrefs) {
      caseEl.checked = !!tksPrefs.caseSensitive;
      wholeEl.checked = !!tksPrefs.wholeWords;
    }
  });
})();
