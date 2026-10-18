/* Page Tint popup — user-triggered, reversible page tint.
   Modes: sepia, night, invert. Turning off removes all changes. */

// ============ ENGINE-START ============
const MODES = ['sepia', 'night', 'invert'];
const DEFAULTS = { mode: 'sepia', strength: 80, enabled: false };

function clampSettings(s) {
  const o = { ...DEFAULTS, ...(s || {}) };
  o.mode = MODES.includes(o.mode) ? o.mode : 'sepia';
  const n = Number(o.strength);
  o.strength = Math.min(100, Math.max(20, Math.round(Number.isFinite(n) ? n : 80)));
  o.enabled = !!o.enabled;
  return o;
}

function filterFor(mode, strength) {
  const a = (strength / 100).toFixed(2);
  switch (mode) {
    case 'sepia':  return `sepia(${a})`;
    case 'night':  return `brightness(${(1 - strength / 220).toFixed(2)}) sepia(${(strength / 140).toFixed(2)})`;
    case 'invert': return `invert(${a}) hue-rotate(180deg)`;
    default:       return 'none';
  }
}

function statusText(mode, enabled) {
  return enabled ? `Tint is ON — ${mode} mode.` : 'Tint is OFF.';
}
// ============ ENGINE-END ============

/* Injected into the tab. Dependency-free (serialised by toString). */
function tintRunner(args) {
  const ID = 'pt-page-tint-overlay';
  const old = document.getElementById(ID);
  if (old) { old.remove(); return 'off'; }
  if (!args || !args.css || args.css === 'none') return 'off';

  const el = document.createElement('div');
  el.id = ID;
  // blend-mode overlay tints the page without touching its DOM.
  el.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:2147483646;' +
    'background:' + args.bg + ';mix-blend-mode:' + args.blend + ';';
  document.documentElement.appendChild(el);
  document.documentElement.style.filter = args.filterCss || '';
  document.documentElement.setAttribute('data-pt-tint', '1');

  // Observe our own removal so we can clean the document filter.
  const mo = new MutationObserver(() => {
    if (!document.getElementById(ID)) {
      document.documentElement.style.filter = '';
      document.documentElement.removeAttribute('data-pt-tint');
      mo.disconnect();
    }
  });
  mo.observe(document.documentElement, { childList: true });
  return 'on';
}

function buildTint(mode, strength) {
  const a = strength / 100;
  if (mode === 'sepia') {
    return { bg: `rgba(194,150,90,${(0.5 * a).toFixed(2)})`, blend: 'multiply', filterCss: `sepia(${(0.4 * a).toFixed(2)})` };
  }
  if (mode === 'night') {
    return { bg: `rgba(10,14,30,${(0.55 * a).toFixed(2)})`, blend: 'multiply', filterCss: `brightness(${(1 - 0.25 * a).toFixed(2)})` };
  }
  // invert: overlay approach washes out; use document filter instead.
  return { bg: 'transparent', blend: 'normal', filterCss: filterFor('invert', strength) };
}

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const store = await chrome.storage.local.get('pt').then(r => r.pt || {});
  const st = clampSettings(store);

  $('strength').value = st.strength;
  $('strengthVal').textContent = st.strength + '%';

  const render = () => {
    document.querySelectorAll('.mode').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === st.mode && st.enabled);
    });
    $('status').textContent = statusText(st.mode, st.enabled);
  };
  render();

  const save = () => chrome.storage.local.set({ pt: st });
  $('strength').addEventListener('input', (e) => {
    st.strength = Number(e.target.value);
    $('strengthVal').textContent = st.strength + '%'; save();
  });

  async function applyToTab(tint) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id == null) { $('status').textContent = 'No active tab.'; return; }
    const t = tint || buildTint(st.mode, st.strength);
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: tintRunner,
        args: [{ bg: t.bg, blend: t.blend, filterCss: t.filterCss, css: 'x' }],
      });
      st.enabled = res && res.result === 'on';
      save(); render();
    } catch (e) {
      $('status').textContent = 'Cannot run here (browser pages are off-limits).';
    }
  }

  document.querySelectorAll('.mode').forEach(b => {
    b.addEventListener('click', () => { st.mode = b.dataset.mode; applyToTab(); });
  });
  $('off').addEventListener('click', async () => {
    // Toggle runner removes the overlay when it exists.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id == null) return;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: tintRunner, args: [null] });
    } catch (e) { /* page may not have it; ignore */ }
    st.enabled = false; save(); render();
  });
});
