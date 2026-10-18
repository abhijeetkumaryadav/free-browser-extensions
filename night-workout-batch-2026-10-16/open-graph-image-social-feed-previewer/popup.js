/* Popup controller: runs the on-demand scan, renders previews + health issues. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const scanBtn = $('scanBtn'), statusEl = $('status');
  const showIssues = $('showIssues');

  const RING_C = 263.9; // 2πr for r=42

  function setRing(score) {
    $('ringBar').style.strokeDashoffset = String(RING_C - (RING_C * score) / 100);
    $('scoreNum').textContent = score;
    const bar = $('ringBar');
    bar.style.stroke = score >= 80 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171';
  }

  function verdict(score) {
    if (score >= 80) return 'Share-ready — this page’s cards should look good on social feeds.';
    if (score >= 50) return 'Needs polish — a few tag issues could hurt how the share looks.';
    return 'Fix before sharing — important tags are missing or broken.';
  }

  function fill(id, val, fallback) {
    const el = $(id);
    el.textContent = val || fallback;
    el.style.color = val ? '' : '#64748b';
  }

  function renderPreview(data) {
    const t = data.tags;
    const domain = data.host;
    // Facebook: prefers og: tags, falls back to title/meta description
    fill('fbTitle', t.ogTitle || data.title, 'No title available');
    fill('fbDesc', t.ogDesc || t.desc, 'No description available');
    $('fbDomain').textContent = (t.ogSite ? t.ogSite.toUpperCase() + ' · ' : '') + domain.toUpperCase();
    // X: twitter: tags preferred, og: fallback
    fill('xTitle', t.twTitle || t.ogTitle || data.title, 'No title available');
    fill('xDesc', t.twDesc || t.ogDesc || t.desc, 'No description available');
    $('xDomain').textContent = '🔗 ' + domain;
    // LinkedIn: og: tags
    fill('liTitle', t.ogTitle || data.title, 'No title available');
    fill('liDesc', t.ogDesc || t.desc, 'No description available');
    $('liDomain').textContent = domain;

    const imgs = [
      ['fbImg', 'fbImgFallback', data.images.fb],
      ['xImg', 'xImgFallback', data.images.x],
      ['liImg', 'liImgFallback', data.images.fb],
    ];
    for (const [imgId, fbId, img] of imgs) {
      const el = $(imgId), f = $(fbId);
      if (img.ok) { el.src = img.url; el.classList.remove('broken'); el.style.display = ''; f.classList.add('hidden'); }
      else { el.classList.add('broken'); el.style.display = 'none'; f.classList.remove('hidden'); }
    }
  }

  function renderIssues(issues) {
    const box = $('issues');
    box.innerHTML = '';
    if (!issues.length) {
      box.innerHTML = '<div class="issue low"><div class="issue-title">All clear 🎉</div><div class="issue-body">No tag health issues detected on this page.</div></div>';
    } else {
      const rank = { high: 0, medium: 1, low: 2 };
      for (const i of [...issues].sort((a, b) => rank[a.sev] - rank[b.sev])) {
        const d = document.createElement('div');
        d.className = 'issue ' + i.sev;
        d.innerHTML = '<div class="issue-title">' + escapeHtml(i.title) + '</div>' +
                      '<div class="issue-body">' + i.body + '</div>';
        box.appendChild(d);
      }
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function scan() {
    scanBtn.disabled = true;
    statusEl.className = 'status';
    statusEl.textContent = 'Scanning the page’s meta tags…';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found.');
      // Listen for the scan result, then inject
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Scan timed out — this page may block scripts.')), 15000);
        const listener = (msg) => {
          if (msg?.type === 'OG_SCAN_RESULT') {
            clearTimeout(timer);
            chrome.runtime.onMessage.removeListener(listener);
            resolve(msg.result);
          }
        };
        chrome.runtime.onMessage.addListener(listener);
        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }).catch((e) => {
          clearTimeout(timer);
          chrome.runtime.onMessage.removeListener(listener);
          reject(e);
        });
      });
      if (!result?.ok) throw new Error('The page did not return a scan result.');
      await chrome.storage.local.set({ ogLastScan: { when: Date.now(), result } });
      render(result);
      statusEl.className = 'status';
      statusEl.textContent = verdict(result.score);
    } catch (e) {
      statusEl.className = 'status error';
      statusEl.textContent = 'Scan failed: ' + (e?.message || e);
    } finally {
      scanBtn.disabled = false;
    }
  }

  function render(result) {
    for (const id of ['summary', 'cardsTitle', 'cards', 'issuesTitle', 'issues']) $(id).classList.remove('hidden');
    setRing(result.score);
    $('statTags').textContent = result.tagCount;
    $('statIssues').textContent = result.issues.length;
    $('statPlatforms').textContent = result.platformsOk;
    renderPreview(result);
    renderIssues(result.issues);
    applyIssueFilter();
  }

  function applyIssueFilter() {
    const onlyIssues = !showIssues.checked;
    document.querySelectorAll('#issues .issue').forEach((el) => {
      el.style.display = (onlyIssues && el.classList.contains('low')) ? 'none' : '';
    });
  }

  showIssues.addEventListener('change', applyIssueFilter);
  scanBtn.addEventListener('click', scan);

  // Restore last scan on open
  (async () => {
    const { ogLastScan } = await chrome.storage.local.get('ogLastScan');
    if (ogLastScan?.result?.ok) {
      render(ogLastScan.result);
      statusEl.textContent = verdict(ogLastScan.result.score) + ' (last scan restored)';
    }
  })();
})();
