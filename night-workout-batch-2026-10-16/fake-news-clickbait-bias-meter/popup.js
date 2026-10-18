/* Clickbait & Bias Meter — popup logic.
 * Injects content.js on demand (activeTab + scripting), renders scored headlines. */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const scanBtn = $('scanBtn');
  const summaryEl = $('summary');
  const resultsEl = $('results');
  const emptyEl = $('empty');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function verdictFor(avg) {
    if (avg >= 55) return 'Heavily sensational page';
    if (avg >= 28) return 'Some sensational framing';
    return 'Mostly measured headlines';
  }

  function render(data) {
    resultsEl.innerHTML = '';
    if (!data || !data.headlines.length) {
      summaryEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      emptyEl.innerHTML = 'No headlines found on this page.<br>Try a news or article page.';
      return;
    }
    emptyEl.classList.add('hidden');
    summaryEl.classList.remove('hidden');

    $('avgScore').textContent = data.avg;
    $('verdict').textContent = verdictFor(data.avg);
    $('countLine').textContent = `${data.count} headline${data.count === 1 ? '' : 's'} scanned · average signal score`;

    const frag = document.createDocumentFragment();
    data.headlines.forEach((h) => {
      const card = document.createElement('div');
      card.className = 'card';
      const tagCls = h.level === 'high' ? 'high' : h.level === 'med' ? 'med' : 'low';
      const tagTxt = h.level === 'high' ? 'HIGH' : h.level === 'med' ? 'MODERATE' : 'LOW';

      let sigHtml = '';
      if (h.signals.length) {
        sigHtml = '<div class="signals">' + h.signals.map((s) =>
          `<div class="sig"><span class="dot"></span><span><b>${esc(s.label)}</b> (+${s.pts}) — ${esc(s.detail)}</span></div>`
        ).join('') + '</div>';
      } else {
        sigHtml = '<div class="signals"><div class="sig"><span class="dot" style="background:var(--ok)"></span><span>No clickbait/bias signals detected.</span></div></div>';
      }

      card.innerHTML =
        `<div class="hl">${esc(h.text)}</div>` +
        `<div class="row"><span class="tag ${tagCls}">${tagTxt}</span><span class="score">${h.score}/100</span></div>` +
        `<div class="meter"><i style="width:${h.score}%"></i></div>` +
        sigHtml;
      frag.appendChild(card);
    });
    resultsEl.appendChild(frag);
  }

  async function scan() {
    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning…';
    emptyEl.classList.add('hidden');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) throw new Error('No active tab.');
      if (/^(chrome|edge|about|chrome-extension):/.test(tab.url || '')) {
        throw new Error('Cannot scan browser system pages. Try a news or article page.');
      }
      const injected = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      const data = injected && injected[0] ? injected[0].result : null;
      if (!data) throw new Error('Scan returned no data.');
      await chrome.storage.local.set({ lastScan: data, lastScanAt: Date.now() });
      render(data);
    } catch (err) {
      emptyEl.classList.remove('hidden');
      emptyEl.innerHTML = 'Scan failed: ' + esc(err.message || String(err));
    } finally {
      scanBtn.disabled = false;
      scanBtn.textContent = 'Scan this page';
    }
  }

  // Restore last scan on popup open
  chrome.storage.local.get(['lastScan'], (res) => {
    if (res.lastScan && res.lastScan.headlines) render(res.lastScan);
  });

  scanBtn.addEventListener('click', scan);
})();
