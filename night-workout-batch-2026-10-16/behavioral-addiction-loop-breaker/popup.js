/* LoopBreaker — popup logic: settings, today's stats, on-demand page check. */
/* global chrome */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const ICONS = {
    scroll: '<svg viewBox="0 0 24 24"><path d="M12 3v18m0 0l-4-4m4 4l4-4"/></svg>',
    autoplay: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3V9z"/></svg>',
    streak: '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z"/></svg>',
    bait: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>',
    ephemeral: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>'
  };

  function loadSettings() {
    chrome.storage.local.get(
      { enabled: false, interval: 20, pauseLen: 30 },
      (cfg) => {
        $('enabled').checked = !!cfg.enabled;
        $('interval').value = String(cfg.interval);
        $('pauseLen').value = String(cfg.pauseLen);
      }
    );
  }

  function saveSettings() {
    chrome.storage.local.set({
      enabled: $('enabled').checked,
      interval: parseInt($('interval').value, 10),
      pauseLen: parseInt($('pauseLen').value, 10)
    });
  }

  function loadStats() {
    const day = new Date().toISOString().slice(0, 10);
    chrome.storage.local.get({ stats: {} }, ({ stats }) => {
      const s = stats[day] || { breaks: 0, mins: 0, loops: 0 };
      $('statBreaks').textContent = s.breaks;
      $('statMins').textContent = s.mins;
      $('statLoops').textContent = s.loops;
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderPatterns(patterns) {
    const box = $('patterns');
    if (!patterns || patterns.length === 0) {
      box.innerHTML = '<div class="empty">No obvious loops spotted on this page. 🎉</div>';
      return;
    }
    box.innerHTML = patterns.map((p) => `
      <div class="pattern">
        ${ICONS[p.kind] || ICONS.scroll}
        <div><div><b>${escapeHtml(p.label)}</b></div>
        <div class="host">${escapeHtml(p.detail)}</div></div>
      </div>`).join('');
  }

  async function checkPage() {
    const btn = $('checkBtn');
    btn.disabled = true;
    btn.textContent = 'Checking…';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) throw new Error('No active tab.');
      if (!/^https?:/.test(tab.url || '')) {
        throw new Error('This page cannot be checked (try a normal website).');
      }
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'loopbreaker-detect' });
      if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'Check failed.');
      renderPatterns(resp.patterns);
      loadStats();
    } catch (err) {
      $('patterns').innerHTML =
        `<div class="empty">Couldn't check: ${escapeHtml((err && err.message) || err)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '🕵️ Check this page';
    }
  }

  $('enabled').addEventListener('change', saveSettings);
  $('interval').addEventListener('change', saveSettings);
  $('pauseLen').addEventListener('change', saveSettings);
  $('checkBtn').addEventListener('click', checkPage);

  loadSettings();
  loadStats();
})();
