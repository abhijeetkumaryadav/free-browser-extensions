/* ContrastCheck — WCAG 2.x contrast ratio calculator with fix suggestions.
   100% local: no network, no page access. Last colors autosaved to chrome.storage.local. */
'use strict';

const $ = (id) => document.getElementById(id);
const fgPicker = $('fgPicker'), bgPicker = $('bgPicker');
const fgHex = $('fgHex'), bgHex = $('bgHex');
const ratioNum = $('ratioNum'), badgesEl = $('badges');
const previewBox = $('previewBox'), pvNormal = $('pvNormal'), pvLarge = $('pvLarge');
const suggestText = $('suggestText');
const swapBtn = $('swapBtn'), resetBtn = $('resetBtn'), copyBtn = $('copyBtn');
const toastEl = $('toast');

/* ---------- Color math (WCAG 2.x) ---------- */
function parseHex(str) {
  let h = str.trim().toLowerCase();
  if (h.startsWith('#')) h = h.slice(1);
  if (/^[0-9a-f]{3}$/.test(h)) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }) {
  const h = (v) => Math.round(v).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

function luminance({ r, g, b }) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(c1, c2) {
  const l1 = luminance(c1), l2 = luminance(c2);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- HSL helpers for fix suggestions ---------- */
function hexToHsl(hex) {
  const { r, g, b } = parseHex(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex({ r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 });
}

/* ---------- Fix suggestion ----------
   Finds the smallest lightness nudge (darken the darker side OR lighten the
   lighter side) that reaches the target ratio. Returns {label, hex} or null. */
function suggestFix(fgHexStr, bgHexStr, target) {
  const fg = parseHex(fgHexStr), bg = parseHex(bgHexStr);
  const fgLum = luminance(fg), bgLum = luminance(bg);
  const darkIsFg = fgLum <= bgLum;
  const dark = hexToHsl(darkIsFg ? fgHexStr : bgHexStr);
  const light = hexToHsl(darkIsFg ? bgHexStr : fgHexStr);
  const darkLabel = darkIsFg ? 'text' : 'background';
  const lightLabel = darkIsFg ? 'background' : 'text';

  const candidates = [];
  for (let step = 1; step <= 60; step++) {
    const nl = Math.max(0, dark.l - step);
    const hex = hslToHex(dark.h, dark.s, nl);
    const other = darkIsFg ? bg : fg;
    if (ratio(parseHex(hex), other) >= target) { candidates.push({ label: darkLabel, hex, step, dir: 'Darken' }); break; }
  }
  for (let step = 1; step <= 60; step++) {
    const nl = Math.min(100, light.l + step);
    const hex = hslToHex(light.h, light.s, nl);
    const other = darkIsFg ? fg : bg;
    if (ratio(parseHex(hex), other) >= target) { candidates.push({ label: lightLabel, hex, step, dir: 'Lighten' }); break; }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.step - b.step);
  return candidates[0];
}

/* ---------- UI ---------- */
function setBadge(key, pass) {
  const el = badgesEl.querySelector('[data-k="' + key + '"]');
  el.classList.toggle('pass', pass);
  el.classList.toggle('fail', !pass);
  el.querySelector('.b-val').textContent = pass ? '✓ Pass' : '✗ Fail';
}

let lastState = null;

function update() {
  const fgStr = fgHex.value, bgStr = bgHex.value;
  const fg = parseHex(fgStr), bg = parseHex(bgStr);
  fgHex.classList.toggle('invalid', !fg);
  bgHex.classList.toggle('invalid', !bg);

  if (!fg || !bg) {
    ratioNum.textContent = '--';
    ratioNum.className = 'ratio-num';
    ['aa-normal', 'aaa-normal', 'aa-large', 'aaa-large'].forEach((k) => {
      const el = badgesEl.querySelector('[data-k="' + k + '"]');
      el.classList.remove('pass', 'fail');
      el.querySelector('.b-val').textContent = '–';
    });
    suggestText.textContent = 'Enter two valid hex colors to check contrast.';
    lastState = null;
    return;
  }

  const r = ratio(fg, bg);
  lastState = { fg: toHex(fg), bg: toHex(bg), ratio: r };

  ratioNum.textContent = r.toFixed(2) + ':1';
  ratioNum.className = 'ratio-num ' + (r >= 7 ? 'good' : r >= 4.5 ? 'warn' : 'bad');

  setBadge('aa-normal', r >= 4.5);
  setBadge('aaa-normal', r >= 7);
  setBadge('aa-large', r >= 3);
  setBadge('aaa-large', r >= 4.5);

  previewBox.style.background = toHex(bg);
  pvNormal.style.color = toHex(fg);
  pvLarge.style.color = toHex(fg);

  // Suggestion
  if (r >= 7) {
    suggestText.innerHTML = 'Excellent — this pair passes <b>AAA</b> for normal text. No changes needed.';
  } else if (r >= 4.5) {
    const fix = suggestFix(toHex(fg), toHex(bg), 7);
    suggestText.innerHTML = 'Passes <b>AA</b> for normal text.' +
      (fix ? ' To reach <b>AAA</b> (7:1): ' + fix.dir.toLowerCase() + ' the ' + fix.label +
        ' to <code>' + fix.hex + '</code>.' : ' AAA is not reachable with a lightness tweak alone — pick more distant colors.');
  } else {
    const fix = suggestFix(toHex(fg), toHex(bg), 4.5);
    suggestText.innerHTML = 'Fails <b>AA</b> for normal text (needs 4.5:1).' +
      (fix ? ' Fix: ' + fix.dir.toLowerCase() + ' the ' + fix.label +
        ' to <code>' + fix.hex + '</code>.' : ' These colors are too close — choose more distant colors.');
  }

  clearTimeout(update._t);
  update._t = setTimeout(() => chrome.storage.local.set({ fg: fgHex.value, bg: bgHex.value }), 400);
}

/* ---------- Events ---------- */
function syncPickerFromHex(hexEl, pickerEl) {
  const c = parseHex(hexEl.value);
  if (c) pickerEl.value = toHex(c);
}

fgPicker.addEventListener('input', () => { fgHex.value = fgPicker.value; update(); });
bgPicker.addEventListener('input', () => { bgHex.value = bgPicker.value; update(); });
fgHex.addEventListener('input', () => { syncPickerFromHex(fgHex, fgPicker); update(); });
bgHex.addEventListener('input', () => { syncPickerFromHex(bgHex, bgPicker); update(); });

swapBtn.addEventListener('click', () => {
  [fgHex.value, bgHex.value] = [bgHex.value, fgHex.value];
  [fgPicker.value, bgPicker.value] = [bgPicker.value, fgPicker.value];
  update();
});

resetBtn.addEventListener('click', () => {
  fgHex.value = '#1a1a1a'; bgHex.value = '#ffffff';
  fgPicker.value = '#1a1a1a'; bgPicker.value = '#ffffff';
  chrome.storage.local.remove(['fg', 'bg']);
  update();
});

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
}

copyBtn.addEventListener('click', async () => {
  if (!lastState) { toast('Nothing to copy yet'); return; }
  const s = lastState;
  const line = 'Contrast ' + s.ratio.toFixed(2) + ':1 — ' + s.fg + ' on ' + s.bg +
    ' — AA normal: ' + (s.ratio >= 4.5 ? 'PASS' : 'FAIL') +
    ', AAA normal: ' + (s.ratio >= 7 ? 'PASS' : 'FAIL') +
    ', AA large: ' + (s.ratio >= 3 ? 'PASS' : 'FAIL') +
    ', AAA large: ' + (s.ratio >= 4.5 ? 'PASS' : 'FAIL');
  try { await navigator.clipboard.writeText(line); }
  catch (e) {
    const ta = document.createElement('textarea');
    ta.value = line; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) { /* ignore */ }
    ta.remove();
  }
  toast('Result copied');
});

/* ---------- Init ---------- */
chrome.storage.local.get({ fg: '#1a1a1a', bg: '#ffffff' }, (res) => {
  fgHex.value = res.fg || '#1a1a1a';
  bgHex.value = res.bg || '#ffffff';
  syncPickerFromHex(fgHex, fgPicker);
  syncPickerFromHex(bgHex, bgPicker);
  update();
});
