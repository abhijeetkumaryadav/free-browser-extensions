// Session Vault — crypto module.
// AES-GCM (256-bit) via Web Crypto. Key = PBKDF2(SHA-256, 600k iterations)
// stretched from the user's passphrase + per-vault salt.
// The derived key lives only in memory (never in storage).
// Storage holds only: salt, iv, ciphertext — useless without the passphrase.
'use strict';

const enc = new TextEncoder();
const dec = new TextDecoder();

const PBKDF2_ITERATIONS = 600000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

function toB64(u8) {
  let s = '';
  for (const x of u8) s += String.fromCharCode(x);
  return btoa(s);
}

function fromB64(s) {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function deriveKey(passphrase, salt) {
  const base = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: the raw key can never be read out
    ['encrypt', 'decrypt']
  );
}

async function encryptSession(key, sessionObj) {
  const iv = randomBytes(IV_BYTES);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(sessionObj))
  );
  return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

async function decryptSession(key, payload) {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(payload.iv) },
    key,
    fromB64(payload.ct)
  );
  return JSON.parse(dec.decode(pt));
}

// Verify the passphrase by trial-decrypting a stored canary blob.
// Returns true/false — never throws for a wrong passphrase.
async function verifyPassphrase(key, canary) {
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(canary.iv) },
      key,
      fromB64(canary.ct)
    );
    return dec.decode(pt) === JSON.stringify('session-vault-canary');
  } catch (e) {
    return false;
  }
}
