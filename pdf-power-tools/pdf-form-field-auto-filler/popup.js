/* FormPilot popup controller — profiles, page scan, preview, approved fill. */
const $ = (id) => document.getElementById(id);

/* Fields every profile can hold, in editor order. */
const PROFILE_FIELDS = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'fullName', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address1', label: 'Address line 1' },
  { key: 'address2', label: 'Address line 2' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State / Province' },
  { key: 'zip', label: 'ZIP / Postal code' },
  { key: 'country', label: 'Country' },
  { key: 'company', label: 'Company' },
  { key: 'website', label: 'Website' },
  { key: 'dob', label: 'Date of birth' },
];

const FIELD_LABELS = Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, f.label]));

const mainView = $('mainView');
const editorView = $('editorView');
const profileSelect = $('profileSelect');
const scanBtn = $('scanBtn');
const previewCard = $('previewCard');
const fieldList = $('fieldList');
const fieldCount = $('fieldCount');
const toggleAllBtn = $('toggleAllBtn');
const fillBtn = $('fillBtn');
const resultMsg = $('resultMsg');

let editingId = null; // profile id being edited, or 'new'

/* ---------- storage ---------- */

function blankProfile(name) {
  const fields = {};
  for (const f of PROFILE_FIELDS) fields[f.key] = '';
  return { id: 'p' + Date.now().toString(36), name, fields };
}

async function loadStore() {
  const { formpilot } = await chrome.storage.local.get('formpilot');
  if (formpilot && Array.isArray(formpilot.profiles)) return formpilot;
  const seed = { profiles: [blankProfile('Personal')], activeId: null };
  seed.activeId = seed.profiles[0].id;
  await chrome.storage.local.set({ formpilot: seed });
  return seed;
}

async function saveStore(store) {
  await chrome.storage.local.set({ formpilot: store });
}

function activeProfile(store) {
  return (
    store.profiles.find((p) => p.id === store.activeId) || store.profiles[0]
  );
}

/* ---------- main view ---------- */

function renderProfiles(store) {
  profileSelect.innerHTML = '';
  for (const p of store.profiles) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === store.activeId) opt.selected = true;
    profileSelect.appendChild(opt);
  }
}

function showResult(text, isError) {
  resultMsg.textContent = text;
  resultMsg.classList.toggle('error', !!isError);
  resultMsg.classList.remove('hidden');
}

function hideResult() {
  resultMsg.classList.add('hidden');
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function injectFiller(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['filler.js'] });
}

async function runInPage(tabId, fn, args) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: fn,
    args: args || [],
  });
  return results && results[0] ? results[0].result : null;
}

function fieldRowEl(field, profile) {
  const hasValue = field.matchedKey && String(profile.fields[field.matchedKey] || '').trim() !== '';
  const row = document.createElement('label');
  row.className = 'field-row';

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'frow-check';
  check.checked = !!hasValue;
  check.dataset.idx = field.idx;

  const body = document.createElement('div');
  body.className = 'frow-body';
  const lab = document.createElement('div');
  lab.className = 'frow-label';
  lab.textContent = field.label;
  const meta = document.createElement('div');
  meta.className = 'frow-meta';
  meta.textContent = `${field.inputType}${field.name ? ' · ' + field.name : ''}`;
  body.append(lab, meta);

  const map = document.createElement('select');
  map.className = 'frow-map';
  map.dataset.idx = field.idx;
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '— skip —';
  map.appendChild(none);
  for (const f of PROFILE_FIELDS) {
    const opt = document.createElement('option');
    opt.value = f.key;
    opt.textContent = f.label;
    if (f.key === field.matchedKey) opt.selected = true;
    map.appendChild(opt);
  }
  // A row is only fillable when a mapping is chosen; uncheck when skipped.
  map.addEventListener('change', () => {
    if (!map.value) check.checked = false;
    else if (String(profile.fields[map.value] || '').trim() !== '') check.checked = true;
    updateFillCount();
  });
  check.addEventListener('change', updateFillCount);

  row.append(check, body, map);
  return row;
}

function selectedMapping() {
  const mapping = {};
  fieldList.querySelectorAll('.field-row').forEach((row) => {
    const check = row.querySelector('.frow-check');
    const map = row.querySelector('.frow-map');
    if (check.checked && map.value) mapping[map.dataset.idx] = map.value;
  });
  return mapping;
}

function updateFillCount() {
  const n = Object.keys(selectedMapping()).length;
  fillBtn.textContent = n > 0 ? `Fill selected (${n})` : 'Fill selected';
}

async function scanPage() {
  hideResult();
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning…';
  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id || /^(chrome|chrome-extension|edge|about):/.test(tab.url || '')) {
      showResult('FormPilot cannot scan this page — open a regular website first.', true);
      return;
    }
    await injectFiller(tab.id);
    const fields = await runInPage(tab.id, () => window.__fpScan());
    if (!fields || fields.length === 0) {
      previewCard.classList.remove('hidden');
      fieldList.innerHTML = '';
      fieldCount.textContent = '— none found';
      showResult('No fillable fields found on this page.', true);
      updateFillCount();
      return;
    }
    const store = await loadStore();
    const profile = activeProfile(store);
    fieldList.innerHTML = '';
    for (const f of fields) fieldList.appendChild(fieldRowEl(f, profile));
    fieldCount.textContent = `(${fields.length})`;
    previewCard.classList.remove('hidden');
    updateFillCount();
  } catch (err) {
    showResult('Scan failed: ' + String((err && err.message) || err), true);
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan this page';
  }
}

async function fillSelected() {
  hideResult();
  const mapping = selectedMapping();
  if (Object.keys(mapping).length === 0) {
    showResult('Select at least one field and map it to a profile field.', true);
    return;
  }
  fillBtn.disabled = true;
  try {
    const tab = await getActiveTab();
    const store = await loadStore();
    const profile = activeProfile(store);
    const res = await runInPage(
      tab.id,
      (m, values) => window.__fpFill(m, values),
      [mapping, profile.fields]
    );
    if (res) {
      showResult(
        `Filled ${res.filled} of ${res.total} selected field${res.total === 1 ? '' : 's'}. ` +
          (res.filled < res.total ? 'Some fields were empty or refused input.' : 'Review the page before submitting.')
      );
    }
  } catch (err) {
    showResult('Fill failed: ' + String((err && err.message) || err), true);
  } finally {
    fillBtn.disabled = false;
  }
}

toggleAllBtn.addEventListener('click', () => {
  const checks = [...fieldList.querySelectorAll('.frow-check')];
  const allChecked = checks.every((c) => c.checked);
  checks.forEach((c) => {
    const row = c.closest('.field-row');
    const map = row.querySelector('.frow-map');
    c.checked = !allChecked && !!map.value;
  });
  updateFillCount();
});

scanBtn.addEventListener('click', scanPage);
fillBtn.addEventListener('click', fillSelected);

profileSelect.addEventListener('change', async () => {
  const store = await loadStore();
  store.activeId = profileSelect.value;
  await saveStore(store);
  previewCard.classList.add('hidden'); // stale preview; rescan for the new profile
});

/* ---------- editor view ---------- */

function openEditor(store, profileId) {
  editingId = profileId; // 'new' or existing id
  const profile = profileId === 'new' ? blankProfile('') : store.profiles.find((p) => p.id === profileId);
  $('editName').value = profileId === 'new' ? '' : profile.name;
  const wrap = $('editFields');
  wrap.innerHTML = '';
  for (const f of PROFILE_FIELDS) {
    const div = document.createElement('div');
    div.className = 'edit-field';
    const lab = document.createElement('label');
    lab.textContent = f.label;
    const inp = document.createElement('input');
    inp.className = 'text-input';
    inp.dataset.key = f.key;
    inp.value = profileId === 'new' ? '' : profile.fields[f.key] || '';
    inp.autocomplete = 'off';
    div.append(lab, inp);
    wrap.appendChild(div);
  }
  mainView.classList.add('hidden');
  editorView.classList.remove('hidden');
}

function closeEditor() {
  editorView.classList.add('hidden');
  mainView.classList.remove('hidden');
}

$('newProfileBtn').addEventListener('click', async () => {
  const store = await loadStore();
  openEditor(store, 'new');
});
$('editProfileBtn').addEventListener('click', async () => {
  const store = await loadStore();
  openEditor(store, store.activeId);
});
$('delProfileBtn').addEventListener('click', async () => {
  const store = await loadStore();
  if (store.profiles.length <= 1) {
    showResult('You need at least one profile.', true);
    return;
  }
  const profile = activeProfile(store);
  if (!confirm(`Delete profile "${profile.name}"?`)) return;
  store.profiles = store.profiles.filter((p) => p.id !== profile.id);
  store.activeId = store.profiles[0].id;
  await saveStore(store);
  renderProfiles(store);
  previewCard.classList.add('hidden');
});
$('cancelEditBtn').addEventListener('click', closeEditor);

$('saveProfileBtn').addEventListener('click', async () => {
  const name = $('editName').value.trim();
  if (!name) {
    $('editName').focus();
    return;
  }
  const store = await loadStore();
  const fields = {};
  document.querySelectorAll('#editFields .text-input').forEach((inp) => {
    fields[inp.dataset.key] = inp.value.trim();
  });
  if (editingId === 'new') {
    const p = { id: 'p' + Date.now().toString(36), name, fields };
    store.profiles.push(p);
    store.activeId = p.id;
  } else {
    const p = store.profiles.find((x) => x.id === editingId);
    if (p) {
      p.name = name;
      p.fields = fields;
    }
  }
  await saveStore(store);
  renderProfiles(store);
  closeEditor();
  previewCard.classList.add('hidden');
});

/* ---------- export / import ---------- */

$('exportBtn').addEventListener('click', async () => {
  const store = await loadStore();
  const blob = new Blob([JSON.stringify(store.profiles, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'formpilot-profiles.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

$('importBtn').addEventListener('click', () => $('importFile').click());

$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.profiles;
    if (!Array.isArray(list)) throw new Error('bad format');
    const store = await loadStore();
    let added = 0;
    for (const p of list) {
      if (!p || typeof p.name !== 'string' || typeof p.fields !== 'object') continue;
      const fields = {};
      for (const f of PROFILE_FIELDS) fields[f.key] = String(p.fields[f.key] || '');
      store.profiles.push({ id: 'p' + Date.now().toString(36) + added, name: p.name.slice(0, 60), fields });
      added++;
    }
    await saveStore(store);
    renderProfiles(store);
    showResult(`Imported ${added} profile${added === 1 ? '' : 's'}.`);
  } catch (err) {
    showResult('Import failed — not a valid FormPilot JSON file.', true);
  }
});

/* ---------- init ---------- */

document.addEventListener('DOMContentLoaded', async () => {
  const store = await loadStore();
  renderProfiles(store);
});
