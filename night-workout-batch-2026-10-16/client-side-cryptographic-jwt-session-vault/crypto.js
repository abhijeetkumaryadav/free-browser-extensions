// ─── JWT crypto engine (testable, no DOM dependencies) ──────────────────────
// ENGINE-START
const te = new TextEncoder();
const td = new TextDecoder();

/** Base64url-decode to bytes. Throws on invalid input. */
function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Base64url-encode bytes. */
function b64urlEncode(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Parse a JWT into header/payload/signature without verifying.
 * @returns {{header: object, payload: object, signingInput: string, signature: Uint8Array}}
 */
function parseJwt(token) {
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new Error('Not a JWT (expected 3 dot-separated parts)');
  const header = JSON.parse(td.decode(b64urlDecode(parts[0])));
  const payload = JSON.parse(td.decode(b64urlDecode(parts[1])));
  return { header, payload, signingInput: `${parts[0]}.${parts[1]}`, signature: b64urlDecode(parts[2]) };
}

const HMAC_ALGS = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' };

/**
 * Verify an HMAC-signed JWT against a secret using SubtleCrypto.
 * Constant-time comparison of the computed vs provided signature.
 * @returns {Promise<{supported: boolean, valid: boolean, alg: string}>}
 */
async function verifyJwtHmac(token, secret) {
  const { header, signingInput, signature } = parseJwt(token);
  const alg = header.alg || 'none';
  const hash = HMAC_ALGS[alg];
  if (!hash) return { supported: false, valid: false, alg };
  const key = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash }, false, ['verify']);
  const valid = await crypto.subtle.verify('HMAC', key, signature, te.encode(signingInput));
  return { supported: true, valid, alg };
}

/** Derive an AES-GCM key from a passphrase via PBKDF2 (210k iterations). */
async function deriveVaultKey(passphrase, salt) {
  const base = await crypto.subtle.importKey('raw', te.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Encrypt a UTF-8 string; returns {salt, iv, data} base64url-encoded. */
async function vaultEncrypt(plain, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveVaultKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(plain));
  return { salt: b64urlEncode(salt), iv: b64urlEncode(iv), data: b64urlEncode(new Uint8Array(ct)) };
}

/** Decrypt a vaultEncrypt() blob; throws on wrong passphrase / tampering. */
async function vaultDecrypt(blob, passphrase) {
  const key = await deriveVaultKey(passphrase, b64urlDecode(blob.salt));
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64urlDecode(blob.iv) },
    key, b64urlDecode(blob.data));
  return td.decode(pt);
}
// ENGINE-END

/** Describe a standard claim for display. */
function claimHint(name) {
  const hints = {
    exp: 'expiry (unix seconds)', iat: 'issued at', nbf: 'not valid before',
    iss: 'issuer', sub: 'subject', aud: 'audience', jti: 'token id',
  };
  return hints[name] || '';
}

/** Human-readable remaining time until `exp` (unix seconds). */
function expiryCountdown(exp) {
  if (typeof exp !== 'number') return 'no exp claim';
  const diff = exp * 1000 - Date.now();
  if (diff <= 0) return 'EXPIRED';
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m ${s % 60}s left`;
}
