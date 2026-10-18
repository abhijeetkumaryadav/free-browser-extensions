/* SwatchPeek — detects color tokens in pasted text and renders inline swatch chips.
   100% local: no network, no page access. Draft is autosaved to chrome.storage.local. */
'use strict';

const $ = (id) => document.getElementById(id);
const srcEl = $('src'), outEl = $('output'), statsEl = $('stats');
const copyAllBtn = $('copyAllBtn'), clearBtn = $('clearBtn'), toastEl = $('toast');

/* ---------- Named CSS colors (full 148) ---------- */
const NAMED = {
  aliceblue:'#f0f8ff', antiquewhite:'#faebd7', aqua:'#00ffff', aquamarine:'#7fffd4',
  azure:'#f0ffff', beige:'#f5f5dc', bisque:'#ffe4c4', black:'#000000',
  blanchedalmond:'#ffebcd', blue:'#0000ff', blueviolet:'#8a2be2', brown:'#a52a2a',
  burlywood:'#deb887', cadetblue:'#5f9ea0', chartreuse:'#7fff00', chocolate:'#d2691e',
  coral:'#ff7f50', cornflowerblue:'#6495ed', cornsilk:'#fff8dc', crimson:'#dc143c',
  cyan:'#00ffff', darkblue:'#00008b', darkcyan:'#008b8b', darkgoldenrod:'#b8860b',
  darkgray:'#a9a9a9', darkgreen:'#006400', darkgrey:'#a9a9a9', darkkhaki:'#bdb76b',
  darkmagenta:'#8b008b', darkolivegreen:'#556b2f', darkorange:'#ff8c00', darkorchid:'#9932cc',
  darkred:'#8b0000', darksalmon:'#e9967a', darkseagreen:'#8fbc8f', darkslateblue:'#483d8b',
  darkslategray:'#2f4f4f', darkslategrey:'#2f4f4f', darkturquoise:'#00ced1', darkviolet:'#9400d3',
  deeppink:'#ff1493', deepskyblue:'#00bfff', dimgray:'#696969', dimgrey:'#696969',
  dodgerblue:'#1e90ff', firebrick:'#b22222', floralwhite:'#fffaf0', forestgreen:'#228b22',
  fuchsia:'#ff00ff', gainsboro:'#dcdcdc', ghostwhite:'#f8f8ff', gold:'#ffd700',
  goldenrod:'#daa520', gray:'#808080', green:'#008000', greenyellow:'#adff2f',
  grey:'#808080', honeydew:'#f0fff0', hotpink:'#ff69b4', indianred:'#cd5c5c',
  indigo:'#4b0082', ivory:'#fffff0', khaki:'#f0e68c', lavender:'#e6e6fa',
  lavenderblush:'#fff0f5', lawngreen:'#7cfc00', lemonchiffon:'#fffacd', lightblue:'#add8e6',
  lightcoral:'#f08080', lightcyan:'#e0ffff', lightgoldenrodyellow:'#fafad2', lightgray:'#d3d3d3',
  lightgreen:'#90ee90', lightgrey:'#d3d3d3', lightpink:'#ffb6c1', lightsalmon:'#ffa07a',
  lightseagreen:'#20b2aa', lightskyblue:'#87cefa', lightslategray:'#778899', lightslategrey:'#778899',
  lightsteelblue:'#b0c4de', lightyellow:'#ffffe0', lime:'#00ff00', limegreen:'#32cd32',
  linen:'#faf0e6', magenta:'#ff00ff', maroon:'#800000', mediumaquamarine:'#66cdaa',
  mediumblue:'#0000cd', mediumorchid:'#ba55d3', mediumpurple:'#9370db', mediumseagreen:'#3cb371',
  mediumslateblue:'#7b68ee', mediumspringgreen:'#00fa9a', mediumturquoise:'#48d1cc', mediumvioletred:'#c71585',
  midnightblue:'#191970', mintcream:'#f5fffa', mistyrose:'#ffe4e1', moccasin:'#ffe4b5',
  navajowhite:'#ffdead', navy:'#000080', oldlace:'#fdf5e6', olive:'#808000',
  olivedrab:'#6b8e23', orange:'#ffa500', orangered:'#ff4500', orchid:'#da70d6',
  palegoldenrod:'#eee8aa', palegreen:'#98fb98', paleturquoise:'#afeeee', palevioletred:'#db7093',
  papayawhip:'#ffefd5', peachpuff:'#ffdab9', peru:'#cd853f', pink:'#ffc0cb',
  plum:'#dda0dd', powderblue:'#b0e0e6', purple:'#800080', rebeccapurple:'#663399',
  red:'#ff0000', rosybrown:'#bc8f8f', royalblue:'#4169e1', saddlebrown:'#8b4513',
  salmon:'#fa8072', sandybrown:'#f4a460', seagreen:'#2e8b57', seashell:'#fff5ee',
  sienna:'#a0522d', silver:'#c0c0c0', skyblue:'#87ceeb', slateblue:'#6a5acd',
  slategray:'#708090', slategrey:'#708090', snow:'#fffafa', springgreen:'#00ff7f',
  steelblue:'#4682b4', tan:'#d2b48c', teal:'#008080', thistle:'#d8bfd8',
  tomato:'#ff6347', turquoise:'#40e0d0', violet:'#ee82ee', wheat:'#f5deb3',
  white:'#ffffff', whitesmoke:'#f5f5f5', yellow:'#ffff00', yellowgreen:'#9acd32'
};

/* ---------- Token detection ---------- */
const HEX_RE = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{3}\b/;
const FUNC_RE = /\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/;
const namedKeys = Object.keys(NAMED).sort((a, b) => b.length - a.length);
const NAMED_RE = new RegExp('\\b(?:' + namedKeys.join('|') + ')\\b', 'i');
const TOKEN_RE = new RegExp(HEX_RE.source + '|' + FUNC_RE.source + '|' + NAMED_RE.source, 'gi');

function findTokens(text) {
  const found = [];
  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    found.push({ start: m.index, end: m.index + m[0].length, token: m[0] });
    if (m.index === TOKEN_RE.lastIndex) TOKEN_RE.lastIndex++; // safety
  }
  return found;
}

/* ---------- Color parsing -> {r,g,b,a} ---------- */
function parseHex(t) {
  let h = t.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  if (h.length !== 6 && h.length !== 8) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  if (h.length === 6) return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  return { r: (n >> 24) & 255, g: (n >> 16) & 255, b: (n >> 8) & 255, a: ((n & 255) / 255) };
}

function numList(inner) {
  // supports "255, 0, 0", "255 0 0", "255, 0, 0, .5", "100%, 0%, 0%"
  return inner.trim().split(/[\s,\/]+/).filter(Boolean);
}

function parseFunc(t) {
  const m = t.match(/^(rgba?|hsla?)\((.*)\)$/i);
  if (!m) return null;
  const kind = m[1].toLowerCase(), parts = numList(m[2]);
  if (parts.length < 3) return null;
  const alpha = parts.length >= 4 ? parseAlpha(parts[3]) : 1;
  if (alpha === null) return null;
  if (kind === 'rgb' || kind === 'rgba') {
    const rgb = parts.slice(0, 3).map(parse255);
    if (rgb.some((v) => v === null)) return null;
    return { r: rgb[0], g: rgb[1], b: rgb[2], a: alpha };
  }
  // hsl / hsla
  const h = parseFloat(parts[0]); if (Number.isNaN(h)) return null;
  const s = parsePct(parts[1]), l = parsePct(parts[2]);
  if (s === null || l === null) return null;
  const [r, g, b] = hslToRgb(((h % 360) + 360) % 360, s, l);
  return { r, g, b, a: alpha };
}

function parse255(v) {
  if (v.endsWith('%')) { const n = parseFloat(v); return Number.isNaN(n) ? null : Math.round(n * 2.55); }
  const n = parseFloat(v); return Number.isNaN(n) ? null : Math.max(0, Math.min(255, Math.round(n)));
}
function parsePct(v) {
  if (!v.endsWith('%')) return null;
  const n = parseFloat(v); return Number.isNaN(n) ? null : Math.max(0, Math.min(100, n)) / 100;
}
function parseAlpha(v) {
  if (v.endsWith('%')) { const n = parseFloat(v); return Number.isNaN(n) ? null : n / 100; }
  const n = parseFloat(v); return Number.isNaN(n) ? null : n;
}
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function parseColor(token) {
  const t = token.trim();
  if (t.startsWith('#')) return parseHex(t);
  if (/^(rgba?|hsla?)\(/i.test(t)) return parseFunc(t);
  const hex = NAMED[t.toLowerCase()];
  return hex ? parseHex(hex) : null;
}

function toHex({ r, g, b, a }) {
  const h = (v) => v.toString(16).padStart(2, '0');
  let out = '#' + h(r) + h(g) + h(b);
  if (a < 1) out += h(Math.round(a * 255));
  return out;
}

/* ---------- Rendering ---------- */
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let lastHexes = [];

function render() {
  const text = srcEl.value;
  const tokens = findTokens(text);
  lastHexes = [];

  if (!tokens.length) {
    outEl.innerHTML = '<div class="empty">No color tokens detected yet — try <b>#ec4899</b>, <b>rgb(236,72,153)</b> or <b>rebeccapurple</b>.</div>';
    statsEl.innerHTML = '0 colors found';
    copyAllBtn.disabled = true;
    return;
  }

  let html = '', cursor = 0;
  tokens.forEach((tk, i) => {
    html += escapeHtml(text.slice(cursor, tk.start));
    const parsed = parseColor(tk.token);
    const hex = parsed ? toHex(parsed) : null;
    if (hex) lastHexes.push(hex);
    const bg = hex || tk.token; // fall back to raw token as CSS background
    html += '<span class="chip' + (parsed ? '' : ' invalid') + '" data-idx="' + i +
      '" title="Click to copy \'' + escapeHtml(tk.token) + '\'">' +
      '<span class="sw" style="background:' + escapeHtml(bg) + '"></span>' +
      escapeHtml(tk.token) + '</span>';
    cursor = tk.end;
  });
  html += escapeHtml(text.slice(cursor));
  outEl.innerHTML = html;

  statsEl.innerHTML = '<strong>' + tokens.length + '</strong> color' + (tokens.length === 1 ? '' : 's') + ' found';
  copyAllBtn.disabled = lastHexes.length === 0;

  outEl.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const token = tokens[Number(chip.dataset.idx)].token;
      copyText(token, 'Copied ' + token);
      chip.classList.add('copied');
      setTimeout(() => chip.classList.remove('copied'), 900);
    });
  });
}

/* ---------- Clipboard + toast ---------- */
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
}

async function copyText(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // Fallback for older Chromium builds
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) { /* ignore */ }
    ta.remove();
  }
  toast(msg);
}

/* ---------- Events ---------- */
let saveTimer = null;
srcEl.addEventListener('input', () => {
  render();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.local.set({ draft: srcEl.value }), 400);
});

clearBtn.addEventListener('click', () => {
  srcEl.value = '';
  chrome.storage.local.remove('draft');
  render();
  srcEl.focus();
});

copyAllBtn.addEventListener('click', () => {
  if (!lastHexes.length) return;
  copyText([...new Set(lastHexes)].join('\n'), 'Copied ' + lastHexes.length + ' HEX value(s)');
});

/* ---------- Init ---------- */
chrome.storage.local.get({ draft: '' }, (res) => {
  srcEl.value = res.draft || '';
  render();
});
