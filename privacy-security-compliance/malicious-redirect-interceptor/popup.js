/* Popup: enable toggle, whitelist manager, interception log. */
'use strict';

const $ = id => document.getElementById(id);

async function load() {
  const d = await chrome.storage.local.get({ enabled: true, whitelist: [], log: [] });

  const toggle = $('enabledToggle');
  toggle.checked = d.enabled !== false;
  toggle.addEventListener('change', () => {
    chrome.storage.local.set({ enabled: toggle.checked });
  });

  renderWhitelist(d.whitelist || []);
  renderLog(d.log || []);
}

function renderWhitelist(list) {
  const box = $('wl');
  box.innerHTML = '';
  if (!list.length) {
    box.innerHTML = '<p class="hint">No trusted domains yet.</p>';
    return;
  }
  for (const domain of list) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = domain + ' ';
    const x = document.createElement('button');
    x.textContent = '✕';
    x.title = 'Remove';
    x.addEventListener('click', async () => {
      const d = await chrome.storage.local.get({ whitelist: [] });
      await chrome.storage.local.set({
        whitelist: (d.whitelist || []).filter(w => w !== domain)
      });
      renderWhitelist((d.whitelist || []).filter(w => w !== domain));
    });
    chip.append(x);
    box.append(chip);
  }
}

$('addBtn').addEventListener('click', addDomain);
$('domainInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') addDomain();
});

async function addDomain() {
  const input = $('domainInput');
  let v = input.value.trim().toLowerCase()
    .replace(/^https?:\/\//, '').split('/')[0];
  if (!v || !v.includes('.')) { input.value = ''; input.focus(); return; }
  const d = await chrome.storage.local.get({ whitelist: [] });
  const list = d.whitelist || [];
  if (!list.includes(v)) {
    list.push(v);
    await chrome.storage.local.set({ whitelist: list });
  }
  input.value = '';
  renderWhitelist(list);
}

function renderLog(log) {
  const box = $('log');
  box.innerHTML = '';
  if (!log.length) {
    box.innerHTML = '<p class="hint">None yet.</p>';
    return;
  }
  for (const e of log) {
    const div = document.createElement('div');
    div.className = 'entry';
    const route = document.createElement('div');
    route.className = 'route';
    route.textContent = `${host(e.from)} → ${host(e.to)}`;
    const meta = document.createElement('div');
    meta.className = 'meta';
    const act = document.createElement('span');
    act.className = 'act';
    act.textContent = e.action === 'continued' ? 'User continued' :
                      e.action === 'went back' ? 'User went back' : 'Paused';
    const t = document.createElement('time');
    t.textContent = new Date(e.at).toLocaleString();
    meta.append(act, t);
    div.append(route, meta);
    box.append(div);
  }
}

function host(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

load();
