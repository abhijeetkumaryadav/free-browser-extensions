/* KeyInspect — local OpenPGP public-key parser.
 * Parses armored public keys: CRC24, packets, v4 fingerprint (SHA-1),
 * key ID, user IDs, subkeys, signature packet metadata.
 * SCOPE: inspection/parsing ONLY. No signature verification, no keyring,
 * no network. Everything runs on-device. */

'use strict';

/* ---------- small helpers ---------- */
const $ = (id) => document.getElementById(id);
const te = new TextEncoder(), td = new TextDecoder('utf-8', { fatal: false });

function b64ToBytes(b64) {
  const clean = b64.replace(/\s+/g, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function hex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function fmtFpr(fprHex) {
  // groups of 4, e.g. "ABCD 1234 ..."
  return fprHex.replace(/(.{4})/g, '$1 ').trim();
}
function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

/* ---------- CRC24 (OpenPGP) ---------- */
function crc24(data) {
  let crc = 0xB704CE;
  for (const b of data) {
    crc ^= b << 16;
    for (let i = 0; i < 8; i++) {
      crc <<= 1;
      if (crc & 0x1000000) crc ^= 0x1864CFB;
    }
  }
  return crc & 0xFFFFFF;
}

/* ---------- armor ---------- */
function parseArmor(text) {
  const begin = '-----BEGIN PGP PUBLIC KEY BLOCK-----';
  const end = '-----END PGP PUBLIC KEY BLOCK-----';
  const bi = text.indexOf(begin), ei = text.indexOf(end);
  if (bi < 0 || ei < 0 || ei < bi) throw new Error('No PGP PUBLIC KEY BLOCK armor found.');
  const body = text.slice(bi + begin.length, ei);
  const lines = body.split(/\r?\n/);
  // skip armor headers (Key: Value) and blank line; capture the =CRC line
  let i = 0;
  while (i < lines.length && (/^\S+:\s/.test(lines[i]) || lines[i].trim() === '')) i++;
  let crcLine = null;
  const b64parts = [];
  for (const l of lines.slice(i)) {
    if (l.startsWith('=')) crcLine = l.slice(1);
    else b64parts.push(l);
  }
  const b64 = b64parts.join('');
  if (!b64) throw new Error('Armor body is empty.');
  let data;
  try { data = b64ToBytes(b64); }
  catch { throw new Error('Armor body is not valid base64.'); }
  if (data.length < 4) throw new Error('Key data too short.');
  let crcOk = false;
  if (crcLine) {
    try {
      const cb = b64ToBytes(crcLine);
      const stored = (cb[0] << 16) | (cb[1] << 8) | cb[2];
      crcOk = crc24(data) === stored;
    } catch { crcOk = false; }
  }
  return { data, crcOk };
}

/* ---------- packet framing ---------- */
function parsePackets(data) {
  const packets = [];
  let p = 0;
  while (p < data.length) {
    const b = data[p];
    if (!(b & 0x80)) throw new Error('Invalid packet header at offset ' + p);
    let tag, len, hdrLen;
    if (b & 0x40) {
      // new format
      tag = b & 0x3F; p++;
      const l1 = data[p++];
      if (l1 < 192) { len = l1; hdrLen = 2; }
      else if (l1 < 224) { len = ((l1 - 192) << 8) + data[p++] + 192; hdrLen = 3; }
      else if (l1 === 255) {
        len = (data[p] << 24) | (data[p + 1] << 16) | (data[p + 2] << 8) | data[p + 3];
        p += 4; hdrLen = 6;
      } else throw new Error('Partial body lengths not supported.');
    } else {
      // old format
      tag = (b >> 2) & 0x0F; p++;
      const lt = b & 0x03;
      if (lt === 0) { len = data[p++]; hdrLen = 2; }
      else if (lt === 1) { len = (data[p] << 8) | data[p + 1]; p += 2; hdrLen = 3; }
      else if (lt === 2) {
        len = (data[p] << 24) | (data[p + 1] << 16) | (data[p + 2] << 8) | data[p + 3];
        p += 4; hdrLen = 5;
      } else throw new Error('Indeterminate length not supported.');
    }
    packets.push({ tag, body: data.slice(p, p + len), hdrLen });
    p += len;
  }
  return packets;
}

/* ---------- MPI ---------- */
function readMPI(body, off) {
  const bits = (body[off] << 8) | body[off + 1];
  const n = Math.ceil(bits / 8);
  return { bits, bytes: body.slice(off + 2, off + 2 + n), next: off + 2 + n };
}

/* ---------- name tables ---------- */
const PUB_ALGOS = { 1: 'RSA', 2: 'RSA-E', 3: 'RSA-S', 16: 'Elgamal', 17: 'DSA', 18: 'ECDH', 19: 'ECDSA', 21: 'DH', 22: 'EdDSA', 23: 'ECDH' };
const SIG_TYPES = {
  0x00: 'Binary document', 0x01: 'Canonical text', 0x02: 'Standalone',
  0x10: 'Generic certification', 0x11: 'Persona certification', 0x12: 'Casual certification',
  0x13: 'Positive certification', 0x18: 'Subkey binding', 0x19: 'Primary key binding',
  0x1F: 'Direct key signature', 0x20: 'Key revocation', 0x28: 'Subkey revocation', 0x30: 'Cert revocation',
};
const HASH_ALGOS = { 1: 'MD5', 2: 'SHA-1', 3: 'RIPEMD-160', 8: 'SHA-256', 9: 'SHA-384', 10: 'SHA-512', 11: 'SHA-224', 12: 'SHA3-256', 14: 'SHA3-512' };

/* ---------- signature subpackets ---------- */
function parseSubpackets(area) {
  const subs = [];
  let p = 0;
  while (p < area.length) {
    let slen;
    const s1 = area[p++];
    if (s1 < 192) slen = s1;
    else if (s1 < 255) slen = ((s1 - 192) << 8) + area[p++] + 192;
    else { slen = (area[p] << 24) | (area[p + 1] << 16) | (area[p + 2] << 8) | area[p + 3]; p += 4; }
    const type = area[p] & 0x7F;
    const val = area.slice(p + 1, p + slen);
    subs.push({ type, val });
    p += slen;
  }
  return subs;
}
function u32(b, o) { return (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]; }

/* ---------- key material ---------- */
async function v4Fingerprint(body) {
  // fingerprint = SHA1( 0x99 || uint16(len) || body )
  const prefix = new Uint8Array([0x99, (body.length >> 8) & 0xFF, body.length & 0xFF]);
  const buf = new Uint8Array(prefix.length + body.length);
  buf.set(prefix); buf.set(body, prefix.length);
  const d = await crypto.subtle.digest('SHA-1', buf);
  return hex(new Uint8Array(d));
}

function describeKeyPacket(body) {
  const ver = body[0];
  if (ver !== 4) return { ver, unsupported: true };
  const created = u32(body, 1);
  const algoId = body[5];
  const algo = PUB_ALGOS[algoId] || ('Unknown (' + algoId + ')');
  // first MPI gives key size for RSA/DSA/ElGamal
  let sizeBits = null;
  try {
    let off = 6;
    if (algoId === 19 || algoId === 22 || algoId === 18 || algoId === 23) {
      // EC: curve OID then MPI — report curve size via OID length is unreliable; skip
      sizeBits = null;
    } else {
      const mpi = readMPI(body, off);
      sizeBits = mpi.bits;
    }
  } catch { /* keep null */ }
  return { ver, created, algoId, algo, sizeBits };
}

function describeSigPacket(body) {
  // v4 layout: ver(1) sigtype(1) pkalgo(1) hashalgo(1) hashedlen(2) ...
  if (body[0] !== 4) return { typeName: 'v' + body[0] + ' signature' };
  const typeName = SIG_TYPES[body[1]] || ('Type 0x' + body[1].toString(16));
  const hashAlgo = HASH_ALGOS[body[3]] || ('Hash ' + body[3]);
  const hashedLen = (body[4] << 8) | body[5];
  const subs = parseSubpackets(body.slice(6, 6 + hashedLen));
  let created = null, expiresIn = null, issuer = null;
  for (const s of subs) {
    if (s.type === 2 && s.val.length >= 4) created = u32(s.val, 0);
    if (s.type === 9 && s.val.length >= 4) expiresIn = u32(s.val, 0);
    if (s.type === 16 && s.val.length >= 8) issuer = hex(s.val).slice(-16);
  }
  return { typeName, hashAlgo, created, expiresIn, issuer };
}

/* ---------- main analysis ---------- */
async function analyze(text) {
  const { data, crcOk } = parseArmor(text);
  const packets = parsePackets(data);
  const report = { crcOk, primary: null, uids: [], subkeys: [], sigs: [] };
  let primaryCreated = null;

  for (const pkt of packets) {
    if (pkt.tag === 6) {                       // Public-Key
      const k = describeKeyPacket(pkt.body);
      if (k.unsupported) { report.primary = { ver: k.ver, unsupported: true }; continue; }
      const fpr = await v4Fingerprint(pkt.body);
      primaryCreated = k.created;
      report.primary = { ...k, fpr, keyId: fpr.slice(-16) };
    } else if (pkt.tag === 14) {               // Public-Subkey
      const k = describeKeyPacket(pkt.body);
      if (!k.unsupported) {
        const fpr = await v4Fingerprint(pkt.body);
        report.subkeys.push({ ...k, fpr, keyId: fpr.slice(-16) });
      }
    } else if (pkt.tag === 13) {               // User ID
      report.uids.push(td.decode(pkt.body));
    } else if (pkt.tag === 2) {                // Signature
      report.sigs.push(describeSigPacket(pkt.body));
    }
  }
  if (!report.primary) throw new Error('No public-key packet found in this block.');

  // expiry: first key-expiration subpacket on a self-cert (types 0x10–0x13, 0x1F)
  let expiresAt = null;
  for (const s of report.sigs) {
    if (s.expiresIn && s.created) { expiresAt = s.created + s.expiresIn; break; }
  }
  report.primary.expiresAt = expiresAt;
  return report;
}

/* ---------- UI ---------- */
function showError(msg) {
  const e = $('error');
  e.textContent = msg;
  e.classList.remove('hidden');
  $('results').classList.add('hidden');
}

let lastReport = null;

$('analyze').addEventListener('click', async () => {
  const text = $('armor').value.trim();
  if (!text) return showError('Paste an armored PGP public key block first.');
  $('error').classList.add('hidden');
  try {
    const r = await analyze(text);
    lastReport = r;
    render(r);
    chrome.storage.local.set({ keyinspectDraft: text }).catch(() => {});
  } catch (err) {
    showError(err.message || 'Could not parse this key.');
  }
});

$('clear').addEventListener('click', () => {
  $('armor').value = '';
  $('results').classList.add('hidden');
  $('error').classList.add('hidden');
  chrome.storage.local.remove('keyinspectDraft').catch(() => {});
});

function render(r) {
  const crc = $('crcCard');
  $('crcState').textContent = r.crcOk ? 'VALID' : 'MISMATCH';
  crc.classList.toggle('ok', r.crcOk);
  crc.classList.toggle('bad', !r.crcOk);

  const p = r.primary;
  $('fpr').textContent = fmtFpr(p.fpr);
  $('keyid').textContent = p.keyId.replace(/(.{4})/g, '$1 ').trim();
  $('algo').textContent = p.algo;
  $('ksize').textContent = p.sizeBits ? p.sizeBits + ' bits' : 'n/a (elliptic curve)';
  $('created').textContent = fmtDate(p.created);
  $('expires').textContent = p.expiresAt ? fmtDate(p.expiresAt) : 'no expiry found';
  $('ver').textContent = 'OpenPGP v' + p.ver;

  $('uidCount').textContent = r.uids.length;
  $('uids').innerHTML = r.uids.length
    ? r.uids.map((u) => `<li>${escapeHtml(u)}</li>`).join('')
    : '<li class="t">No user ID packets.</li>';

  $('subCount').textContent = r.subkeys.length;
  $('subs').innerHTML = r.subkeys.length
    ? r.subkeys.map((s) => `<li><span class="t">${escapeHtml(s.algo)}${s.sizeBits ? ' · ' + s.sizeBits + ' bits' : ''} · created ${fmtDate(s.created)}</span><br><span class="mono">${s.keyId}</span></li>`).join('')
    : '<li class="t">No subkeys.</li>';

  $('sigCount').textContent = r.sigs.length;
  $('sigs').innerHTML = r.sigs.length
    ? r.sigs.map((s) => `<li><span class="t">${escapeHtml(s.typeName)}${s.hashAlgo ? ' · ' + escapeHtml(s.hashAlgo) : ''}${s.created ? ' · ' + fmtDate(s.created) : ''}</span>${s.issuer ? `<br><span class="mono">issuer ${s.issuer}</span>` : ''}</li>`).join('')
    : '<li class="t">No signature packets.</li>';

  $('results').classList.remove('hidden');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

$('copyFpr').addEventListener('click', async () => {
  if (!lastReport) return;
  await navigator.clipboard.writeText(lastReport.primary.fpr).catch(() => {});
});
$('copyJson').addEventListener('click', async () => {
  if (!lastReport) return;
  await navigator.clipboard.writeText(JSON.stringify(lastReport, null, 2)).catch(() => {});
});

// restore draft
chrome.storage.local.get('keyinspectDraft').then((v) => {
  if (v.keyinspectDraft) $('armor').value = v.keyinspectDraft;
}).catch(() => {});
