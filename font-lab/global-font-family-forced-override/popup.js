/* FontForce popup logic — injects apply-font.js on explicit user click only. */
'use strict';

// Curated font options. No webfonts are fetched; everything is system fonts
// so the extension works fully offline and never phones home.
const FONTS = [
  {
    id: 'sans',
    label: 'Sans-serif (system)',
    stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    extra: '',
    desc: 'Clean modern sans — best general readability.'
  },
  {
    id: 'serif',
    label: 'Serif (Georgia)',
    stack: "Georgia, 'Times New Roman', serif",
    extra: '',
    desc: 'Book-style serif — easy on the eyes for long reads.'
  },
  {
    id: 'mono',
    label: 'Monospace',
    stack: "ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace",
    extra: '',
    desc: 'Fixed-width characters — every letter is distinct.'
  },
  {
    id: 'dyslexia',
    label: 'Dyslexia-friendly',
    // No OpenDyslexic font is bundled, so we approximate with a widely
    // available tall-x-height font plus extra letter/word spacing.
    stack: "Verdana, 'Trebuchet MS', sans-serif",
    extra: 'body, p, li, span, a, td, th, label { letter-spacing: 0.06em !important; word-spacing: 0.14em !important; }',
    desc: 'Verdana + wider spacing — helps readers who struggle with dense text.'
  }
];

const fontSel = document.getElementById('font');
const fontDesc = document.getElementById('fontDesc');
const strength = document.getElementById('strength');
const strengthVal = document.getElementById('strengthVal');
const statusEl = document.getElementById('status');

for (const f of FONTS) {
  const opt = document.createElement('option');
  opt.value = f.id;
  opt.textContent = f.label;
  fontSel.appendChild(opt);
}

function refreshMeta() {
  const f = FONTS.find(x => x.id === fontSel.value);
  fontDesc.textContent = f ? f.desc : '';
  strengthVal.textContent = strength.value === '0' ? 'body + text' : 'everything';
}
fontSel.addEventListener('change', refreshMeta);
strength.addEventListener('input', refreshMeta);

// Persist preferences locally.
chrome.storage.local.get({ fontId: 'sans', strength: 0 }, prefs => {
  fontSel.value = prefs.fontId;
  strength.value = String(prefs.strength);
  refreshMeta();
});
fontSel.addEventListener('change', () =>
  chrome.storage.local.set({ fontId: fontSel.value }));
strength.addEventListener('change', () =>
  chrome.storage.local.set({ strength: Number(strength.value) }));

function setStatus(text, on) {
  statusEl.textContent = text;
  statusEl.classList.toggle('on', !!on);
}

function inject(fnName, args) {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (!tab || !tab.id) throw new Error('No active tab.');
    return chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['apply-font.js']
    }).then(() => chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (...a) => window[fnName](...a),
      args
    }));
  });
}

document.getElementById('apply').addEventListener('click', async () => {
  const f = FONTS.find(x => x.id === fontSel.value) || FONTS[0];
  setStatus('applying…', false);
  try {
    await inject('applyFontOverride', [f.stack, f.extra, Number(strength.value)]);
    setStatus('applied', true);
  } catch (e) {
    setStatus('blocked page', false);
  }
});

document.getElementById('restore').addEventListener('click', async () => {
  setStatus('restoring…', false);
  try {
    await inject('removeFontOverride', []);
    setStatus('idle', false);
  } catch (e) {
    setStatus('blocked page', false);
  }
});

// Probe whether an override is currently active on this tab.
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (!tab || !tab.id) return;
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => !!document.getElementById('fontforce-override-style')
  }).then(([res]) => {
    if (res && res.result) setStatus('applied', true);
  }).catch(() => {});
});
