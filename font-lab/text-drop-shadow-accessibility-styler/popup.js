/* TextShadow popup — applies/removes an accessibility drop shadow on the active tab.
   All page work happens inside self-contained injected functions (no cross-call
   page state), so this works with MV3 isolated-world executeScript. */

const STYLE_ID = 'textshadow-a11y-style';

// --- Injected functions (must be fully self-contained) ---
function applyShadowPage(opts) {
  const id = 'textshadow-a11y-style';
  document.getElementById(id)?.remove();
  const sel = 'body, body *:not(script):not(style):not(noscript):not(svg):not(canvas):not(video)';
  const st = document.createElement('style');
  st.id = id;
  st.textContent = `${sel}{text-shadow:${opts.offset}px ${opts.offset}px ${opts.blur}px ${opts.color} !important;}`;
  document.documentElement.appendChild(st);
  return true;
}
function clearShadowPage() {
  document.getElementById('textshadow-a11y-style')?.remove();
  return false;
}
function probeShadowPage() {
  return !!document.getElementById('textshadow-a11y-style');
}

// --- Popup state ---
const $ = (id) => document.getElementById(id);
const els = {
  badge: $('stateBadge'), offset: $('offset'), blur: $('blur'),
  offsetVal: $('offsetVal'), blurVal: $('blurVal'),
  presetSeg: $('presetSeg'), customRow: $('customRow'),
  customColor: $('customColor'), customAlpha: $('customAlpha'), customAlphaVal: $('customAlphaVal'),
  preview: $('preview'), applyBtn: $('applyBtn'), restoreBtn: $('restoreBtn'), note: $('pageNote'),
};

const DEFAULTS = { offset: 2, blur: 3, preset: 'dark', customColor: '#000000', customAlpha: 55 };
const PRESET_COLORS = { dark: 'rgba(0,0,0,0.6)', light: 'rgba(255,255,255,0.65)' };

let settings = { ...DEFAULTS };

function hexToRgba(hex, alphaPct) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${(alphaPct / 100).toFixed(2)})`;
}
function shadowColor() {
  if (settings.preset === 'custom') return hexToRgba(settings.customColor, settings.customAlpha);
  return PRESET_COLORS[settings.preset];
}
function refreshUI() {
  els.offset.value = settings.offset;
  els.blur.value = settings.blur;
  els.offsetVal.textContent = settings.offset + 'px';
  els.blurVal.textContent = settings.blur + 'px';
  els.customColor.value = settings.customColor;
  els.customAlpha.value = settings.customAlpha;
  els.customAlphaVal.textContent = settings.customAlpha + '%';
  els.customRow.hidden = settings.preset !== 'custom';
  els.presetSeg.querySelectorAll('button').forEach(b =>
    b.classList.toggle('on', b.dataset.preset === settings.preset));
  els.preview.style.textShadow = `${settings.offset}px ${settings.offset}px ${settings.blur}px ${shadowColor()}`;
}
function setBadge(active) {
  els.badge.textContent = active ? 'Active' : 'Idle';
  els.badge.classList.toggle('active', active);
}
function setNote(msg) { els.note.textContent = msg; }

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
async function runOnPage(fn, args = []) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error('No active tab.');
  const url = tab.url || '';
  if (!/^(https?|file):/.test(url)) throw new Error('This page is restricted (e.g. chrome://) — try a normal web page.');
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fn, args });
  return res?.result;
}

// --- Wire up controls ---
els.offset.addEventListener('input', () => { settings.offset = +els.offset.value; refreshUI(); save(); });
els.blur.addEventListener('input', () => { settings.blur = +els.blur.value; refreshUI(); save(); });
els.customColor.addEventListener('input', () => { settings.customColor = els.customColor.value; refreshUI(); save(); });
els.customAlpha.addEventListener('input', () => { settings.customAlpha = +els.customAlpha.value; refreshUI(); save(); });
els.presetSeg.addEventListener('click', (e) => {
  const p = e.target.dataset?.preset;
  if (!p) return;
  settings.preset = p; refreshUI(); save();
});
function save() { chrome.storage.local.set({ textshadow: settings }); }

els.applyBtn.addEventListener('click', async () => {
  try {
    setNote('Applying…');
    const opts = { offset: settings.offset, blur: settings.blur, color: shadowColor() };
    await runOnPage(applyShadowPage, [opts]);
    setBadge(true); setNote('Shadow applied to this tab.');
  } catch (e) { setNote(e.message); }
});
els.restoreBtn.addEventListener('click', async () => {
  try {
    await runOnPage(clearShadowPage);
    setBadge(false); setNote('Page restored to its original text.');
  } catch (e) { setNote(e.message); }
});

// --- Init ---
(async () => {
  const stored = await chrome.storage.local.get('textshadow');
  settings = { ...DEFAULTS, ...(stored.textshadow || {}) };
  refreshUI();
  try {
    const tab = await activeTab();
    const host = tab?.url ? new URL(tab.url).hostname : '';
    setNote(host ? `Ready — this tab: ${host}` : '');
    setBadge(await runOnPage(probeShadowPage));
  } catch { setBadge(false); }
})();
