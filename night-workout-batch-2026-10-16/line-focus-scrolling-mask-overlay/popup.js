/* Line Focus popup — user-triggered, reversible overlay.
   Nothing is automatic: you press the button, a dim + band goes on the
   active tab; pressing again removes every element it added. */

// ============ ENGINE-START ============
const DEFAULTS = { bandH: 56, dim: 55, follow: true, enabled: false };

function clampSettings(s) {
  const o = { ...DEFAULTS, ...(s || {}) };
  const num = (v, fb) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
  o.bandH = Math.min(120, Math.max(24, Math.round(num(o.bandH, 56))));
  o.dim = Math.min(85, Math.max(20, Math.round(num(o.dim, 55))));
  o.follow = !!o.follow;
  o.enabled = !!o.enabled;
  return o;
}

function statusText(enabled) {
  return enabled ? 'Overlay is ON for this tab.' : 'Overlay is OFF.';
}
// ============ ENGINE-END ============

/* Injected into the tab. Must stay dependency-free (serialised by toString). */
function overlayRunner(settings) {
  const ID = 'lf-line-focus-overlay';
  const old = document.getElementById(ID);
  if (old) { old.remove(); return 'off'; }

  const dimEl = document.createElement('div');
  dimEl.id = ID;
  dimEl.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:2147483647;' +
    'background:#000;opacity:' + (settings.dim / 100).toFixed(2) + ';';
  const bandEl = document.createElement('div');
  bandEl.style.cssText =
    'position:fixed;left:0;right:0;height:' + settings.bandH + 'px;' +
    'background:transparent;box-shadow:0 0 0 9999px rgba(0,0,0,0.01);' +
    'border-top:1px solid rgba(34,211,238,.7);border-bottom:1px solid rgba(34,211,238,.7);' +
    'pointer-events:none;z-index:2147483647;top:40%;';
  dimEl.appendChild(bandEl);
  document.documentElement.appendChild(dimEl);

  let mouseY = window.innerHeight * 0.4;
  const place = () => { bandEl.style.top = Math.max(0, mouseY - settings.bandH / 2) + 'px'; };
  const onMove = (e) => { mouseY = e.clientY; if (!settings.follow) place(); };
  const onScroll = () => { if (settings.follow) place(); };
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('scroll', onScroll, true);
  dimEl.addEventListener('DOMNodeRemoved', () => {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('scroll', onScroll, true);
  });
  place();
  return 'on';
}

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const store = await chrome.storage.local.get('lf').then(r => r.lf || {});
  const st = clampSettings(store);

  $('bandH').value = st.bandH;
  $('bandHVal').textContent = st.bandH + 'px';
  $('dim').value = st.dim;
  $('dimVal').textContent = st.dim + '%';
  $('follow').checked = st.follow;

  const render = () => {
    const on = st.enabled;
    const btn = $('toggle');
    btn.textContent = on ? 'Disable on this tab' : 'Enable on this tab';
    btn.classList.toggle('off', on);
    $('status').textContent = statusText(on);
  };
  render();

  const save = () => chrome.storage.local.set({ lf: st });
  $('bandH').addEventListener('input', (e) => {
    st.bandH = Number(e.target.value);
    $('bandHVal').textContent = st.bandH + 'px'; save();
  });
  $('dim').addEventListener('input', (e) => {
    st.dim = Number(e.target.value);
    $('dimVal').textContent = st.dim + '%'; save();
  });
  $('follow').addEventListener('change', (e) => { st.follow = e.target.checked; save(); });

  $('toggle').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id == null) { $('status').textContent = 'No active tab.'; return; }
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: overlayRunner,
        args: [{ bandH: st.bandH, dim: st.dim, follow: st.follow }],
      });
      st.enabled = res && res.result === 'on';
      save(); render();
    } catch (e) {
      $('status').textContent = 'Cannot run here (browser pages are off-limits).';
    }
  });
});
