/* Session Integrity Vault — crypto helpers.
 * PBKDF2-SHA-256 (600k iterations) -> AES-free HMAC-SHA-256 signing key.
 * The key is non-extractable and memory-only; exports are signed JSON files. */
const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(passphrase, saltB64) {
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
    base,
    { name: "HMAC", hash: "SHA-256" },
    false, // non-extractable: the passphrase must be re-entered every session
    ["sign", "verify"]
  );
}

function randomSaltB64() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b));
}

async function signPayload(key, payloadStr) {
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadStr));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verifyPayload(key, payloadStr, sigB64) {
  const sig = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
  return crypto.subtle.verify("HMAC", key, sig, enc.encode(payloadStr));
}

// Build the canonical payload string for a session object.
function canonicalize(obj) {
  return JSON.stringify(obj);
}

window.VaultCrypto = { deriveKey, randomSaltB64, signPayload, verifyPayload, canonicalize };
