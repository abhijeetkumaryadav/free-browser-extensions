/* Session Integrity Vault — popup logic.
 * Flow: unlock (derive HMAC key from passphrase + stored salt, verify canary)
 * -> export (sign canonical session JSON, download) -> verify/restore a file.
 * Key lives only in memory; locking or closing the popup forgets it. */

const C = window.VaultCrypto;
const passEl = document.getElementById("pass");
const lockStateEl = document.getElementById("lockState");
const statusEl = document.getElementById("status");
const vresultEl = document.getElementById("vresult");
const fileEl = document.getElementById("file");
const fileNameEl = document.getElementById("fileName");

let key = null;       // in-memory HMAC key, never persisted
let pendingFile = null; // parsed file object, verified flag

async function getSalt() {
  let { vaultSalt } = await chrome.storage.local.get("vaultSalt");
  if (!vaultSalt) {
    vaultSalt = C.randomSaltB64();
    await chrome.storage.local.set({ vaultSalt, canarySig: null });
  }
  return vaultSalt;
}

function setLockedUI(locked) {
  lockStateEl.textContent = locked ? "Locked." : "Unlocked — key is in memory only.";
  lockStateEl.className = "hint " + (locked ? "" : "good");
}

document.getElementById("unlock").addEventListener("click", async () => {
  const pass = passEl.value;
  if (!pass) { statusEl.textContent = "Enter a passphrase first."; return; }
  try {
    const salt = await getSalt();
    const k = await C.deriveKey(pass, salt);
    const { canarySig } = await chrome.storage.local.get("canarySig");
    if (!canarySig) {
      // First unlock: store a canary signature so future passphrases can be checked.
      const sig = await C.signPayload(k, "vault-canary");
      await chrome.storage.local.set({ canarySig: sig });
      key = k; setLockedUI(false); statusEl.textContent = "Vault created & unlocked.";
    } else {
      const ok = await C.verifyPayload(k, "vault-canary", canarySig);
      if (ok) { key = k; setLockedUI(false); statusEl.textContent = "Unlocked."; }
      else { statusEl.textContent = "Wrong passphrase."; }
    }
  } catch (e) { statusEl.textContent = "Error: " + e.message; }
});

document.getElementById("lock").addEventListener("click", () => {
  key = null; pendingFile = null; passEl.value = "";
  setLockedUI(true); statusEl.textContent = "Locked — key forgotten.";
});

document.getElementById("export").addEventListener("click", async () => {
  if (!key) { statusEl.textContent = "Unlock first."; return; }
  const name = document.getElementById("sessName").value.trim() || "session";
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const entries = tabs
    .filter((t) => t.url && !t.url.startsWith("chrome://") && !t.url.startsWith("about:"))
    .map((t) => ({ title: t.title || "", url: t.url }));
  const session = { format: "session-integrity-vault/1", name, savedAt: new Date().toISOString(), entries };
  const payload = C.canonicalize(session);
  const sig = await C.signPayload(key, payload);
  const { vaultSalt } = await chrome.storage.local.get("vaultSalt");
  const file = { payload, signature: sig, salt: vaultSalt, alg: "PBKDF2-SHA256/600k+HMAC-SHA256" };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/[^\w.-]+/g, "_") + ".signed-session.json";
  a.click();
  URL.revokeObjectURL(a.href);
  statusEl.textContent = "Exported " + entries.length + " tabs (signed).";
});

fileEl.addEventListener("change", () => {
  const f = fileEl.files[0];
  fileNameEl.textContent = f ? f.name : "No file chosen.";
  pendingFile = null;
});

document.getElementById("verify").addEventListener("click", async () => {
  vresultEl.classList.remove("hidden");
  if (!key) { vresultEl.className = "result warn"; vresultEl.innerHTML = "<strong>Unlock first.</strong><p>The key is needed to verify.</p>"; return; }
  const f = fileEl.files[0];
  if (!f) { vresultEl.className = "result warn"; vresultEl.innerHTML = "<strong>No file chosen.</strong>"; return; }
  try {
    const parsed = JSON.parse(await f.text());
    if (!parsed.payload || !parsed.signature) throw new Error("Not a signed session file.");
    const ok = await C.verifyPayload(key, parsed.payload, parsed.signature);
    const session = JSON.parse(parsed.payload);
    pendingFile = ok ? { session } : null;
    vresultEl.className = "result " + (ok ? "ok" : "bad");
    vresultEl.innerHTML = ok
      ? "<strong>✓ Signature valid.</strong><p>" + session.entries.length + " tabs, signed for “" + escapeHtml(session.name) + "”. Safe to restore.</p>"
      : "<strong>✗ Signature INVALID.</strong><p>This file was modified or signed with a different passphrase. Do not trust its contents.</p>";
  } catch (e) {
    vresultEl.className = "result bad";
    vresultEl.innerHTML = "<strong>Could not verify.</strong><p>" + escapeHtml(e.message) + "</p>";
  }
});

document.getElementById("restore").addEventListener("click", async () => {
  if (!pendingFile) { statusEl.textContent = "Verify a file first."; return; }
  const urls = pendingFile.session.entries.map((e) => e.url);
  if (!urls.length) { statusEl.textContent = "Nothing to restore."; return; }
  await chrome.windows.create({ url: urls });
  statusEl.textContent = "Restored into a new window.";
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

setLockedUI(true);
