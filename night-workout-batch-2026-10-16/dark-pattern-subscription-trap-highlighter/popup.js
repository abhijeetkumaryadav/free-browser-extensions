/* Dark Pattern Spotter — popup logic. */
(() => {
  'use strict';

  const scanBtn = document.getElementById('scanBtn');
  const clearBtn = document.getElementById('clearBtn');
  const summary = document.getElementById('summary');
  const results = document.getElementById('results');
  let all = [];
  let filter = 'all';

  async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || /^chrome(|-extension):/.test(tab.url || '')) return null;
    return tab;
  }

  function render() {
    const list = all.filter(f => filter === 'all' || f.sev === filter);
    const counts = { high: 0, medium: 0, low: 0 };
    all.forEach(f => counts[f.sev]++);
    summary.innerHTML = `
      <div class="sum"><b style="color:var(--high)">${counts.high}</b><span>High</span></div>
      <div class="sum"><b style="color:var(--medium)">${counts.medium}</b><span>Medium</span></div>
      <div class="sum"><b style="color:var(--low)">${counts.low}</b><span>Low</span></div>`;
    if (!list.length) {
      results.innerHTML = `<div class="empty">${all.length ? 'No findings at this severity.' : 'No dark patterns detected on this page.<br>Heuristics only — stay sharp anyway.'}</div>`;
      return;
    }
    results.innerHTML = '';
    list.forEach(f => {
      const card = document.createElement('div');
      card.className = `finding sev-${f.sev}`;
      card.innerHTML = `<h3><span class="badge">${f.sev}</span>${escapeHtml(f.title)}</h3>
        <p>${escapeHtml(f.why)}</p>
        ${f.snippet ? `<div class="snippet">“${escapeHtml(f.snippet)}”</div>` : ''}`;
      card.style.cursor = 'pointer';
      card.title = 'Click to scroll to the element';
      card.addEventListener('click', async () => {
        const tab = await activeTab();
        if (tab) chrome.tabs.sendMessage(tab.id, { type: 'dps-goto', index: f.index }).catch(() => {});
      });
      results.appendChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  document.querySelectorAll('.chip').forEach(ch => {
    ch.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      ch.classList.add('active');
      filter = ch.dataset.sev;
      render();
    });
  });

  scanBtn.addEventListener('click', async () => {
    scanBtn.disabled = true;
    results.innerHTML = '<div class="empty">Scanning…</div>';
    try {
      const tab = await activeTab();
      if (!tab) { results.innerHTML = '<div class="empty">Cannot scan this page.</div>'; return; }
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'dps-scan' });
      all = (res && res.findings) || [];
      // Highest severity first
      const rank = { high: 0, medium: 1, low: 2 };
      all.sort((a, b) => rank[a.sev] - rank[b.sev]);
      render();
    } catch (e) {
      results.innerHTML = '<div class="empty">Scan failed on this page.</div>';
    } finally {
      scanBtn.disabled = false;
    }
  });

  clearBtn.addEventListener('click', async () => {
    const tab = await activeTab();
    if (tab) chrome.tabs.sendMessage(tab.id, { type: 'dps-clear' }).catch(() => {});
    all = [];
    summary.innerHTML = '';
    results.innerHTML = '<div class="empty">Highlights cleared.</div>';
  });
})();
