// Feed Diversity Ticker — popup logic.
'use strict';

const $ = (id) => document.getElementById(id);
const scanBtnHTML = $('scanBtn').innerHTML;

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isScannable(tab) {
  return tab && tab.url && /^(https?|file):/.test(tab.url);
}

function verdict(score) {
  if (score >= 70) return 'Broad mix of sources';
  if (score >= 40) return 'Moderate variety';
  if (score > 0) return 'Narrow source set';
  return 'No outbound links found';
}

function render(res) {
  $('scoreNum').textContent = res.score;
  $('scoreSub').textContent = verdict(res.score);
  $('linkCount').textContent = res.totalLinks;
  $('domainCount').textContent = res.domainCount;
  $('authorCount').textContent = res.authorCount;

  const list = $('sourceList');
  list.innerHTML = '';
  if (!res.domains.length) {
    list.innerHTML = '<p class="empty">No outbound domains found on this page.</p>';
  } else {
    const max = res.domains[0].count;
    for (const d of res.domains) {
      const share = Math.round((d.count / res.totalLinks) * 100);
      const row = document.createElement('div');
      row.className = 'source-row';
      const top = document.createElement('div');
      top.className = 'source-top';
      const name = document.createElement('span');
      name.className = 'source-name';
      name.textContent = d.domain;
      name.title = d.domain;
      const pct = document.createElement('span');
      pct.className = 'source-share';
      pct.textContent = d.count + ' · ' + share + '%';
      top.append(name, pct);
      const bar = document.createElement('div');
      bar.className = 'bar';
      const fill = document.createElement('div');
      fill.style.width = Math.max(4, (d.count / max) * 100) + '%';
      bar.appendChild(fill);
      row.append(top, bar);
      list.appendChild(row);
    }
  }
  const now = new Date();
  $('scannedAt').textContent = 'scanned ' + now.toLocaleTimeString();
}

$('scanBtn').addEventListener('click', async () => {
  const tab = await activeTab();
  if (!isScannable(tab)) {
    $('scoreSub').textContent = 'Cannot scan this page (try a normal website).';
    return;
  }
  $('scanBtn').disabled = true;
  $('scanBtn').textContent = 'Scanning…';
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch (e) { /* already injected */ }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'FDT_SCAN' });
    render(res);
  } catch (e) {
    $('scoreSub').textContent = 'Scan failed — the page may have navigated.';
  }
  $('scanBtn').disabled = false;
  $('scanBtn').innerHTML = scanBtnHTML;
});
