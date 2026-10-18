/* ZK Vault — password-protected local encrypted vault.
 * Crypto: PBKDF2-SHA256 (250k iterations) -> AES-256-GCM. Salt + verifier only
 * stored in chrome.storage.local; the derived key lives in chrome.storage.session
 * (in-memory, cleared on browser restart / auto-lock). 100% offline.
 * Honest scope: a LOCAL encrypted store — NOT cryptographic zero-knowledge proofs.
 */
'use strict';

const enc = new TextEncoder();
const dec = new TextDecoder();
const VERIFIER_PLAINTEXT = 'zkvault-ok-v1';
const PBKDF2_ITERATIONS = 250000;

/* ---------- base64 helpers ---------- */
function b64encode(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(s) {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/* ---------- crypto ---------- */
async function deriveKey(password, saltBytes) {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
async function encryptRecord(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { iv: b64encode(iv), ct: b64encode(ct) };
}
async function decryptRecord(key, rec) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(b64decode(rec.iv)) }, key, b64decode(rec.ct));
  return JSON.parse(dec.decode(pt));
}

/* ---------- storage ---------- */
const localGet = (keys) => chrome.storage.local.get(keys);
const localSet = (obj) => chrome.storage.local.set(obj);
const sessionGet = (keys) => chrome.storage.session.get(keys);
const sessionSet = (obj) => chrome.storage.session.set(obj);

async function touchActivity() {
  const { settings } = await localGet(['settings']);
  const mins = (settings && settings.autolockMinutes) || 5;
  await sessionSet({ lastActive: Date.now(), autolockMinutes: mins });
  // (re)arm the periodic check
  chrome.alarms.create('zkv-autolock', { periodInMinutes: 1 });
}

/* ---------- UI state ---------- */
const $ = (id) => document.getElementById(id);
let cryptoKey = null;      // in-memory only
let entries = [];          // decrypted entries for this session
let editingId = null;

function showView(name) {
  for (const v of ['setupView', 'lockView', 'vaultView']) $(v).classList.toggle('hidden', v !== name);
  $('lockBtn').classList.toggle('hidden', name !== 'vaultView');
}
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add('hidden'), 1800);
}
function fail(id, msg) {
  const el = $(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}

/* ---------- setup ---------- */
$('setupBtn').addEventListener('click', async () => {
  const p1 = $('setupPass').value, p2 = $('setupPass2').value;
  $('setupError').classList.add('hidden');
  if (p1.length < 12) return fail('setupError', 'Use at least 12 characters.');
  if (p1 !== p2) return fail('setupError', 'Passwords do not match.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(p1, salt);
  const verifier = await encryptRecord(key, { check: VERIFIER_PLAINTEXT });
  await localSet({ salt: b64encode(salt), verifier, entries: [], settings: { autolockMinutes: 5 } });
  cryptoKey = key;
  entries = [];
  await sessionSet({ key, lastActive: Date.now(), autolockMinutes: 5 });
  chrome.alarms.create('zkv-autolock', { periodInMinutes: 1 });
  $('setupPass').value = $('setupPass2').value = '';
  enterVault();
  toast('Vault created');
});

/* ---------- unlock ---------- */
$('unlockBtn').addEventListener('click', async () => {
  const pw = $('unlockPass').value;
  $('unlockError').classList.add('hidden');
  if (!pw) return fail('unlockError', 'Enter your password.');
  const { salt, verifier } = await localGet(['salt', 'verifier']);
  try {
    const key = await deriveKey(pw, new Uint8Array(b64decode(salt)));
    const check = await decryptRecord(key, verifier);
    if (check.check !== VERIFIER_PLAINTEXT) throw new Error('bad verifier');
    cryptoKey = key;
    await sessionSet({ key, lastActive: Date.now(), autolockMinutes: 5 });
    await touchActivity();
    $('unlockPass').value = '';
    await loadEntries();
    enterVault();
  } catch (e) {
    fail('unlockError', 'Wrong password.');
  }
});
$('unlockPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('unlockBtn').click(); });

/* ---------- lock / wipe ---------- */
$('lockBtn').addEventListener('click', lockNow);
async function lockNow() {
  cryptoKey = null; entries = []; editingId = null;
  await chrome.storage.session.clear();
  await chrome.alarms.clear('zkv-autolock');
  showView('lockView');
}
$('wipeBtn').addEventListener('click', async () => {
  if (!confirm('Delete the entire vault and all entries? This cannot be undone.')) return;
  await chrome.storage.local.clear();
  await chrome.storage.session.clear();
  location.reload();
});

/* ---------- vault ---------- */
function enterVault() {
  renderEntries();
  showView('vaultView');
}
async function loadEntries() {
  const { entries: stored } = await localGet(['entries']);
  entries = [];
  for (const rec of stored || []) {
    try { entries.push({ id: rec.id, ...await decryptRecord(cryptoKey, rec) }); }
    catch (e) { /* skip undecryptable record */ }
  }
}
async function persistEntries() {
  const stored = [];
  for (const e of entries) {
    const rec = await encryptRecord(cryptoKey, { title: e.title, user: e.user, secret: e.secret, notes: e.notes });
    stored.push({ id: e.id, ...rec });
  }
  await localSet({ entries: stored });
  await touchActivity();
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function renderEntries() {
  const q = $('searchBox').value.trim().toLowerCase();
  const list = $('entryList');
  list.innerHTML = '';
  const shown = entries.filter((e) =>
    !q || e.title.toLowerCase().includes(q) || (e.user || '').toLowerCase().includes(q));
  $('emptyState').classList.toggle('hidden', shown.length > 0);
  for (const e of shown) {
    const li = document.createElement('li');
    li.className = 'entry';
    li.dataset.id = e.id;
    li.innerHTML =
      '<div class="entry-top"><div><div class="entry-title">' + esc(e.title) + '</div>' +
      (e.user ? '<div class="entry-user">' + esc(e.user) + '</div>' : '') + '</div>' +
      '<div class="entry-actions">' +
      '<button class="mini-btn act-show">Show</button>' +
      '<button class="mini-btn act-copy">Copy</button>' +
      '<button class="mini-btn act-edit">Edit</button>' +
      '<button class="mini-btn danger act-del">Del</button>' +
      '</div></div>' +
      '<div class="entry-secret">' + esc(e.secret) + '</div>';
    li.querySelector('.act-show').addEventListener('click', (ev) => {
      ev.stopPropagation();
      li.classList.toggle('open');
      ev.target.textContent = li.classList.contains('open') ? 'Hide' : 'Show';
      touchActivity();
    });
    li.querySelector('.act-copy').addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await navigator.clipboard.writeText(e.secret);
      await touchActivity();
      toast('Secret copied');
    });
    li.querySelector('.act-edit').addEventListener('click', (ev) => { ev.stopPropagation(); openForm(e); });
    li.querySelector('.act-del').addEventListener('click', async (ev) => {
      ev.stopPropagation();
      if (!confirm('Delete "' + e.title + '"?')) return;
      entries = entries.filter((x) => x.id !== e.id);
      await persistEntries();
      renderEntries();
      toast('Entry deleted');
    });
    list.appendChild(li);
  }
}
$('searchBox').addEventListener('input', renderEntries);

/* ---------- add / edit form ---------- */
function openForm(e) {
  editingId = e ? e.id : null;
  $('formTitle').textContent = e ? 'Edit entry' : 'New entry';
  $('fTitle').value = e ? e.title : '';
  $('fUser').value = e ? (e.user || '') : '';
  $('fSecret').value = e ? e.secret : '';
  $('fNotes').value = e ? (e.notes || '') : '';
  $('entryForm').classList.remove('hidden');
}
$('addBtn').addEventListener('click', () => openForm(null));
$('cancelEntryBtn').addEventListener('click', () => { $('entryForm').classList.add('hidden'); editingId = null; });
$('saveEntryBtn').addEventListener('click', async () => {
  const title = $('fTitle').value.trim();
  if (!title) { toast('Title is required'); return; }
  const data = { title, user: $('fUser').value.trim(), secret: $('fSecret').value, notes: $('fNotes').value.trim() };
  if (editingId) {
    const e = entries.find((x) => x.id === editingId);
    Object.assign(e, data);
  } else {
    entries.push({ id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), ...data });
  }
  await persistEntries();
  $('entryForm').classList.add('hidden');
  editingId = null;
  renderEntries();
  toast('Saved');
});

/* ---------- settings ---------- */
$('autolockSel').addEventListener('change', async () => {
  const mins = parseInt($('autolockSel').value, 10);
  const { settings } = await localGet(['settings']);
  await localSet({ settings: { ...(settings || {}), autolockMinutes: mins } });
  await touchActivity();
  toast('Auto-lock updated');
});

/* ---------- init ---------- */
(async function init() {
  const { salt } = await localGet(['salt']);
  if (!salt) { showView('setupView'); return; }
  const sess = await sessionGet(['key']);
  if (sess && sess.key) {
    cryptoKey = sess.key;
    const { settings } = await localGet(['settings']);
    if (settings && settings.autolockMinutes) $('autolockSel').value = String(settings.autolockMinutes);
    await loadEntries();
    enterVault();
    await touchActivity();
  } else {
    showView('lockView');
  }
})();
