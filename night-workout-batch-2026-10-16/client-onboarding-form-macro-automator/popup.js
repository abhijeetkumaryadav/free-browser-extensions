/* Onboard Macro — popup controller.
   Data model in chrome.storage.local:
     { profiles: { [name]: [ {pat, ans}, ... ] }, activeProfile: name }
   Fill is always explicit: chrome.scripting.inject on the active tab,
   and content.js blocks password / payment / file fields client-side.
   Nothing is ever submitted automatically. */
'use strict';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');

const setStatus = (msg, cls) => {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (cls ? ' ' + cls : '');
};

/* ---------- storage ---------- */
async function loadState() {
  const d = await chrome.storage.local.get(['profiles', 'activeProfile']);
  return {
    profiles: d.profiles || {},
    activeProfile: d.activeProfile || null
  };
}
async function saveState(s) {
  await chrome.storage.local.set({ profiles: s.profiles, activeProfile: s.activeProfile });
}

/* ---------- UI render ---------- */
function renderProfiles(state) {
  const sel = $('profile');
  sel.innerHTML = '';
  const names = Object.keys(state.profiles).sort();
  for (const n of names) {
    const o = document.createElement('option');
    o.value = n; o.textContent = n;
    sel.appendChild(o);
  }
  if (state.activeProfile && state.profiles[state.activeProfile]) {
    sel.value = state.activeProfile;
  } else if (names.length) {
    sel.value = names[0];
    state.activeProfile = names[0];
  }
  return state;
}

function renderMappings(state) {
  const box = $('mappings');
  box.innerHTML = '';
  const maps = (state.profiles[state.activeProfile] || []);
  if (!maps.length) {
    box.innerHTML = '<p class="empty">No mappings yet — add one below.</p>';
    return;
  }
  for (let i = 0; i < maps.length; i++) {
    const div = document.createElement('div');
    div.className = 'map-item';
    const p = document.createElement('span');
    p.className = 'p'; p.textContent = maps[i].pat;
    const a = document.createElement('span');
    a.className = 'a'; a.textContent = maps[i].ans;
    const del = document.createElement('button');
    del.textContent = '✕';
    del.title = 'Delete mapping';
    del.addEventListener('click', async () => {
      const st = await loadState();
      st.profiles[st.activeProfile].splice(i, 1);
      await saveState(st);
      renderProfiles(st); renderMappings(st);
    });
    div.append(p, a, del);
    box.appendChild(div);
  }
}

/* ---------- events ---------- */
async function refresh() {
  const st = await loadState();
  renderProfiles(st);
  renderMappings(st);
  await saveState(st);
}

$('add-profile').addEventListener('click', async () => {
  const name = $('new-profile').value.trim();
  if (!name) { setStatus('Type a profile name first.', 'warn'); return; }
  const st = await loadState();
  if (!st.profiles[name]) st.profiles[name] = [];
  st.activeProfile = name;
  await saveState(st);
  $('new-profile').value = '';
  refresh();
  setStatus(`Profile “${name}” ready.`, 'ok');
});

$('del-profile').addEventListener('click', async () => {
  const st = await loadState();
  const n = $('profile').value;
  if (!n) return;
  delete st.profiles[n];
  st.activeProfile = Object.keys(st.profiles)[0] || null;
  await saveState(st);
  refresh();
  setStatus(`Profile “${n}” deleted.`, 'warn');
});

$('profile').addEventListener('change', async () => {
  const st = await loadState();
  st.activeProfile = $('profile').value;
  await saveState(st);
  renderMappings(st);
});

$('add-map').addEventListener('click', async () => {
  const pat = $('pat').value.trim();
  const ans = $('ans').value;
  if (!pat) { setStatus('Give the mapping a label pattern.', 'warn'); return; }
  const st = await loadState();
  const prof = $('profile').value;
  if (!prof) { setStatus('Create a profile first.', 'warn'); return; }
  st.profiles[prof].push({ pat, ans });
  await saveState(st);
  $('pat').value = ''; $('ans').value = '';
  renderMappings(st);
  setStatus(`Mapping “${pat}” added.`, 'ok');
});

/* ---------- tab injection ---------- */
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
function tabOk(tab) {
  return tab && tab.url && /^(https?:|file:)/.test(tab.url);
}
async function runOnTab(fn, arg) {
  const tab = await activeTab();
  if (!tabOk(tab)) {
    setStatus('Open a regular web page first.', 'warn');
    return null;
  }
  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fn,
    args: [arg]
  });
  return res ? res.result : null;
}

/* Scan: list fillable fields + which pattern would match */
$('scan').addEventListener('click', async () => {
  const st = await loadState();
  const prof = $('profile').value;
  const maps = (prof && st.profiles[prof]) || [];
  if (!maps.length) { setStatus('Add at least one mapping first.', 'warn'); return; }
  setStatus('Scanning form…');
  const res = await runOnTab(scanFields, maps);
  if (!res) return;
  setStatus(
    `Found ${res.total} fillable fields — ${res.matched} match your mappings, ${res.blocked} blocked (password/payment).`,
    'ok'
  );
});

/* Fill: explicit user click only */
$('fill').addEventListener('click', async () => {
  const st = await loadState();
  const prof = $('profile').value;
  const maps = (prof && st.profiles[prof]) || [];
  if (!maps.length) { setStatus('Add at least one mapping first.', 'warn'); return; }
  setStatus('Filling…');
  const res = await runOnTab(fillFields, maps);
  if (!res) return;
  setStatus(
    `Filled ${res.filled} of ${res.matched} matched fields. Skipped ${res.blocked} blocked fields. Review before submitting.`,
    res.blocked ? 'warn' : 'ok'
  );
});

/* ---------- page-side functions (injected, self-contained) ---------- */
/* Blocklist: never touch passwords, credit-card or file inputs. */
function scanFields(maps) {
  const BLOCK = /password|passcode|pin|cc-?num|card-?number|cvv|cvc|exp-?date|security-?code|ssn|social-?security/i;
  const fields = document.querySelectorAll('input, textarea, select');
  let total = 0, matched = 0, blocked = 0;
  for (const f of fields) {
    if (f.disabled || f.readOnly) continue;
    const t = (f.type || '').toLowerCase();
    if (t === 'hidden' || t === 'submit' || t === 'button' || t === 'checkbox' || t === 'radio') continue;
    total++;
    const hay = [f.name, f.id, f.placeholder, f.getAttribute('aria-label')]
      .filter(Boolean).join(' ');
    const lbl = f.labels && f.labels[0] ? f.labels[0].innerText : '';
    if (t === 'password' || BLOCK.test(hay) || BLOCK.test(lbl)) { blocked++; continue; }
    const text = (hay + ' ' + lbl).toLowerCase();
    if (maps.some((m) => m.pat && text.includes(m.pat.toLowerCase()))) matched++;
  }
  return { total, matched, blocked };
}

function fillFields(maps) {
  const BLOCK = /password|passcode|pin|cc-?num|card-?number|cvv|cvc|exp-?date|security-?code|ssn|social-?security/i;
  const fields = document.querySelectorAll('input, textarea, select');
  let matched = 0, filled = 0, blocked = 0;
  for (const f of fields) {
    if (f.disabled || f.readOnly) continue;
    const t = (f.type || '').toLowerCase();
    if (t === 'hidden' || t === 'submit' || t === 'button' || t === 'checkbox' || t === 'radio') continue;
    const hay = [f.name, f.id, f.placeholder, f.getAttribute('aria-label')]
      .filter(Boolean).join(' ');
    const lbl = f.labels && f.labels[0] ? f.labels[0].innerText : '';
    if (t === 'password' || BLOCK.test(hay) || BLOCK.test(lbl)) { blocked++; continue; }
    const text = (hay + ' ' + lbl).toLowerCase();
    const m = maps.find((x) => x.pat && text.includes(x.pat.toLowerCase()));
    if (!m) continue;
    matched++;
    try {
      if (f.tagName === 'SELECT') {
        const opt = [...f.options].find((o) =>
          o.text.toLowerCase().includes(String(m.ans).toLowerCase()) ||
          o.value.toLowerCase() === String(m.ans).toLowerCase());
        if (opt) { f.value = opt.value; filled++; }
      } else {
        f.focus();
        f.value = m.ans;
        f.dispatchEvent(new Event('input', { bubbles: true }));
        f.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      }
    } catch (e) { /* skip fields that refuse assignment */ }
  }
  return { matched, filled, blocked };
}

refresh();
