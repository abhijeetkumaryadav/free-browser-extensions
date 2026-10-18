/* NetCheck — popup logic.
 * Pure local IP parsing, validation and classification.
 * No network, no scanning, no probing of any kind. */

'use strict';

/* ------------------------------------------------------------------ */
/* IPv4 parsing                                                        */
/* ------------------------------------------------------------------ */

/**
 * Parse an IPv4 address string into 4 octets.
 * @returns {number[]|null} octets, or null if invalid.
 */
function parseIPv4(s) {
  const parts = s.split('.');
  if (parts.length !== 4) return null;
  const octets = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = parseInt(p, 10);
    if (n < 0 || n > 255) return null;
    octets.push(n);
  }
  return octets;
}

/* ------------------------------------------------------------------ */
/* IPv6 parsing                                                        */
/* ------------------------------------------------------------------ */

/**
 * Parse an IPv6 address string into 8 hextets.
 * Supports "::" compression and embedded IPv4 (e.g. ::ffff:1.2.3.4).
 * @returns {number[]|null} 8 hextets, or null if invalid.
 */
function parseIPv6(s) {
  if (typeof s !== 'string' || s.length === 0 || s.length > 45) return null;

  // Handle embedded IPv4 tail: convert "…:1.2.3.4" into two hextets.
  let addr = s;
  const v4tail = s.match(/^(.*):(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4tail) {
    const octets = parseIPv4(v4tail[2]);
    if (!octets) return null;
    const hi = (octets[0] << 8) | octets[1];
    const lo = (octets[2] << 8) | octets[3];
    addr = v4tail[1] + ':' + hi.toString(16) + ':' + lo.toString(16);
  }

  // At most one "::".
  const doubles = addr.split('::');
  if (doubles.length > 2) return null;

  const parseSide = (side) => {
    if (side === '') return [];
    const groups = side.split(':');
    const out = [];
    for (const g of groups) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };

  let left, right;
  if (doubles.length === 2) {
    left = parseSide(doubles[0]);
    right = parseSide(doubles[1]);
    if (left === null || right === null) return null;
    const missing = 8 - left.length - right.length;
    if (missing < 1) return null; // "::" must compress at least one group
    return [...left, ...new Array(missing).fill(0), ...right];
  }

  const groups = parseSide(addr);
  if (groups === null || groups.length !== 8) return null;
  return groups;
}

/* ------------------------------------------------------------------ */
/* Classification                                                      */
/* ------------------------------------------------------------------ */

/** Check whether the first `bits` of a bit-array fall inside a prefix. */
function inPrefix(bitsArr, prefixBits, prefixLen) {
  for (let i = 0; i < prefixLen; i++) {
    if (bitsArr[i] !== prefixBits[i]) return false;
  }
  return true;
}

function v4Bits(octets) {
  const bits = [];
  for (const o of octets) {
    for (let i = 7; i >= 0; i--) bits.push((o >> i) & 1);
  }
  return bits;
}

function v6Bits(hextets) {
  const bits = [];
  for (const h of hextets) {
    for (let i = 15; i >= 0; i--) bits.push((h >> i) & 1);
  }
  return bits;
}

/* [prefixOctets, prefixLen, key, label, description] */
const V4_RANGES = [
  [[0, 0, 0, 0], 8, 'special', 'Unspecified', '"This host on this network" — not routable.'],
  [[10, 0, 0, 0], 8, 'private', 'Private (RFC 1918)', 'Private LAN address, not routable on the public internet.'],
  [[172, 16, 0, 0], 12, 'private', 'Private (RFC 1918)', 'Private LAN address, not routable on the public internet.'],
  [[192, 168, 0, 0], 16, 'private', 'Private (RFC 1918)', 'Private LAN address, not routable on the public internet.'],
  [[127, 0, 0, 0], 8, 'loopback', 'Loopback', 'Refers to the local machine itself.'],
  [[169, 254, 0, 0], 16, 'linklocal', 'Link-local (APIPA)', 'Auto-assigned when no DHCP server is found. Link-only.'],
  [[100, 64, 0, 0], 10, 'reserved', 'Shared address space (CGNAT)', 'Carrier-grade NAT space shared by an ISP. Not public.'],
  [[192, 0, 2, 0], 24, 'reserved', 'Documentation (TEST-NET-1)', 'Reserved for documentation and examples.'],
  [[198, 51, 100, 0], 24, 'reserved', 'Documentation (TEST-NET-2)', 'Reserved for documentation and examples.'],
  [[203, 0, 113, 0], 24, 'reserved', 'Documentation (TEST-NET-3)', 'Reserved for documentation and examples.'],
  [[224, 0, 0, 0], 4, 'multicast', 'Multicast', 'One-to-many delivery; not a host address.'],
  [[240, 0, 0, 0], 4, 'reserved', 'Reserved (Class E)', 'Reserved for future use; not assignable to hosts.'],
];

const V6_RANGES = [
  [[0, 0, 0, 0, 0, 0, 0, 0], 128, 'special', 'Unspecified', '"This host" placeholder — not routable.'],
  [[0, 0, 0, 0, 0, 0, 0, 1], 128, 'loopback', 'Loopback', 'Refers to the local machine itself.'],
  [[0xff00, 0, 0, 0, 0, 0, 0, 0], 8, 'multicast', 'Multicast', 'One-to-many delivery; not a host address.'],
  [[0xfe80, 0, 0, 0, 0, 0, 0, 0], 10, 'linklocal', 'Link-local', 'Valid only on the local network segment.'],
  [[0xfc00, 0, 0, 0, 0, 0, 0, 0], 7, 'private', 'Unique local', 'Private address, not routable on the public internet.'],
  [[0x2001, 0x0db8, 0, 0, 0, 0, 0, 0], 32, 'reserved', 'Documentation', 'Reserved for documentation and examples.'],
];

function classifyV4(octets) {
  const bits = v4Bits(octets);
  for (const [pfx, len, key, label, desc] of V4_RANGES) {
    if (inPrefix(bits, v4Bits(pfx), len)) return { key, label, desc };
  }
  return { key: 'public', label: 'Public (global unicast)', desc: 'Routable on the public internet.' };
}

function classifyV6(hextets) {
  const bits = v6Bits(hextets);
  for (const [pfx, len, key, label, desc] of V6_RANGES) {
    if (inPrefix(bits, v6Bits(pfx), len)) return { key, label, desc };
  }
  return { key: 'public', label: 'Public (global unicast)', desc: 'Routable on the public internet.' };
}

/* ------------------------------------------------------------------ */
/* Details                                                             */
/* ------------------------------------------------------------------ */

function v4ToInt(o) {
  return ((o[0] * 256 + o[1]) * 256 + o[2]) * 256 + o[3];
}

function v4ToBin(o) {
  return o.map((x) => x.toString(2).padStart(8, '0')).join('.');
}

function v4Reverse(o) {
  return [...o].reverse().join('.') + '.in-addr.arpa';
}

function v4Class(o) {
  const f = o[0];
  if (f < 128) return 'A';
  if (f < 192) return 'B';
  if (f < 224) return 'C';
  if (f < 240) return 'D (multicast)';
  return 'E (reserved)';
}

/** Expand hextets to full 8-group form. */
function v6Expand(h) {
  return h.map((x) => x.toString(16).padStart(4, '0')).join(':');
}

/** Compress per RFC 5952: longest run of zeros -> "::". */
function v6Compress(h) {
  // Find longest zero run (length >= 2 to compress, single 0 stays).
  let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
  for (let i = 0; i <= 8; i++) {
    if (i < 8 && h[i] === 0) {
      if (curStart === -1) { curStart = i; curLen = 1; }
      else curLen++;
    } else {
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
      curStart = -1; curLen = 0;
    }
  }
  const parts = h.map((x) => x.toString(16));
  if (bestLen < 2) return parts.join(':');
  const left = parts.slice(0, bestStart).join(':');
  const right = parts.slice(bestStart + bestLen).join(':');
  if (left === '' && right === '') return '::';
  if (left === '') return '::' + right;
  if (right === '') return left + '::';
  return left + '::' + right;
}

function v6Reverse(h) {
  const nibbles = v6Expand(h).replace(/:/g, '').split('').reverse();
  return nibbles.join('.') + '.ip6.arpa';
}

/** Apply a CIDR prefix: returns network address groups + host counts. */
function cidrInfo(groups, bitsPerGroup, totalBits, prefix) {
  const totalAddrs = 2n ** BigInt(totalBits - prefix);
  const groupsPerFull = totalBits / bitsPerGroup;
  const fullGroups = Math.floor(prefix / bitsPerGroup);
  const remBits = prefix % bitsPerGroup;
  const net = groups.slice();
  if (remBits > 0 && fullGroups < groupsPerFull) {
    const mask = ((1 << bitsPerGroup) - 1) ^ ((1 << (bitsPerGroup - remBits)) - 1);
    net[fullGroups] = groups[fullGroups] & mask;
    for (let i = fullGroups + 1; i < groupsPerFull; i++) net[i] = 0;
  } else {
    for (let i = fullGroups; i < groupsPerFull; i++) net[i] = 0;
  }
  return { net, totalAddrs };
}

function fmtBig(n) {
  return n.toLocaleString('en-US');
}

/* ------------------------------------------------------------------ */
/* Top-level analysis                                                  */
/* ------------------------------------------------------------------ */

/**
 * Analyse an input string like "192.168.1.1", "10.0.0.0/8" or "fe80::1/10".
 * @returns {{ok:true, ...}|{ok:false, error:string}}
 */
function analyze(raw) {
  const input = raw.trim();
  if (!input) return { ok: false, error: 'Type an IP address to check it.' };

  let addr = input;
  let prefix = null;
  const slash = input.lastIndexOf('/');
  // A "/" only denotes CIDR when it appears once and after any ":".
  if (slash !== -1 && input.indexOf('/') === slash) {
    addr = input.slice(0, slash).trim();
    const pStr = input.slice(slash + 1).trim();
    if (!/^\d{1,3}$/.test(pStr)) {
      return { ok: false, error: `"${input}" is not a valid IP address or CIDR notation.` };
    }
    prefix = parseInt(pStr, 10);
  }

  let octets = parseIPv4(addr);
  if (octets) {
    if (prefix !== null && (prefix < 0 || prefix > 32)) {
      return { ok: false, error: `IPv4 prefix must be between 0 and 32 (got /${prefix}).` };
    }
    const cls = classifyV4(octets);
    const details = [
      ['Integer value', String(v4ToInt(octets))],
      ['Binary', v4ToBin(octets)],
      ['Hex', '0x' + octets.map((o) => o.toString(16).padStart(2, '0')).join('')],
      ['Class (legacy)', v4Class(octets)],
      ['Reverse DNS', v4Reverse(octets)],
    ];
    if (prefix !== null) {
      const { net, totalAddrs } = cidrInfo(octets, 8, 32, prefix);
      details.push(['Network', net.join('.') + '/' + prefix]);
      details.push(['Total addresses', fmtBig(totalAddrs)]);
      if (prefix <= 30) details.push(['Usable hosts', fmtBig(totalAddrs - 2n)]);
    }
    return { ok: true, version: 'IPv4', classInfo: cls, details };
  }

  const hextets = parseIPv6(addr);
  if (hextets) {
    if (prefix !== null && (prefix < 0 || prefix > 128)) {
      return { ok: false, error: `IPv6 prefix must be between 0 and 128 (got /${prefix}).` };
    }
    const cls = classifyV6(hextets);
    const details = [
      ['Expanded', v6Expand(hextets)],
      ['Compressed', v6Compress(hextets)],
      ['Reverse DNS', v6Reverse(hextets)],
    ];
    if (prefix !== null) {
      const { net, totalAddrs } = cidrInfo(hextets, 16, 128, prefix);
      details.push(['Network', v6Compress(net) + '/' + prefix]);
      details.push(['Total addresses', fmtBig(totalAddrs)]);
    }
    return { ok: true, version: 'IPv6', classInfo: cls, details };
  }

  return { ok: false, error: `"${input}" is not a valid IPv4 or IPv6 address.` };
}

/* ------------------------------------------------------------------ */
/* UI wiring (browser only)                                            */
/* ------------------------------------------------------------------ */

if (typeof document !== 'undefined') {
  const $ = (id) => document.getElementById(id);

  function render(result, rawInput) {
    const resultPanel = $('resultPanel');
    const errorPanel = $('errorPanel');

    if (!result.ok) {
      resultPanel.hidden = true;
      errorPanel.hidden = false;
      $('errorText').textContent = result.error;
      return;
    }

    errorPanel.hidden = true;
    resultPanel.hidden = false;

    const verdict = $('verdict');
    verdict.textContent = 'Valid';
    verdict.className = 'verdict valid';

    $('versionTag').textContent = result.version;

    const cv = $('classValue');
    cv.textContent = result.classInfo.label;
    cv.className = 'class-value c-' + result.classInfo.key;
    $('classDesc').textContent = result.classInfo.desc;

    const dl = $('detailsList');
    dl.innerHTML = '';
    for (const [term, def] of result.details) {
      const row = document.createElement('div');
      row.className = 'row';
      const dt = document.createElement('dt');
      dt.textContent = term;
      const dd = document.createElement('dd');
      dd.textContent = def;
      row.appendChild(dt);
      row.appendChild(dd);
      dl.appendChild(row);
    }
  }

  function run() {
    render(analyze($('ipInput').value), $('ipInput').value);
  }

  $('checkBtn').addEventListener('click', run);
  $('ipInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') run();
  });
  // Live validation while typing (debounced).
  let timer = null;
  $('ipInput').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if ($('ipInput').value.trim()) run();
    }, 350);
  });
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      $('ipInput').value = chip.dataset.ip;
      run();
      $('ipInput').focus();
    });
  });
}
