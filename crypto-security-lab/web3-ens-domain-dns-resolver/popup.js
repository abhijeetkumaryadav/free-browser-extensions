'use strict';
/* ENSResolve popup logic.
 * Resolves ENS names entirely with local cryptography + read-only JSON-RPC
 * calls to free public Ethereum gateways. No wallet, no keys, no signing.
 *
 * Resolution path:
 *   name --namehash--> node --registry.resolver(node)--> resolver
 *        --resolver.addr(node)--> address --reverse lookup--> primary name
 */

// ---------- keccak-256 (local implementation) ----------
function rotl64(lo, hi, n) {
  n %= 64;
  if (n === 0) return [lo >>> 0, hi >>> 0];
  if (n < 32) return [((lo << n) | (hi >>> (32 - n))) >>> 0, ((hi << n) | (lo >>> (32 - n))) >>> 0];
  n -= 32;
  if (n === 0) return [hi >>> 0, lo >>> 0];
  return [((hi << n) | (lo >>> (32 - n))) >>> 0, ((lo << n) | (hi >>> (32 - n))) >>> 0];
}

const KECCAK_RC = [ // [lo, hi] pairs — high halves are NOT all zero
  [0x00000001,0x00000000],[0x00008082,0x00000000],[0x0000808a,0x80000000],[0x80008000,0x80000000],
  [0x0000808b,0x00000000],[0x80000001,0x00000000],[0x80008081,0x80000000],[0x00008009,0x80000000],
  [0x0000008a,0x00000000],[0x00000088,0x00000000],[0x80008009,0x00000000],[0x8000000a,0x00000000],
  [0x8000808b,0x00000000],[0x0000008b,0x80000000],[0x00008089,0x80000000],[0x00008003,0x80000000],
  [0x00008002,0x80000000],[0x00000080,0x80000000],[0x0000800a,0x00000000],[0x8000000a,0x80000000],
  [0x80008081,0x80000000],[0x00008080,0x80000000],[0x80000001,0x00000000],[0x80008008,0x80000000]];
const KECCAK_ROTC = [0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];

function keccakF(st) { // st: 25 x [lo,hi]
  for (let round = 0; round < 24; round++) {
    const C = [];
    for (let x = 0; x < 5; x++) {
      let lo = 0, hi = 0;
      for (let y = 0; y < 5; y++) { lo ^= st[x + 5 * y][0]; hi ^= st[x + 5 * y][1]; }
      C[x] = [lo >>> 0, hi >>> 0];
    }
    const D = [];
    for (let x = 0; x < 5; x++) {
      const r = rotl64(C[(x + 1) % 5][0], C[(x + 1) % 5][1], 1);
      D[x] = [(C[(x + 4) % 5][0] ^ r[0]) >>> 0, (C[(x + 4) % 5][1] ^ r[1]) >>> 0];
    }
    for (let i = 0; i < 25; i++) {
      st[i][0] = (st[i][0] ^ D[i % 5][0]) >>> 0;
      st[i][1] = (st[i][1] ^ D[i % 5][1]) >>> 0;
    }
    const B = new Array(25);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      const idx = x + 5 * y;
      B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl64(st[idx][0], st[idx][1], KECCAK_ROTC[idx]);
    }
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      const idx = x + 5 * y;
      const b1 = B[((x + 1) % 5) + 5 * y], b2 = B[((x + 2) % 5) + 5 * y];
      st[idx][0] = (B[idx][0] ^ ((~b1[0] & b2[0]) >>> 0)) >>> 0;
      st[idx][1] = (B[idx][1] ^ ((~b1[1] & b2[1]) >>> 0)) >>> 0;
    }
    st[0][0] = (st[0][0] ^ KECCAK_RC[round][0]) >>> 0;
    st[0][1] = (st[0][1] ^ KECCAK_RC[round][1]) >>> 0;
  }
}

function keccak256(msg) {
  const st = Array.from({ length: 25 }, () => [0, 0]);
  const RATE = 136; // bytes (1088-bit rate for 256-bit output)
  const padded = new Uint8Array(Math.ceil((msg.length + 1) / RATE) * RATE);
  padded.set(msg);
  padded[msg.length] = 0x01;
  padded[padded.length - 1] ^= 0x80;
  for (let b = 0; b < padded.length; b += RATE) {
    for (let i = 0; i < RATE; i++) {
      const byte = padded[b + i];
      if (byte) {
        const lane = i >> 3, part = (i & 7) < 4 ? 0 : 1;
        st[lane][part] = (st[lane][part] ^ (byte << ((i & 3) * 8))) >>> 0;
      }
    }
    keccakF(st);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    const lane = i >> 3;
    out[i] = (st[lane][(i & 7) < 4 ? 0 : 1] >>> ((i & 3) * 8)) & 0xff;
  }
  return out;
}

// ---------- ENS namehash (EIP-137) ----------
const hexOf = (b) => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
function namehash(name) {
  let node = new Uint8Array(32); // zero
  if (name) {
    const labels = name.split('.');
    for (let i = labels.length - 1; i >= 0; i--) {
      const labelHash = keccak256(new TextEncoder().encode(labels[i]));
      const combined = new Uint8Array(64);
      combined.set(node); combined.set(labelHash, 32);
      node = keccak256(combined);
    }
  }
  return node;
}

// ---------- JSON-RPC ----------
const GATEWAYS = ['https://cloudflare-eth.com', 'https://ethereum.publicnode.com'];
const REGISTRY = '0x00000000000C2C1F563e9C55C6219bC85b0C4bF7'; // ENS registry (mainnet)
const SEL = { resolver: '0178b8bf', addr: '3b3b57de', name: '691f3431' };
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

async function ethCall(to, data) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] });
  let lastErr = new Error('no gateway responded');
  for (const gw of GATEWAYS) {
    try {
      const r = await fetch(gw, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
      if (!r.ok) throw new Error(gw + ' HTTP ' + r.status);
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || 'RPC error');
      if (typeof j.result !== 'string') throw new Error('bad RPC response');
      return j.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

const callData = (sel, nodeHex) => '0x' + sel + nodeHex;
const decodeAddress = (hex) => '0x' + hex.slice(-40);
function decodeString(hex) {
  const b = hex.startsWith('0x') ? hex.slice(2) : hex;
  const len = parseInt(b.slice(64, 128), 16);
  const data = b.slice(128, 128 + len * 2);
  return new TextDecoder().decode(new Uint8Array(data.match(/../g).map(h => parseInt(h, 16))));
}

async function resolveName(name) {
  const node = namehash(name);
  const nodeHex = hexOf(node);
  const resolverRaw = await ethCall(REGISTRY, callData(SEL.resolver, nodeHex));
  const resolver = decodeAddress(resolverRaw);
  if (resolver === ZERO_ADDR) throw new Error('Name is not registered (no resolver set).');
  const addrRaw = await ethCall(resolver, callData(SEL.addr, nodeHex));
  const address = decodeAddress(addrRaw);
  // reverse lookup for the primary name
  let primary = '—';
  try {
    const revNode = hexOf(namehash(address.slice(2).toLowerCase() + '.addr.reverse'));
    const revResolver = decodeAddress(await ethCall(REGISTRY, callData(SEL.resolver, revNode)));
    if (revResolver !== ZERO_ADDR) {
      const n = decodeString(await ethCall(revResolver, callData(SEL.name, revNode)));
      if (n) primary = n;
    }
  } catch { /* primary name is best-effort */ }
  return { nodeHex: '0x' + nodeHex, resolver, address, primary };
}

async function reverseLookup(address) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('Not a valid 0x address.');
  const revNode = hexOf(namehash(address.slice(2).toLowerCase() + '.addr.reverse'));
  const revResolver = decodeAddress(await ethCall(REGISTRY, callData(SEL.resolver, revNode)));
  if (revResolver === ZERO_ADDR) throw new Error('No reverse record set for this address.');
  const n = decodeString(await ethCall(revResolver, callData(SEL.name, revNode)));
  return { nodeHex: '0x' + revNode, resolver: revResolver, address, primary: n || '—' };
}

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const status = (msg, cls) => { const s = $('status'); s.textContent = msg; s.className = 'status ' + (cls || 'muted'); };

function show(res) {
  $('rNode').textContent = res.nodeHex;
  $('rResolver').textContent = res.resolver;
  $('rAddr').textContent = res.address;
  $('rPrimary').textContent = res.primary;
  $('results').classList.remove('hidden');
}

async function run(fn) {
  status('Resolving…', '');
  $('resolve').disabled = true; $('reverse').disabled = true;
  try {
    const res = await fn();
    show(res);
    status('Resolved on-chain ✓', 'ok');
    chrome.storage.local.set({ lastQuery: $('name').value || $('addrIn').value });
  } catch (e) {
    $('results').classList.add('hidden');
    status('Error: ' + e.message, 'err');
  } finally {
    $('resolve').disabled = false; $('reverse').disabled = false;
  }
}

$('resolve').onclick = () => {
  const name = $('name').value.trim().toLowerCase().replace(/\.$/, '');
  if (!name || !name.includes('.')) { status('Enter a full ENS name like vitalik.eth', 'err'); return; }
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(name)) { status('Name contains invalid characters.', 'err'); return; }
  run(() => resolveName(name));
};
$('reverse').onclick = () => {
  const a = $('addrIn').value.trim();
  run(() => reverseLookup(a));
};
$('copyAddr').onclick = async (e) => {
  const t = $('rAddr').textContent;
  try { await navigator.clipboard.writeText(t); }
  catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy address', 1200);
};
$('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('resolve').click(); });

// restore last query
chrome.storage.local.get('lastQuery', (d) => { if (d.lastQuery) $('name').value = d.lastQuery; });
