/* ReadEase popup — swaps page fonts to dyslexia-friendly system stacks
   with adjustable spacing. Injected functions are fully self-contained
   (MV3 CSP forbids eval; chrome.scripting serializes the function only).
   Accessibility aid, not medical advice. */

'use strict';

const STACKS = [
  { name: 'Verdana',        stack: "Verdana, Geneva, sans-serif",            note: 'Wide, open letterforms' },
  { name: 'Tahoma',         stack: "Tahoma, Geneva, Verdana, sans-serif",   note: 'Compact but legible' },
  { name: 'Trebuchet MS',  stack: "'Trebuchet MS', Verdana, sans-serif",    note: 'Tall x-height' },
  { name: 'Century Gothic', stack: "'Century Gothic', Futura, 'Trebuchet MS', sans-serif", note: 'Rounded, airy' },
  { name: 'Comic Sans',    stack: "'Comic Sans MS', 'Comic Sans', 'Chalkboard SE', cursive", note: 'Asymmetric strokes' },
  { name: 'Open system',   stack: "ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif", note: 'Your OS default' },
];

const STYLE_ID = 'readease-injected-style';

/** Self-contained: applies font + spacing to the page. opts: {family, letter, word, line} */
function applyReadEase(opts) {
  const id = 'readease-injected-style';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.documentElement.appendChild(el);
  }
  el.textContent =
    `html body, html body * {` +
    ` font-family: ${opts.family} !important;` +
    ` letter-spacing: ${opts.letter}em !important;` +
    ` word-spacing: ${opts.word}em !important;` +
    ` line-height: ${opts.line} !important; }` +
    `html body code, html body pre, html body kbd, html body samp, html body tt { font-family: inherit !important; }`;
}

/** Self-contained: removes the injected stylesheet entirely. */
function removeReadEase() {
  const el = document.getElementById('readease-injected-style');
  if (el) el.remove();
}

/** Self-contained: reports whether ReadEase is active. */
function readEaseState() {
  return !!document.getElementById('readease-injected-style');
}

const $ = (id) => document.getElementById(id);
const DEFAULTS = { stackIndex: 0, letter: 6, word: 16, line: 160 };

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function runOnTab(fn, args) {
  const tab = await getTab();
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: fn,
    args: args || [],
  });
}

async function getSettings() {
  const stored = await chrome.storage.local.get(['readease']);
  return Object.assign({}, DEFAULTS, stored.readease || {});
}

async function saveSettings(s) {
  await chrome.storage.local.set({ readease: s });
}

function currentOpts(s) {
  return {
    family: STACKS[s.stackIndex].stack,
    letter: (s.letter / 100).toFixed(2),
    word: (s.word / 100).toFixed(2),
    line: (s.line / 100).toFixed(2),
  };
}

function setToggle(on) {
  const t = $('toggle');
  t.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function renderStacks(activeIndex) {
  const host = $('stacks');
  host.textContent = '';
  STACKS.forEach((item, i) => {
    const btn = document.createElement('button');
    btn.className = 'stack' + (i === activeIndex ? ' active' : '');
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = item.name;
    const sample = document.createElement('div');
    sample.className = 'sample';
    sample.style.fontFamily = item.stack;
    sample.textContent = 'AaBbCc 123';
    btn.appendChild(name);
    btn.appendChild(sample);
    btn.title = item.note;
    btn.addEventListener('click', async () => {
      const s = await getSettings();
      s.stackIndex = i;
      await saveSettings(s);
      renderStacks(i);
      if ($('toggle').getAttribute('aria-pressed') === 'true') {
        await runOnTab(applyReadEase, [currentOpts(s)]);
      }
    });
    host.appendChild(btn);
  });
}

function renderSliders(s) {
  $('letter').value = s.letter;
  $('word').value = s.word;
  $('line').value = s.line;
  $('letterVal').textContent = (s.letter / 100).toFixed(2) + 'em';
  $('wordVal').textContent = (s.word / 100).toFixed(2) + 'em';
  $('lineVal').textContent = (s.line / 100).toFixed(1);
}

async function sliderChanged() {
  const s = await getSettings();
  s.letter = parseInt($('letter').value, 10);
  s.word = parseInt($('word').value, 10);
  s.line = parseInt($('line').value, 10);
  await saveSettings(s);
  renderSliders(s);
  if ($('toggle').getAttribute('aria-pressed') === 'true') {
    try { await runOnTab(applyReadEase, [currentOpts(s)]); } catch { /* restricted page */ }
  }
}

async function toggle() {
  const on = $('toggle').getAttribute('aria-pressed') === 'true';
  try {
    if (on) {
      await runOnTab(removeReadEase, []);
    } else {
      const s = await getSettings();
      await runOnTab(applyReadEase, [currentOpts(s)]);
    }
  } catch { return; } // restricted page — stay put
  setToggle(!on);
}

async function restore() {
  try { await runOnTab(removeReadEase, []); } catch { /* ignore */ }
  setToggle(false);
}

document.addEventListener('DOMContentLoaded', async () => {
  const s = await getSettings();
  renderStacks(s.stackIndex);
  renderSliders(s);
  let active = false;
  try {
    const tab = await getTab();
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: readEaseState,
    });
    active = !!result;
  } catch { /* restricted page */ }
  setToggle(active);
  $('toggle').addEventListener('click', toggle);
  ['letter', 'word', 'line'].forEach((id) =>
    $(id).addEventListener('input', sliderChanged));
  $('restore').addEventListener('click', restore);
});
