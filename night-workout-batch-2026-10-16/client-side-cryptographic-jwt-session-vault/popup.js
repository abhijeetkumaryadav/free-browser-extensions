// ─── JWT Session Vault — popup controller ───────────────────────────────────
// All crypto lives in crypto.js (WebCrypto only). Tokens are stored in
// chrome.storage.local. Optional passphrase lock encrypts the whole vault
// blob with AES-GCM (PBKDF2-derived key) before it hits storage.

// ─── DOM refs ───────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const tokenInput = $('tokenInput'), secretInput = $('secretInput');
const decodeBtn = $('decodeBtn'), verifyBtn = $('verifyBtn');
const inspectOut = $('inspectOut');
const nameInput = $('nameInput'), saveBtn = $('saveBtn');
const vaultList = $('vaultList'), vaultEmpty = $('vaultEmpty');
const lockToggle = $('lockToggle'), lockPanel = $('lockPanel');
const passInput = $('passInput'), unlockBtn = $('unlockBtn');

// ─── Vault state ────────────────────────────────────────────────────────────
/** @type {Array<{name: string, token: string, addedAt: number}>} */
let vault = [];
let locked = false;          // vault-level lock active?
let unlockedKey = null;      // session-only passphrase (never persisted)

const STORE_KEY = 'jwt-vault';

// ─── Storage helpers ────────────────────────────────────────────────────────
async function loadVault() {
  const data = await chrome.storage.local.get(STORE_KEY);
  const raw = data[STORE_KEY];
  if (!raw) { vault = []; locked = false; return; }
  if (raw.encrypted) {
    locked = true; vault = []; // need passphrase to decrypt
  } else {
    locked = false; vault = raw.tokens || [];
  }
}

/** Persist the vault; encrypts if a lock passphrase is set. */
async function saveVault() {
  if (unlockedKey) {
    const blob = await vaultEncrypt(JSON.stringify(vault), unlockedKey);
    await chrome.storage.local.set({ [STORE_KEY]: { encrypted: true, blob } });
  } else {
    await chrome.storage.local.set({ [STORE_KEY]: { encrypted: false, tokens: vault } });
  }
}

/** Try unlocking an encrypted vault with the typed passphrase. */
async function tryUnlock() {
  const data = await chrome.storage.local.get(STORE_KEY);
  const raw = data[STORE_KEY];
  if (!raw?.encrypted) return true;
  try {
    const json = await vaultDecrypt(raw.blob, passInput.value);
    vault = JSON.parse(json);
    unlockedKey = passInput.value;
    locked = false;
    lockPanel.classList.add('hidden');
    renderVault();
    return true;
  } catch { return false; }
}

// ─── Inspect (decode) view ──────────────────────────────────────────────────
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function renderInspect(parsed, verifyRes) {
  const { header, payload } = parsed;
  const claims = Object.entries(payload).map(([k, v]) =>
    `<tr><td>${esc(k)}</td><td>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}${claimHint(k) ? ` <span style="color:var(--muted)">(${esc(claimHint(k))})</span>` : ''}</td></tr>`).join('');
  let verdict = '';
  if (verifyRes) {
    if (!verifyRes.supported) verdict = `<span class="pill warn">alg ${esc(verifyRes.alg)} — not HMAC, cannot verify</span>`;
    else verdict = verifyRes.valid
      ? `<span class="pill ok">✓ signature valid (${esc(verifyRes.alg)})</span>`
      : `<span class="pill bad">✗ signature INVALID (${esc(verifyRes.alg)})</span>`;
  }
  inspectOut.innerHTML = `
    <div>${verdict}</div>
    <dl class="kv">
      <dt>Algorithm</dt><dd>${esc(header.alg || 'none')}</dd>
      <dt>Type</dt><dd>${esc(header.typ || '—')}</dd>
      <dt>Expiry</dt><dd>${esc(expiryCountdown(payload.exp))}</dd>
    </dl>
    <table class="claim-table">${claims}</table>`;
  inspectOut.classList.remove('hidden');
}

function inspectError(msg) {
  inspectOut.innerHTML = `<span class="pill bad">${esc(msg)}</span>`;
  inspectOut.classList.remove('hidden');
}

decodeBtn.addEventListener('click', () => {
  try { renderInspect(parseJwt(tokenInput.value), null); }
  catch (err) { inspectError(err.message); }
});

verifyBtn.addEventListener('click', async () => {
  const secret = secretInput.value;
  if (!secret) { inspectError('Enter the HMAC secret to verify the signature'); return; }
  try {
    const parsed = parseJwt(tokenInput.value);
    const res = await verifyJwtHmac(tokenInput.value, secret);
    renderInspect(parsed, res);
  } catch (err) { inspectError(err.message); }
});

// ─── Vault UI ───────────────────────────────────────────────────────────────
function renderVault() {
  vaultList.innerHTML = '';
  vaultEmpty.style.display = vault.length ? 'none' : 'block';
  lockToggle.textContent = locked ? '🔓 Unlock' : (unlockedKey ? '🔒 Locked (passphrase set)' : '🔒 Lock');
  [...vault].reverse().forEach((entry, revIdx) => {
    const idx = vault.length - 1 - revIdx;
    let expLabel = 'no exp claim', expired = false;
    try {
      const { payload } = parseJwt(entry.token);
      expLabel = expiryCountdown(payload.exp);
      expired = expLabel === 'EXPIRED';
    } catch { expLabel = 'invalid token'; }
    const li = document.createElement('li');
    li.className = 'vault-item';
    li.innerHTML = `
      <div class="vhead">
        <span class="vname">${esc(entry.name)}</span>
        <span class="vexp ${expired ? 'vexpired' : ''}">${esc(expLabel)}</span>
      </div>
      <div class="vactions">
        <button class="btn small" data-act="load">Load</button>
        <button class="btn small danger" data-act="del">Delete</button>
      </div>`;
    li.querySelector('[data-act="load"]').addEventListener('click', () => {
      tokenInput.value = entry.token;
      try { renderInspect(parseJwt(entry.token), null); } catch { /* keep raw */ }
      tokenInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    li.querySelector('[data-act="del"]').addEventListener('click', async () => {
      vault.splice(idx, 1);
      await saveVault();
      renderVault();
    });
    vaultList.appendChild(li);
  });
}

saveBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  const name = nameInput.value.trim() || `token-${vault.length + 1}`;
  if (!token) { inspectError('Paste a JWT first'); return; }
  try { parseJwt(token); } catch (err) { inspectError(err.message); return; }
  vault.push({ name, token, addedAt: Date.now() });
  await saveVault();
  nameInput.value = '';
  renderVault();
});

lockToggle.addEventListener('click', () => {
  if (locked) { lockPanel.classList.toggle('hidden'); passInput.focus(); }
  else if (!unlockedKey) {
    // Set a passphrase: encrypt current vault in-place
    lockPanel.classList.toggle('hidden');
    passInput.placeholder = 'New passphrase (sets the lock)';
    passInput.focus();
    unlockBtn.textContent = 'Set lock';
  } else {
    // Re-lock: clear session key, keep encrypted blob in storage
    unlockedKey = null; locked = true; vault = [];
    renderVault();
  }
});

unlockBtn.addEventListener('click', async () => {
  if (!passInput.value) return;
  const data = await chrome.storage.local.get(STORE_KEY);
  if (data[STORE_KEY]?.encrypted) {
    const ok = await tryUnlock();
    if (!ok) inspectError('Wrong passphrase — vault not unlocked');
    unlockBtn.textContent = 'Unlock';
  } else {
    // First-time lock: encrypt existing vault with new passphrase
    unlockedKey = passInput.value;
    await saveVault();
    lockPanel.classList.add('hidden');
    passInput.value = '';
    unlockBtn.textContent = 'Unlock';
    renderVault();
  }
});

// ─── Init ───────────────────────────────────────────────────────────────────
(async () => {
  await loadVault();
  renderVault();
})();
