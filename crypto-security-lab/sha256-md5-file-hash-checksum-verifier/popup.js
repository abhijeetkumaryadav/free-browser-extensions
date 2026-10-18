'use strict';
/* HashCheck popup logic.
 * - SHA-256 / SHA-512 / SHA-1 via the WebCrypto API (incremental not needed: we
 *   read the file in chunks for progress, then hash the full bytes at the end;
 *   memory is bounded by the file size — acceptable for a checksum tool).
 * - MD5 is implemented locally (public-domain style algorithm, written here)
 *   because WebCrypto deliberately does not offer MD5. It is exposed ONLY for
 *   legacy checksum comparison, never for security purposes.
 * Everything is 100% local: no network, no storage of file contents. */

const $ = (id) => document.getElementById(id);
const CHUNK = 4 * 1024 * 1024; // 4 MiB read chunks (progress only)

let file = null;
let digests = {}; // { label: hex }

/* ---------------- compact MD5 (RFC 1321) ---------------- */
function md5(bytes) {
  const r = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
             5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
             4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
             6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const K = []; for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;

  const origLen = bytes.length;
  const bitLen = origLen * 8;
  const withPad = (((origLen + 8) >>> 6) + 1) * 64;
  const msg = new Uint8Array(withPad);
  msg.set(bytes); msg[origLen] = 0x80;
  const dv = new DataView(msg.buffer);
  dv.setUint32(withPad - 8, bitLen >>> 0, true);
  dv.setUint32(withPad - 4, Math.floor(bitLen / 4294967296) >>> 0, true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);
  for (let off = 0; off < withPad; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16)      { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D;          g = (3 * i + 5) % 16; }
      else             { F = C ^ (B | ~D);       g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << r[i]) | (F >>> (32 - r[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const out = new DataView(new ArrayBuffer(16));
  out.setUint32(0, a0, true); out.setUint32(4, b0, true);
  out.setUint32(8, c0, true); out.setUint32(12, d0, true);
  return [...new Uint8Array(out.buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------------- helpers ---------------- */
const hexOf = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const fmtBytes = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB'
  : n < 1073741824 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1073741824).toFixed(2) + ' GB';

async function readChunks(f, onProgress) {
  const parts = [];
  let done = 0;
  for (let off = 0; off < f.size; off += CHUNK) {
    parts.push(new Uint8Array(await f.slice(off, off + CHUNK).arrayBuffer()));
    done += Math.min(CHUNK, f.size - off);
    onProgress(done / f.size);
  }
  const all = new Uint8Array(f.size);
  let p = 0; for (const c of parts) { all.set(c, p); p += c.length; }
  return all;
}

function renderDigests() {
  const box = $('hashList'); box.innerHTML = '';
  for (const [label, hex] of Object.entries(digests)) {
    const row = document.createElement('div');
    row.className = 'hash-row';
    row.innerHTML = `<div class="hash-head"><span class="name">${label}</span><button class="copy">Copy</button></div>
                     <div class="hash-val">${hex}</div>`;
    row.querySelector('.copy').onclick = async (e) => {
      try { await navigator.clipboard.writeText(hex); }
      catch { const t = document.createElement('textarea'); t.value = hex; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
      e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy', 1200);
    };
    box.appendChild(row);
  }
  $('results').classList.toggle('hidden', Object.keys(digests).length === 0);
  checkVerdict();
}

function checkVerdict() {
  const v = $('verdict');
  const exp = $('expected').value.trim().toLowerCase().replace(/\s+/g, '');
  if (!exp) { v.className = 'verdict muted'; v.textContent = 'Run a hash, then paste the expected value.'; return; }
  if (!/^[0-9a-f]+$/.test(exp)) { v.className = 'verdict bad'; v.textContent = 'Expected value is not valid hex.'; return; }
  const hit = Object.entries(digests).find(([, h]) => h.toLowerCase() === exp);
  if (hit) { v.className = 'verdict ok'; v.textContent = '✓ Match — ' + hit[0] + ' identical.'; }
  else { v.className = 'verdict bad'; v.textContent = '✗ No match against computed digests.'; }
}

/* ---------------- wiring ---------------- */
const drop = $('drop'), input = $('fileInput');

drop.onclick = () => input.click();
['dragover', 'dragenter'].forEach(e => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(e => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (ev) => {
  if (ev.dataTransfer.files.length) setFile(ev.dataTransfer.files[0]);
});
input.onchange = () => { if (input.files.length) setFile(input.files[0]); };

function setFile(f) {
  file = f; digests = {};
  $('fileName').textContent = f.name;
  $('fileSize').textContent = fmtBytes(f.size);
  $('progressText').textContent = ''; $('bar').style.width = '0';
  $('compute').disabled = false;
  $('results').classList.add('hidden');
  checkVerdict();
}

$('compute').onclick = async () => {
  if (!file) return;
  $('compute').disabled = true;
  digests = {};
  try {
    const bytes = await readChunks(file, (p) => {
      $('bar').style.width = Math.round(p * 100) + '%';
      $('progressText').textContent = Math.round(p * 100) + '%';
    });
    const jobs = [];
    if ($('a256').checked) jobs.push(crypto.subtle.digest('SHA-256', bytes).then(b => digests['SHA-256'] = hexOf(b)));
    if ($('a512').checked) jobs.push(crypto.subtle.digest('SHA-512', bytes).then(b => digests['SHA-512'] = hexOf(b)));
    if ($('a1').checked)   jobs.push(crypto.subtle.digest('SHA-1', bytes).then(b => digests['SHA-1'] = hexOf(b)));
    if ($('aMD5').checked) jobs.push(Promise.resolve().then(() => digests['MD5 (legacy)'] = md5(bytes)));
    await Promise.all(jobs);
    renderDigests();
    $('progressText').textContent = 'done';
  } catch (err) {
    $('progressText').textContent = 'error: ' + err.message;
  } finally {
    $('compute').disabled = false;
  }
};

$('expected').addEventListener('input', checkVerdict);
