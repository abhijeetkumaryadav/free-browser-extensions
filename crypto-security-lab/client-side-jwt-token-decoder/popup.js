/* JwtLens — client-side JWT decoder.
 * Decodes header + payload (base64url), shows claims with expiry countdown.
 * SCOPE: decode ONLY. Signatures are never verified and no secret is ever
 * handled. 100% local — no network. */

'use strict';

const $ = (id) => document.getElementById(id);

/* ---------- base64url ---------- */
function b64urlDecode(part) {
  let s = part.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad === 1) throw new Error('Bad base64url length.');
  if (pad) s += '='.repeat(4 - pad);
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/* ---------- JWT decode ---------- */
function decodeJwt(token) {
  const t = token.trim();
  if (!t) throw new Error('Paste a JWT first.');
  const parts = t.split('.');
  if (parts.length !== 3) throw new Error('A JWT has exactly 3 dot-separated parts.');
  if (parts.some((p) => !p)) throw new Error('One of the JWT parts is empty.');
  let header, payload;
  try { header = JSON.parse(b64urlDecode(parts[0])); }
  catch { throw new Error('Header is not valid base64url JSON.'); }
  try { payload = JSON.parse(b64urlDecode(parts[1])); }
  catch { throw new Error('Payload is not valid base64url JSON.'); }
  if (typeof header !== 'object' || header === null) throw new Error('Header must be a JSON object.');
  if (typeof payload !== 'object' || payload === null) throw new Error('Payload must be a JSON object.');
  return { header, payload, signature: parts[2] };
}

/* ---------- time helpers ---------- */
function fmtTs(ts) {
  if (typeof ts !== 'number' || !isFinite(ts)) return '—';
  const d = new Date(ts * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}
function fmtDur(sec) {
  const neg = sec < 0;
  sec = Math.abs(Math.floor(sec));
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (d) parts.push(d + 'd');
  if (h) parts.push(h + 'h');
  if (m || !parts.length) parts.push(m + 'm');
  return (neg ? '−' : '') + parts.join(' ');
}
function tokenStatus(payload) {
  const now = Math.floor(Date.now() / 1000);
  const out = { cls: 'st-ok', text: 'No exp claim — lifetime unknown' };
  if (typeof payload.nbf === 'number' && now < payload.nbf) {
    out.cls = 'st-warn';
    out.text = 'Not valid yet — active in ' + fmtDur(payload.nbf - now);
    return out;
  }
  if (typeof payload.exp === 'number') {
    const delta = payload.exp - now;
    if (delta <= 0) { out.cls = 'st-bad'; out.text = 'EXPIRED ' + fmtDur(delta) + ' ago'; }
    else {
      out.cls = delta < 300 ? 'st-warn' : 'st-ok';
      out.text = 'Valid — expires in ' + fmtDur(delta);
    }
  }
  return out;
}

/* ---------- tiny JSON syntax highlighter ---------- */
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function highlightJson(obj) {
  let json = escapeHtml(JSON.stringify(obj, null, 2));
  return json.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (m, str, colon, bool, num) => {
      if (str) return colon
        ? `<span class="tok-k">${str}</span><span class="tok-p">:</span>`
        : `<span class="tok-s">${str}</span>`;
      if (bool) return `<span class="tok-b">${bool}</span>`;
      if (num) return `<span class="tok-n">${num}</span>`;
      return m;
    });
}

/* ---------- UI ---------- */
let last = null;

function showError(msg) {
  const e = $('error');
  e.textContent = msg;
  e.classList.remove('hidden');
  $('results').classList.add('hidden');
}

function render(d) {
  const now = Math.floor(Date.now() / 1000);
  $('iat').textContent = fmtTs(d.payload.iat);
  $('exp').textContent = fmtTs(d.payload.exp);
  $('nbf').textContent = fmtTs(d.payload.nbf);
  const st = tokenStatus(d.payload);
  const stEl = $('status');
  stEl.textContent = st.text;
  stEl.className = st.cls;

  const alg = d.header.alg || '—';
  $('alg').textContent = alg;
  const sigEl = $('sigstate');
  if (alg === 'none') {
    sigEl.textContent = 'UNSIGNED (alg=none)';
    sigEl.className = 'st-bad';
  } else if (d.signature) {
    sigEl.textContent = 'Present (' + d.signature.length + ' chars) — NOT verified';
    sigEl.className = 'st-warn';
  } else {
    sigEl.textContent = 'Missing';
    sigEl.className = 'st-bad';
  }

  $('headerPre').innerHTML = highlightJson(d.header);
  $('payloadPre').innerHTML = highlightJson(d.payload);
  $('results').classList.remove('hidden');
}

$('decode').addEventListener('click', () => {
  $('error').classList.add('hidden');
  try {
    const d = decodeJwt($('token').value);
    last = d;
    render(d);
    chrome.storage.local.set({ jwtlensDraft: $('token').value.trim() }).catch(() => {});
  } catch (err) {
    last = null;
    showError(err.message || 'Could not decode this token.');
  }
});

$('clear').addEventListener('click', () => {
  $('token').value = '';
  $('results').classList.add('hidden');
  $('error').classList.add('hidden');
  last = null;
  chrome.storage.local.remove('jwtlensDraft').catch(() => {});
});

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); }
  catch { /* clipboard unavailable — leave silently */ }
}
$('copyH').addEventListener('click', () => { if (last) copyText(JSON.stringify(last.header, null, 2)); });
$('copyP').addEventListener('click', () => { if (last) copyText(JSON.stringify(last.payload, null, 2)); });

// restore draft (token text only, never decoded automatically)
chrome.storage.local.get('jwtlensDraft').then((v) => {
  if (v.jwtlensDraft) $('token').value = v.jwtlensDraft;
}).catch(() => {});
