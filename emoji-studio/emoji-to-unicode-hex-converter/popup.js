'use strict';
/**
 * GlyphHex — Emoji ⇄ Unicode codepoint converter.
 * Uses Intl.Segmenter (grapheme granularity) so ZWJ sequences, skin-tone
 * modifiers, variation selectors and regional-indicator flags stay together
 * as real user-perceived characters. Surrogate pairs are handled via
 * codePointAt / String.fromCodePoint. All local, no network.
 */

// ---------- dom ----------
const $ = (id) => document.getElementById(id);
const statusEl = $('status');

// ---------- helpers ----------
function flash(msg, kind = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'status'; }, 3500);
}

// Grapheme clusters — correct handling of ZWJ sequences, modifiers, flags.
let segmenter = null;
try { segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' }); } catch (e) { /* older engines */ }

function clustersOf(str) {
  if (segmenter) {
    return Array.from(segmenter.segment(str), (s) => s.segment);
  }
  // Fallback: keep ZWJ joins together, otherwise split per code point.
  const out = [];
  let cur = '';
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    const isJoiner = cp === 0x200D || cp === 0xFE0E || cp === 0xFE0F || (cp >= 0x1F3FB && cp <= 0x1F3FF);
    if (cur && (isJoiner || cur.endsWith('\u200D'))) cur += ch;
    else { if (cur) out.push(cur); cur = ch; }
  }
  if (cur) out.push(cur);
  return out;
}

function codepointsOf(cluster) {
  return Array.from(cluster, (ch) => ch.codePointAt(0));
}

function fmtU(cp) {
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
}

function fmtEscape(cp) {
  return '\\u{' + cp.toString(16).toUpperCase() + '}';
}

// ---------- encode tab ----------
function currentClusters() {
  const text = $('emojiInput').value;
  if (!text) return [];
  return clustersOf(text).map((glyph) => ({ glyph, cps: codepointsOf(glyph) }));
}

function renderResults() {
  const box = $('results');
  box.innerHTML = '';
  const items = currentClusters();
  if (!items.length) {
    box.innerHTML = '<p class="empty">Type or pick an emoji to see its codepoints.</p>';
    return;
  }
  for (const { glyph, cps } of items) {
    const row = document.createElement('div');
    row.className = 'cluster';
    const g = document.createElement('span');
    g.className = 'glyph';
    g.textContent = glyph;
    const codes = document.createElement('div');
    codes.className = 'codes';
    for (const cp of cps) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'code-chip';
      chip.textContent = fmtU(cp);
      chip.title = `Copy ${fmtU(cp)}`;
      chip.addEventListener('click', () => copyText(fmtU(cp)));
      codes.appendChild(chip);
    }
    row.appendChild(g);
    row.appendChild(codes);
    box.appendChild(row);
  }
}

function flatCodepoints() {
  return currentClusters().flatMap((c) => c.cps);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    flash('Copied to clipboard.', 'ok');
  } catch (e) {
    flash('Clipboard blocked — select and copy manually.', 'err');
  }
}

// ---------- decode tab ----------
// Accepts: U+1F600, 1F600, \u{1F600}, \uD83D\uDE00 (surrogate pairs), comma/space/newline separated.
function parseCodeInput(raw) {
  const tokens = raw.split(/[\s,;]+/).filter(Boolean);
  const cps = [];
  const bad = [];
  for (const tok of tokens) {
    let t = tok.trim();
    // \u{1F600} escape form
    let m = t.match(/^\\u\{([0-9A-Fa-f]+)\}$/);
    if (!m) m = t.match(/^(?:U\+|0x)?([0-9A-Fa-f]{4,6})$/);
    if (m) {
      const cp = parseInt(m[1], 16);
      if (cp >= 0 && cp <= 0x10FFFF) { cps.push(cp); continue; }
    }
    // lone surrogate escape like \uD83D\uDE00 written inline
    const sur = t.match(/^(?:\\u([0-9A-Fa-f]{4}))+$/);
    if (sur) {
      const units = t.match(/[0-9A-Fa-f]{4}/g).map((h) => parseInt(h, 16));
      const str = String.fromCharCode(...units);
      const pts = Array.from(str, (ch) => ch.codePointAt(0));
      if (pts.length && pts.every((p) => p !== undefined)) { cps.push(...pts); continue; }
    }
    bad.push(t);
  }
  return { cps, bad };
}

function decode() {
  const { cps, bad } = parseCodeInput($('codeInput').value);
  const out = $('decodeOut');
  if (!cps.length) {
    out.textContent = '—';
    flash('No valid codepoints found.', 'err');
    return;
  }
  try {
    out.textContent = String.fromCodePoint(...cps);
  } catch (e) {
    out.textContent = '—';
    flash('Invalid codepoint values.', 'err');
    return;
  }
  if (bad.length) flash(`Converted ${cps.length}; skipped: ${bad.slice(0, 5).join(', ')}`, 'err');
  else flash(`Converted ${cps.length} codepoint${cps.length > 1 ? 's' : ''}.`, 'ok');
  try { chrome.storage.local.set({ glyphhexDecode: $('codeInput').value }, () => {}); } catch (e) {}
}

// ---------- tabs ----------
function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t === btn;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('.tabpane').forEach((p) => p.classList.remove('active'));
  $(name === 'encode' ? 'tabEncode' : 'tabDecode').classList.add('active');
}

// ---------- init ----------
const SWATCHES = ['😀', '🎉', '🔥', '⭐', '👍', '❤️', '👨‍👩‍👧‍👦', '🏳️‍🌈', '🧑🏽‍💻', '🇮🇳'];

async function init() {
  const sw = $('swatches');
  SWATCHES.forEach((e) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = e;
    b.title = `Use ${e}`;
    b.addEventListener('click', () => {
      const inp = $('emojiInput');
      inp.value = inp.value ? inp.value + e : e;
      renderResults();
      saveInput();
    });
    sw.appendChild(b);
  });

  $('emojiInput').addEventListener('input', () => { renderResults(); saveInput(); });

  $('copyListBtn').addEventListener('click', () => {
    const cps = flatCodepoints();
    if (!cps.length) { flash('Nothing to copy.', 'err'); return; }
    copyText(cps.map(fmtU).join(' '));
  });
  $('copyEscBtn').addEventListener('click', () => {
    const cps = flatCodepoints();
    if (!cps.length) { flash('Nothing to copy.', 'err'); return; }
    copyText(cps.map(fmtEscape).join(''));
  });

  $('decodeBtn').addEventListener('click', decode);
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => switchTab(t.dataset.tab, t));
  });

  // restore last inputs
  try {
    const saved = await chrome.storage.local.get(['glyphhexInput', 'glyphhexDecode']);
    if (saved.glyphhexInput !== undefined) $('emojiInput').value = saved.glyphhexInput;
    if (saved.glyphhexDecode) $('codeInput').value = saved.glyphhexDecode;
  } catch (e) { /* storage unavailable — defaults stand */ }

  renderResults();
}

function saveInput() {
  try { chrome.storage.local.set({ glyphhexInput: $('emojiInput').value }, () => {}); } catch (e) {}
}

document.addEventListener('DOMContentLoaded', init);
