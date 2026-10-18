/* FormFill Buddy — popup logic. */
(() => {
  'use strict';

  const FIELDS = [
    ['firstName', 'First name'], ['lastName', 'Last name'],
    ['fullName', 'Full name'], ['email', 'Email'],
    ['phone', 'Phone'], ['dob', 'Date of birth'],
    ['address1', 'Address line 1'], ['address2', 'Address line 2'],
    ['city', 'City'], ['state', 'State / Province'],
    ['postal', 'Postal / ZIP code'], ['country', 'Country']
  ];

  const grid = document.getElementById('profileGrid');
  const inputs = {};
  FIELDS.forEach(([key, label]) => {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    if (['address1', 'address2', 'email'].includes(key)) wrap.classList.add('full');
    const lab = document.createElement('label');
    lab.textContent = label;
    lab.htmlFor = 'f_' + key;
    const inp = document.createElement('input');
    inp.id = 'f_' + key;
    inp.type = key === 'email' ? 'email' : 'text';
    inp.autocomplete = 'off';
    inp.spellcheck = false;
    wrap.append(lab, inp);
    grid.appendChild(wrap);
    inputs[key] = inp;
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('pane-fill').classList.toggle('hidden', btn.dataset.tab !== 'fill');
      document.getElementById('pane-profile').classList.toggle('hidden', btn.dataset.tab !== 'profile');
    });
  });

  // Load saved profile
  chrome.storage.local.get('profile', ({ profile = {} }) => {
    Object.keys(inputs).forEach(k => { inputs[k].value = profile[k] || ''; });
  });

  const saveStatus = document.getElementById('saveStatus');
  document.getElementById('saveBtn').addEventListener('click', () => {
    const profile = {};
    Object.keys(inputs).forEach(k => { profile[k] = inputs[k].value.trim(); });
    chrome.storage.local.set({ profile }, () => {
      saveStatus.textContent = 'Saved on this device.';
      saveStatus.className = 'status ok';
      setTimeout(() => { saveStatus.textContent = ''; saveStatus.className = 'status'; }, 2000);
    });
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    if (!confirm('Delete all saved details from this device?')) return;
    chrome.storage.local.remove('profile', () => {
      Object.keys(inputs).forEach(k => { inputs[k].value = ''; });
      saveStatus.textContent = 'Cleared.';
      saveStatus.className = 'status warn';
    });
  });

  // Fill — explicit user click only. Nothing auto-fills.
  const fillStatus = document.getElementById('fillStatus');
  const fillBtn = document.getElementById('fillBtn');
  fillBtn.addEventListener('click', async () => {
    fillStatus.textContent = 'Working…';
    fillStatus.className = 'status';
    fillBtn.disabled = true;
    try {
      const { profile = {} } = await chrome.storage.local.get('profile');
      if (!Object.values(profile).some(v => v)) {
        fillStatus.textContent = 'Save your details first (My details tab).';
        fillStatus.className = 'status warn';
        return;
      }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || /^chrome(|-extension):/.test(tab.url || '')) {
        fillStatus.textContent = 'Cannot fill on this page.';
        fillStatus.className = 'status warn';
        return;
      }
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      const [res] = await chrome.tabs.sendMessage(tab.id, { type: 'formfill-buddy-fill', profile });
      fillStatus.textContent = res && res.filled
        ? `Filled ${res.filled} field${res.filled === 1 ? '' : 's'}. Please verify every field before submitting.`
        : 'No matching fields found on this page.';
      fillStatus.className = 'status ok';
    } catch (e) {
      fillStatus.textContent = 'Could not fill this page.';
      fillStatus.className = 'status warn';
    } finally {
      fillBtn.disabled = false;
    }
  });
})();
