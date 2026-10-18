/* Tab Vault — PIN-locked tab storage.
   Honest scope: real biometrics aren't available to extensions, so this is
   a PIN-locked vault. PIN is stored as salted SHA-256, never plaintext.
   Everything stays in on-device storage; nothing is transmitted. */
"use strict";

/* ---------- Crypto helpers ---------- */

function randHex(bytes) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, "0")).join("");
}

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(salt + ":" + pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}

/* ---------- Storage ---------- */

const store = {
  get: keys => new Promise(res => chrome.storage.local.get(keys, res)),
  set: obj => new Promise(res => chrome.storage.local.set(obj, res)),
  remove: keys => new Promise(res => chrome.storage.local.remove(keys, res)),
  // Unlock state lives in session storage: gone when the browser closes.
  sget: keys => new Promise(res => chrome.storage.session.get(keys, res)),
  sset: obj => new Promise(res => chrome.storage.session.set(obj, res)),
  sremove: keys => new Promise(res => chrome.storage.session.remove(keys, res)),
};

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- State ---------- */

async function hasPin() {
  const { pinHash } = await store.get("pinHash");
  return !!pinHash;
}

async function isUnlocked() {
  const { unlockedUntil } = await store.sget("unlockedUntil");
  if (!unlockedUntil) return false;
  if (Date.now() > unlockedUntil) {
    await store.sremove("unlockedUntil");
    return false;
  }
  return true;
}

async function lock() {
  await store.sremove("unlockedUntil");
  showLock();
}

/* ---------- Views ---------- */

function show(id) {
  for (const v of ["setupView", "lockView", "vaultView"]) {
    $(v).classList.toggle("hidden", v !== id);
  }
}

function setBadge(unlocked) {
  const b = $("lockBadge");
  b.textContent = unlocked ? "unlocked" : "locked";
  b.className = "lock-state " + (unlocked ? "unlocked" : "locked");
}

async function showSetup() { setBadge(false); show("setupView"); }
async function showLock() {
  setBadge(false);
  show("lockView");
  $("pinUnlock").value = "";
  $("unlockError").textContent = "";
  const { vault = [] } = await store.get("vault");
  $("vaultCountLock").textContent = vault.length;
  await renderLockout();
}
async function showVault() {
  setBadge(true);
  show("vaultView");
  const { autoLockMin = 0 } = await store.get("autoLockMin");
  $("autoLockSel").value = String(autoLockMin);
  await renderVault();
}

/* ---------- Setup ---------- */

$("setupBtn").addEventListener("click", async () => {
  const a = $("pinNew").value.trim();
  const b = $("pinConfirm").value.trim();
  const err = $("setupError");
  if (!/^\d{4,12}$/.test(a)) { err.textContent = "PIN must be 4–12 digits."; return; }
  if (a !== b) { err.textContent = "PINs don't match."; return; }
  err.textContent = "";
  const salt = randHex(16);
  await store.set({
    pinHash: await hashPin(a, salt),
    salt, vault: [], failCount: 0, lockoutUntil: 0, autoLockMin: 0
  });
  $("pinNew").value = ""; $("pinConfirm").value = "";
  await unlockSession();
  await showVault();
});

/* ---------- Unlock / lockout ---------- */

async function renderLockout() {
  const { lockoutUntil = 0 } = await store.get("lockoutUntil");
  const left = Math.ceil((lockoutUntil - Date.now()) / 1000);
  const msg = $("lockoutMsg");
  const btn = $("unlockBtn");
  if (left > 0) {
    msg.textContent = `Too many attempts. Try again in ${left}s.`;
    btn.disabled = true;
    setTimeout(renderLockout, 1000);
  } else {
    msg.textContent = "";
    btn.disabled = false;
  }
}

async function attemptUnlock() {
  const pin = $("pinUnlock").value.trim();
  const err = $("unlockError");
  const { lockoutUntil = 0, failCount = 0, pinHash, salt } =
    await store.get(["lockoutUntil", "failCount", "pinHash", "salt"]);
  if (Date.now() < lockoutUntil) { await renderLockout(); return; }
  if (!pin) { err.textContent = "Enter your PIN."; return; }
  const ok = (await hashPin(pin, salt)) === pinHash;
  $("pinUnlock").value = "";
  if (ok) {
    await store.set({ failCount: 0, lockoutUntil: 0 });
    await unlockSession();
    await showVault();
  } else {
    const n = failCount + 1;
    const waitSec = Math.min(300, 5 * Math.pow(2, n - 1)); // 5s, 10s, 20s… cap 5min
    await store.set({ failCount: n, lockoutUntil: Date.now() + waitSec * 1000 });
    err.textContent = "Wrong PIN.";
    await renderLockout();
  }
}

$("unlockBtn").addEventListener("click", attemptUnlock);
$("pinUnlock").addEventListener("keydown", e => { if (e.key === "Enter") attemptUnlock(); });

async function unlockSession() {
  const { autoLockMin = 0 } = await store.get("autoLockMin");
  const until = autoLockMin > 0 ? Date.now() + autoLockMin * 60_000 : Number.MAX_SAFE_INTEGER;
  await store.sset({ unlockedUntil: until });
}

$("lockNowBtn").addEventListener("click", lock);

/* ---------- Wipe (forgot PIN) ---------- */

$("wipeBtn").addEventListener("click", async () => {
  if (!confirm("Wipe the entire vault? Secured tabs will be lost permanently.")) return;
  if (!confirm("Really wipe? This cannot be undone.")) return;
  await store.remove(["pinHash", "salt", "vault", "failCount", "lockoutUntil", "autoLockMin"]);
  await store.sremove("unlockedUntil");
  await showSetup();
});

/* ---------- Vault operations ---------- */

function tabToEntry(t) {
  return {
    id: randHex(8),
    url: t.url, title: t.title || t.url,
    favIconUrl: t.favIconUrl || "",
    addedAt: Date.now()
  };
}

$("stashCurrentBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/.test(tab.url)) { alert("Only regular web pages can be stashed."); return; }
  const { vault = [] } = await store.get("vault");
  vault.push(tabToEntry(tab));
  await store.set({ vault });
  await chrome.tabs.remove(tab.id);
  await renderVault();
});

$("stashAllBtn").addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const stashable = tabs.filter(t => /^https?:/.test(t.url));
  if (!stashable.length) return;
  if (!confirm(`Stash ${stashable.length} tabs into the vault?`)) return;
  const { vault = [] } = await store.get("vault");
  for (const t of stashable) vault.push(tabToEntry(t));
  await store.set({ vault });
  await chrome.tabs.remove(stashable.map(t => t.id));
  await renderVault();
});

$("restoreBtn").addEventListener("click", async () => {
  const { vault = [] } = await store.get("vault");
  if (!vault.length) return;
  const urls = vault.map(e => e.url);
  await chrome.windows.create({ url: urls });
  await store.set({ vault: [] });
  await renderVault();
});

async function renderVault() {
  const { vault = [] } = await store.get("vault");
  $("vaultCount").textContent = vault.length;
  $("vaultMeta").innerHTML = `<span>${vault.length}</span> tab${vault.length === 1 ? "" : "s"} secured`;
  const list = $("vaultList");
  list.innerHTML = "";
  $("vaultEmpty").style.display = vault.length ? "none" : "block";
  [...vault].reverse().forEach(entry => {
    const li = document.createElement("li");
    li.className = "tab";
    li.innerHTML =
      (entry.favIconUrl ? `<img src="${esc(entry.favIconUrl)}" alt="">` : "") +
      `<div class="t-meta"><div class="t-title"></div><div class="t-url"></div></div>` +
      `<button class="t-del" title="Delete">✕</button>`;
    li.querySelector(".t-title").textContent = entry.title;
    li.querySelector(".t-url").textContent = entry.url;
    li.querySelector(".t-del").addEventListener("click", async () => {
      const { vault: v = [] } = await store.get("vault");
      await store.set({ vault: v.filter(x => x.id !== entry.id) });
      await renderVault();
    });
    list.appendChild(li);
  });
}

/* ---------- Settings ---------- */

$("autoLockSel").addEventListener("change", async e => {
  await store.set({ autoLockMin: Number(e.target.value) });
  await unlockSession(); // apply new timeout to this session
});

$("changePinBtn").addEventListener("click", async () => {
  const cur = prompt("Enter current PIN:");
  if (cur === null) return;
  const { pinHash, salt } = await store.get(["pinHash", "salt"]);
  if ((await hashPin(cur.trim(), salt)) !== pinHash) { alert("Wrong PIN."); return; }
  const next = prompt("Enter new PIN (4–12 digits):");
  if (next === null) return;
  if (!/^\d{4,12}$/.test(next.trim())) { alert("PIN must be 4–12 digits."); return; }
  const newSalt = randHex(16);
  await store.set({ pinHash: await hashPin(next.trim(), newSalt), salt: newSalt });
  alert("PIN changed.");
});

/* ---------- Boot ---------- */

(async function boot() {
  if (!(await hasPin())) { await showSetup(); return; }
  if (await isUnlocked()) { await showVault(); } else { await showLock(); }
})();
