// Popup logic: tab switching, on-demand cancel-link scan (explicit click only),
// a persistent cancel checklist, and renewal reminders via chrome.alarms +
// chrome.notifications. All data stays in chrome.storage.local.

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  /* ---------- tabs ---------- */
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      $('panel-' + t.dataset.tab).classList.add('active');
    });
  });

  /* ---------- scan ---------- */
  $('scanBtn').addEventListener('click', async () => {
    const box = $('scanResults');
    box.hidden = false;
    box.innerHTML = '<p class="empty">Scanning visible links…</p>';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || /^chrome|^edge|^about/.test(tab.url || '')) {
        box.innerHTML = '<p class="empty">Cannot scan this page (browser internal page). Open the site\u2019s account/billing page first.</p>';
        return;
      }
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => (typeof window.__cancelHelperScan === 'function' ? window.__cancelHelperScan() : []),
      });
      renderResults(box, result || []);
    } catch (e) {
      box.innerHTML = '<p class="empty">Scan failed on this page. ' + escapeHtml(e.message || '') + '</p>';
    }
  });

  function renderResults(box, links) {
    if (!links.length) {
      box.innerHTML = '<p class="empty">No obvious cancel links found on this page.<br>Try the account settings or billing section, or use the Checklist tab for a manual walkthrough.</p>';
      return;
    }
    box.innerHTML = '';
    for (const l of links) {
      const card = document.createElement('div');
      card.className = 'link-card';
      card.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>' +
        '<div><div class="lt">' + escapeHtml(l.text) + '</div>' +
        (l.href ? '<div class="lu">' + escapeHtml(l.href) + '</div>' : '') + '</div>' +
        '<span class="score-tag">' + l.score + '%</span>';
      box.appendChild(card);
    }
    const note = document.createElement('p');
    note.className = 'empty';
    note.textContent = 'Scores are heuristic guesses. Click the real link on the page to cancel — this popup only points.';
    box.appendChild(note);
  }

  /* ---------- checklist ---------- */
  const STEPS = [
    'Open the site\u2019s account, settings, or billing page (or its app).',
    'Find “Subscription”, “Membership”, “Billing” or “Manage plan”.',
    'Look for Cancel / Turn off auto-renew / Downgrade — it may be small, grey, or behind “More options”.',
    'If there is no online cancel option, note their support email or phone number.',
    'Confirm the cancellation and save the confirmation email/screenshot.',
    'Check your next statement to make sure no charge appears.',
  ];

  async function loadChecklist() {
    const { checked = [] } = await chrome.storage.local.get('checked');
    const list = $('checklist');
    list.innerHTML = '';
    STEPS.forEach((s, i) => {
      const li = document.createElement('li');
      if (checked[i]) li.classList.add('done');
      li.innerHTML = '<input type="checkbox"' + (checked[i] ? ' checked' : '') + '><span>' + escapeHtml(s) + '</span>';
      const cb = li.querySelector('input');
      cb.addEventListener('change', async () => {
        const { checked: cur = [] } = await chrome.storage.local.get('checked');
        cur[i] = cb.checked;
        await chrome.storage.local.set({ checked: cur });
        li.classList.toggle('done', cb.checked);
      });
      list.appendChild(li);
    });
  }

  $('resetCheck').addEventListener('click', async () => {
    await chrome.storage.local.set({ checked: [] });
    loadChecklist();
  });

  /* ---------- reminders ---------- */
  async function loadReminders() {
    const { reminders = [] } = await chrome.storage.local.get('reminders');
    const ul = $('remList');
    ul.innerHTML = '';
    const sorted = [...reminders].sort((a, b) => a.when - b.when);
    if (!sorted.length) {
      ul.innerHTML = '<li><span class="grow rd">No reminders yet.</span></li>';
      return;
    }
    for (const r of sorted) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="grow">' + escapeHtml(r.name) +
        '<br><span class="rd">alerts ' + new Date(r.when).toLocaleDateString() + '</span></span>';
      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '×';
      del.title = 'Delete reminder';
      del.addEventListener('click', async () => {
        const { reminders: cur = [] } = await chrome.storage.local.get('reminders');
        await chrome.storage.local.set({ reminders: cur.filter((x) => x.id !== r.id) });
        try { await chrome.alarms.clear('rem-' + r.id); } catch (e) { /* ignore */ }
        loadReminders();
      });
      li.appendChild(del);
      ul.appendChild(li);
    }
  }

  $('addRem').addEventListener('click', async () => {
    const name = $('remName').value.trim();
    const date = $('remDate').value;
    const lead = parseInt($('remLead').value, 10);
    if (!name || !date) { $('remName').focus(); return; }
    const renew = new Date(date + 'T09:00:00');
    const when = renew.getTime() - lead * 24 * 60 * 60 * 1000;
    if (when <= Date.now()) {
      alert('That reminder date is already in the past.');
      return;
    }
    const id = 'r' + Date.now().toString(36);
    const { reminders = [] } = await chrome.storage.local.get('reminders');
    reminders.push({ id, name, when });
    await chrome.storage.local.set({ reminders });
    await chrome.alarms.create('rem-' + id, { when });
    $('remName').value = '';
    $('remDate').value = '';
    loadReminders();
  });

  /* ---------- background: fire notifications when alarms ring ---------- */
  // Note: alarms fire in the service-worker context. This tiny background
  // listener is registered inline in the manifest? MV3 needs a file; we
  // register it dynamically here as a fallback is not possible, so we
  // include background.js. (See background.js.)

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  loadChecklist();
  loadReminders();
})();
