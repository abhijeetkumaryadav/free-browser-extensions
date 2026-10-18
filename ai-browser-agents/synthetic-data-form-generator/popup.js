/* FakeForge — synthetic test-data generator.
   Everything is generated locally from built-in word pools. Nothing is real,
   nothing leaves the device. Form filling runs only on explicit user click. */
'use strict';

/* ---------- data pools (clearly fictional) ---------- */
const FIRST = ['Ava','Liam','Maya','Noah','Zoe','Ethan','Ivy','Lucas','Mila','Owen','Aria','Kai','Nora','Felix','Ruby','Hugo','Lena','Milo','Sana','Theo'];
const LAST = ['Carter','Bennett','Holloway','Marsh','Quill','Thornton','Vance','Whitfield','Ashford','Blackwood','Calloway','Driftwood','Ellery','Fairbanks'];
const DOMAINS = ['example.com', 'mail.test', 'demoinbox.org', 'fakemail.dev'];
const STREETS = ['Maple Ave','Cedar Lane','Birch Street','Willow Drive','Oak Boulevard','Elm Court','Pine Terrace','Aspen Way'];
const CITIES = ['Springfield','Riverton','Lakeside','Brookfield','Fairview','Hillcrest','Oakdale','Cedar Falls'];
const COMPANIES = ['Acme Widgets','Globex Labs','Initech','Umbrella Test Co','Hooli Demo','Stark Test Industries','Wayne Demo Corp'];
const LOREM = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum').split(' ');

/* ---------- helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pad = (n, l = 2) => String(n).padStart(l, '0');

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------- generators ---------- */
function genFirstName() { return pick(FIRST); }
function genLastName() { return pick(LAST); }
function genFullName() { return `${genFirstName()} ${genLastName()}`; }
function genEmail(name) {
  const base = (name || genFullName()).toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
  return `${base}${randInt(1, 99)}@${pick(DOMAINS)}`;
}
function genPhone() {
  // 555-01xx range is reserved for fictional use.
  return `(${randInt(200, 989)}) 555-01${pad(randInt(0, 99))}`;
}
function genStreet() { return `${randInt(100, 9899)} ${pick(STREETS)}`; }
function genCity() { return pick(CITIES); }
function genZip() { return `${pad(randInt(100, 999), 3)}${pad(randInt(10, 99))}`; }
function genAddress() { return `${genStreet()}, ${genCity()} ${genZip()}`; }
function genCompany() { return pick(COMPANIES); }
function genUsername(name) {
  const base = (name || genFullName()).toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');
  return `${base}_${randInt(100, 999)}`;
}
function genPassword(len = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return [...buf].map((n) => chars[n % chars.length]).join('');
}
function genUUID() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function genDOB() {
  return `${randInt(1970, 2005)}-${pad(randInt(1, 12))}-${pad(randInt(1, 28))}`;
}
function genLorem(sentences = 3) {
  const out = [];
  for (let s = 0; s < sentences; s++) {
    const len = randInt(8, 18);
    const words = [];
    for (let i = 0; i < len; i++) words.push(pick(LOREM));
    words[0] = words[0][0].toUpperCase() + words[0].slice(1);
    out.push(words.join(' ') + '.');
  }
  return out.join(' ');
}

function genProfile() {
  const first = genFirstName(), last = genLastName();
  const full = `${first} ${last}`;
  return {
    'Full name': full,
    'Email': genEmail(full),
    'Phone': genPhone(),
    'Address': genAddress(),
    'Company': genCompany(),
    'Username': genUsername(full),
    'Birth date': genDOB(),
    'UUID': genUUID(),
  };
}

/* ---------- rendering ---------- */
let currentProfile = null;

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    if (!btn) return;
    const orig = btn.innerHTML;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    setTimeout(() => { btn.innerHTML = orig; }, 1200);
  });
}

function copyBtn() {
  const b = document.createElement('button');
  b.className = 'icon-btn';
  b.title = 'Copy';
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  return b;
}

function renderProfile() {
  currentProfile = genProfile();
  const grid = $('#profileGrid');
  grid.innerHTML = '';
  Object.entries(currentProfile).forEach(([k, v]) => {
    const d = document.createElement('div');
    d.className = 'pfield';
    d.title = 'Click to copy';
    d.innerHTML = `<div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div>`;
    d.querySelector('.v').addEventListener('click', () => {
      copyText(v);
      pushHistory(k, v);
    });
    grid.appendChild(d);
  });
}

// Individual one-off fields: [label, generatorFn]
const FIELD_DEFS = [
  ['Full name', genFullName],
  ['Email', () => genEmail()],
  ['Phone', genPhone],
  ['Address', genAddress],
  ['Company', genCompany],
  ['Username', () => genUsername()],
  ['Password', () => genPassword()],
  ['UUID', genUUID],
  ['Birth date', genDOB],
  ['Lorem', () => genLorem(3)],
];

function renderFields() {
  const list = $('#fieldList');
  list.innerHTML = '';
  FIELD_DEFS.forEach(([label, fn]) => {
    const row = document.createElement('div');
    row.className = 'field-row';
    const val = fn();
    row.innerHTML = `<span class="flabel">${escapeHtml(label)}</span><span class="fval" title="${escapeHtml(val)}">${escapeHtml(val)}</span>`;
    const regen = document.createElement('button');
    regen.className = 'icon-btn';
    regen.title = 'Regenerate';
    regen.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>';
    const cp = copyBtn();
    regen.addEventListener('click', () => {
      const nv = fn();
      row.querySelector('.fval').textContent = nv;
      row.querySelector('.fval').title = nv;
    });
    cp.addEventListener('click', (e) => {
      const v = row.querySelector('.fval').textContent;
      copyText(v, cp);
      pushHistory(label, v);
    });
    row.appendChild(regen);
    row.appendChild(cp);
    list.appendChild(row);
  });
}

/* ---------- history ---------- */
async function getHistory() {
  const { history = [] } = await chrome.storage.local.get('history');
  return history;
}

async function pushHistory(kind, value) {
  const h = await getHistory();
  h.unshift({ kind, value, at: Date.now() });
  await chrome.storage.local.set({ history: h.slice(0, 12) });
  renderHistory();
}

async function renderHistory() {
  const h = await getHistory();
  const el = $('#historyList');
  el.innerHTML = '';
  if (!h.length) {
    el.innerHTML = '<div class="empty">Copied values will appear here.</div>';
    return;
  }
  h.forEach((item) => {
    const d = document.createElement('div');
    d.className = 'hist-item';
    d.title = 'Click to copy again';
    d.innerHTML = `<span class="hk">${escapeHtml(item.kind)}</span><span class="hv">${escapeHtml(item.value)}</span>`;
    d.addEventListener('click', () => copyText(item.value));
    el.appendChild(d);
  });
}

/* ---------- one-click form fill ----------
   Injected into the page on explicit user click only. Fully self-contained:
   it must not reference anything outside its own body. */
function fillPageForms() {
  const FIRST = ['Ava','Liam','Maya','Noah','Zoe','Ethan','Ivy','Lucas','Mila','Owen','Aria','Kai','Nora','Felix','Ruby','Hugo','Lena','Milo','Sana','Theo'];
  const LAST = ['Carter','Bennett','Holloway','Marsh','Quill','Thornton','Vance','Whitfield','Ashford','Blackwood','Calloway','Driftwood','Ellery','Fairbanks'];
  const CITIES = ['Springfield','Riverton','Lakeside','Brookfield','Fairview','Hillcrest','Oakdale','Cedar Falls'];
  const COMPANIES = ['Acme Widgets','Globex Labs','Initech','Umbrella Test Co','Hooli Demo'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const ri = (mn, mx) => mn + Math.floor(Math.random() * (mx - mn + 1));
  const pad = (n) => String(n).padStart(2, '0');
  const fullName = () => pick(FIRST) + ' ' + pick(LAST);
  const email = () => fullName().toLowerCase().replace(/[^a-z]+/g, '.') + ri(1, 99) + '@example.com';
  const phone = () => '(' + ri(200, 989) + ') 555-01' + pad(ri(0, 99));

  function setNative(el, value) {
    try {
      if (el.tagName === 'SELECT') {
        const opts = [...el.options].filter((o) => o.value);
        if (opts.length) el.value = opts[Math.floor(Math.random() * opts.length)].value;
      } else {
        const proto = el.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(el, value);
        else el.value = value;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) { return false; }
  }

  let filled = 0;
  document.querySelectorAll('input, textarea, select').forEach((el) => {
    if (el.disabled || el.readOnly || el.type === 'hidden' || el.type === 'submit' ||
        el.type === 'button' || el.type === 'file' || el.type === 'checkbox' || el.type === 'radio') return;
    const label = (el.labels && el.labels[0] && el.labels[0].innerText) || '';
    const key = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '') + ' ' + label).toLowerCase();
    let v = null;
    if (el.type === 'email' || /e-?mail/.test(key)) v = email();
    else if (el.type === 'tel' || /phone|mobile|\btel\b/.test(key)) v = phone();
    else if (el.type === 'password') v = 'Test' + ri(1000, 9999) + '!xQ';
    else if (/first.?name|fname|given/.test(key)) v = pick(FIRST);
    else if (/last.?name|lname|surname|family/.test(key)) v = pick(LAST);
    else if (/full.?name|your.?name|^name$/.test(key)) v = fullName();
    else if (/user.?name|login/.test(key)) v = (pick(FIRST) + '_' + ri(100, 999)).toLowerCase();
    else if (/address|street/.test(key)) v = ri(100, 9899) + ' Test Street';
    else if (/city|town/.test(key)) v = pick(CITIES);
    else if (/zip|postal|post.?code/.test(key)) v = String(ri(10000, 99999));
    else if (/company|organi/.test(key)) v = pick(COMPANIES);
    else if (/country/.test(key)) v = 'United States';
    else if (el.type === 'date' || /birth|dob/.test(key)) v = ri(1970, 2005) + '-' + pad(ri(1, 12)) + '-' + pad(ri(1, 28));
    else if (el.type === 'url' || /website/.test(key)) v = 'https://example.com';
    else if (el.type === 'number' || /\bage\b/.test(key)) v = String(ri(18, 65));
    else if (el.tagName === 'TEXTAREA' || /comment|message|bio|description/.test(key)) v = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit — synthetic test data.';
    else if (el.type === 'text' || el.type === 'search' || !el.type) v = fullName();
    if (v !== null && setNative(el, v)) filled++;
  });
  return filled;
}

async function onFillForm() {
  const status = $('#fillStatus');
  status.classList.remove('hidden');
  status.textContent = 'Filling…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || /^chrome:|^edge:|^about:/.test(tab.url || '')) {
      status.textContent = 'Cannot fill this page (browser page).';
      return;
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillPageForms,
    });
    const n = (results && results[0] && results[0].result) || 0;
    status.textContent = n ? `Filled ${n} field${n === 1 ? '' : 's'} with fake data.` : 'No fillable fields found.';
  } catch (e) {
    status.textContent = 'Could not access this page.';
  }
  setTimeout(() => status.classList.add('hidden'), 3500);
}

/* ---------- init ---------- */
$('#genProfile').addEventListener('click', renderProfile);
$('#copyJson').addEventListener('click', function () {
  if (!currentProfile) return;
  copyText(JSON.stringify(currentProfile, null, 2), this);
});
$('#fillForm').addEventListener('click', onFillForm);
$('#clearHistory').addEventListener('click', async () => {
  await chrome.storage.local.set({ history: [] });
  renderHistory();
});

renderProfile();
renderFields();
renderHistory();
