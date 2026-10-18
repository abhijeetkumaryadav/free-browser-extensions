/* Session Vault — popup logic.
   Storage schema (chrome.storage.local):
     vault_salt_b64   — base64 salt (exists => vault created)
     vault_canary     — {iv, ct} AES-GCM of 'session-vault-canary'
     vault_sessions   — array of {id, savedAt, iv, ct} (names/dates encrypted)
   The derived key lives ONLY in this script's memory while the popup is
   open. Closing the popup drops it (auto-lock).
*/
'use strict';

const $ = (id) => document.getElementById(id);

let vaultKey = null; // AES-GCM CryptoKey, in-memory only

async function getStored(keys) {
  return chrome.storage.local.get(keys);
}

function fmtDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// ---------- Views ----------

async function init() {
  const { vault_salt_b64: salt } = await getStored('vault_salt_b64');
  if (salt) {
    $('unlockBox').classList.remove('hidden');
  } else {
    $('setupBox').classList.remove('hidden');
  }
}

function showVault() {
  $('lockedView').classList.add('hidden');
  $('vaultView').classList.remove('hidden');
  renderSessions();
}

function showLocked() {
  vaultKey = null;
  $('vaultView').classList.add('hidden');
  $('lockedView').classList.remove('hidden');
}

// ---------- Create ----------

$('createBtn').addEventListener('click', async () => {
  const p1 = $('newPass').value;
  const p2 = $('newPass2').value;
  $('setupErr').textContent = '';
  if (p1.length < 8) {
    $('setupErr').textContent = 'Use at least 8 characters — longer is better.';
    return;
  }
  if (p1 !== p2) {
    $('setupErr').textContent = 'Passphrases do not match.';
    return;
  }
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(p1, salt);
  const canary = await encryptSession(key, 'session-vault-canary');
  await chrome.storage.local.set({
    vault_salt_b64: toB64(salt),
    vault_canary: canary,
    vault_sessions: []
  });
  vaultKey = key;
  $('newPass').value = '';
  $('newPass2').value = '';
  showVault();
});

// ---------- Unlock ----------

$('unlockBtn').addEventListener('click', async () => {
  const pass = $('pass').value;
  $('unlockErr').textContent = '';
  const { vault_salt_b64: saltB64, vault_canary: canary } =
    await getStored(['vault_salt_b64', 'vault_canary']);
  if (!saltB64 || !canary) {
    $('unlockErr').textContent = 'Vault data is missing or corrupt.';
    return;
  }
  const key = await deriveKey(pass, fromB64(saltB64));
  const ok = await verifyPassphrase(key, canary);
  if (!ok) {
    $('unlockErr').textContent = 'Wrong passphrase. Try again.';
    return;
  }
  vaultKey = key;
  $('pass').value = '';
  showVault();
});

$('pass').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('unlockBtn').click();
});

// ---------- Wipe (forgot passphrase) ----------

$('wipeBtn').addEventListener('click', async () => {
  if (!confirm('This permanently deletes all encrypted sessions. Continue?')) return;
  await chrome.storage.local.remove(['vault_salt_b64', 'vault_canary', 'vault_sessions']);
  location.reload();
});

// ---------- Save session ----------

$('saveBtn').addEventListener('click', async () => {
  if (!vaultKey) return;
  const name = $('sessName').value.trim() || ('Session ' + fmtDate(Date.now()));
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const sessionObj = {
    name,
    savedAt: Date.now(),
    tabs: tabs
      .filter((t) => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('about:'))
      .map((t) => ({ url: t.url, title: t.title || t.url, pinned: !!t.pinned }))
  };
  if (sessionObj.tabs.length === 0) {
    alert('No saveable tabs in this window.');
    return;
  }
  const payload = await encryptSession(vaultKey, sessionObj);
  const { vault_sessions: list } = await getStored('vault_sessions');
  const arr = Array.isArray(list) ? list : [];
  arr.unshift({ id: 's' + Date.now().toString(36), savedAt: sessionObj.savedAt, iv: payload.iv, ct: payload.ct });
  await chrome.storage.local.set({ vault_sessions: arr });
  $('sessName').value = '';
  renderSessions();
});

// ---------- List / restore / delete ----------

async function renderSessions() {
  const box = $('sessList');
  box.innerHTML = '';
  const { vault_sessions: list } = await getStored('vault_sessions');
  const arr = Array.isArray(list) ? list : [];
  if (arr.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No saved sessions yet.';
    box.appendChild(p);
    return;
  }
  // Decrypt metadata one entry at a time (names are encrypted too).
  for (const entry of arr) {
    let meta;
    try {
      meta = await decryptSession(vaultKey, entry);
    } catch (e) {
      continue; // corrupt entry — skip rather than crash
    }
    const row = document.createElement('div');
    row.className = 'sess';

    const info = document.createElement('div');
    info.className = 's-name';
    info.textContent = meta.name;
    const sub = document.createElement('span');
    sub.className = 's-meta';
    sub.textContent = `${meta.tabs.length} tab${meta.tabs.length === 1 ? '' : 's'} · ${fmtDate(meta.savedAt)}`;
    info.appendChild(sub);

    const openBtn = document.createElement('button');
    openBtn.textContent = 'Restore';
    openBtn.addEventListener('click', () => restoreSession(meta));

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.className = 'del';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${meta.name}" permanently?`)) return;
      const { vault_sessions: cur } = await getStored('vault_sessions');
      await chrome.storage.local.set({
        vault_sessions: (cur || []).filter((e) => e.id !== entry.id)
      });
      renderSessions();
    });

    row.appendChild(info);
    row.appendChild(openBtn);
    row.appendChild(delBtn);
    box.appendChild(row);
  }
}

async function restoreSession(meta) {
  // Opens in a new window — never touches current tabs.
  await chrome.windows.create({
    url: meta.tabs.map((t) => t.url),
    focused: true
  });
}

$('lockBtn').addEventListener('click', showLocked);

init();
