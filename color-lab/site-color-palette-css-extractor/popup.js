/* PaletteGrab — popup logic.
 * The extractor runs inside the page via scripting.executeScript, user-gesture only.
 * extractPalette() is fully self-contained (no popup-scope references). */

/**
 * Injected into the active tab. Tallies computed color / background-color /
 * border-top-color across visible elements, quantizes to hex, and returns the
 * most frequent colors with usage breakdowns.
 * Heuristic: images, gradients, and box-shadows are ignored.
 */
function extractPalette() {
  function parseColor(str) {
    if (!str) return null;
    str = str.trim().toLowerCase();
    let m;
    if ((m = /^#([0-9a-f]{6})$/.exec(str))) {
      return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 };
    }
    if ((m = /^#([0-9a-f]{3})$/.exec(str))) {
      return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16), a: 1 };
    }
    if ((m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/.exec(str))) {
      return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    }
    return null;
  }
  function toHex(c) {
    const h = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
    return '#' + h(c.r) + h(c.g) + h(c.b);
  }
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }

  const tallies = new Map(); // hex -> {count, text, bg, border}
  const els = document.querySelectorAll('body,header,footer,nav,main,section,article,aside,div,p,h1,h2,h3,h4,h5,h6,a,button,span,li,td,th,input');
  let n = 0;
  for (const el of els) {
    if (n++ >= 800) break; // cap work on huge pages
    if (!isVisible(el)) continue;
    const cs = getComputedStyle(el);
    const slots = [
      ['text', cs.color],
      ['bg', cs.backgroundColor],
      ['border', cs.borderTopColor]
    ];
    for (const [kind, raw] of slots) {
      const c = parseColor(raw);
      if (!c || c.a < 0.5) continue; // skip transparent
      const hex = toHex(c);
      if (!tallies.has(hex)) tallies.set(hex, { hex, count: 0, text: 0, bg: 0, border: 0 });
      const t = tallies.get(hex);
      t.count++; t[kind]++;
    }
  }
  const colors = [...tallies.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  return { colors, scanned: n };
}

/* ---------- popup UI ---------- */

const $ = (id) => document.getElementById(id);
const scanBtn = $('scanBtn'), statusEl = $('status'), wrap = $('resultsWrap'),
      grid = $('grid'), countLabel = $('countLabel');

let lastColors = [];

function setStatus(msg) {
  statusEl.textContent = msg;
  statusEl.classList.remove('hidden');
}
function clearStatus() { statusEl.classList.add('hidden'); statusEl.textContent = ''; }

function usageLabel(c) {
  const parts = [];
  if (c.text) parts.push('text');
  if (c.bg) parts.push('bg');
  if (c.border) parts.push('border');
  return parts.join(' · ') + ` · ×${c.count}`;
}

function cssVars() {
  return ':root {\n' + lastColors.map((c, i) =>
    `  --palette-${String(i + 1).padStart(2, '0')}: ${c.hex}; /* ${usageLabel(c)} */`
  ).join('\n') + '\n}\n';
}

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // fallback for denied clipboard permission
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  setStatus(label + ' copied to clipboard.');
}

function render(data) {
  lastColors = data.colors;
  grid.innerHTML = '';
  if (!lastColors.length) {
    setStatus('No solid colors found on this page.');
    wrap.classList.add('hidden');
    return;
  }
  countLabel.textContent = `${lastColors.length} colors from ${data.scanned} elements`;
  for (const c of lastColors) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.title = 'Copy ' + c.hex;
    b.innerHTML =
      `<div class="chip" style="background:${c.hex}"></div>
       <div class="info"><div class="hex">${c.hex}</div><div class="uses">${usageLabel(c)}</div></div>`;
    b.addEventListener('click', () => copyText(c.hex, c.hex));
    grid.appendChild(b);
  }
  wrap.classList.remove('hidden');
  clearStatus();
}

scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  grid.innerHTML = '';
  wrap.classList.add('hidden');
  setStatus('Extracting palette…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab.');
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPalette
    });
    if (!res || !res.result) throw new Error('Extraction returned nothing.');
    render(res.result);
  } catch (e) {
    const msg = String((e && e.message) || e);
    setStatus(msg.includes('Cannot access')
      ? 'Cannot scan this page (restricted page such as chrome:// or the Web Store).'
      : 'Extraction failed: ' + msg);
  } finally {
    scanBtn.disabled = false;
  }
});

$('copyCss').addEventListener('click', () => {
  if (!lastColors.length) return;
  copyText(cssVars(), 'CSS variables');
});
$('dlCss').addEventListener('click', () => {
  if (!lastColors.length) return;
  download('palette.css', '/* PaletteGrab export */\n' + cssVars(), 'text/css');
  setStatus('palette.css downloaded.');
});
$('dlJson').addEventListener('click', () => {
  if (!lastColors.length) return;
  download('palette.json', JSON.stringify(lastColors, null, 2), 'application/json');
  setStatus('palette.json downloaded.');
});
