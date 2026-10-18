// Focus Gate — content script (grayscale gate).
// Runs on every http(s) page, but only engages on sites the user picked.
'use strict';

/* ---------- pure engine (headless-testable) ---------- */
// ENGINE-START
function normHost(h) {
  return String(h || '').toLowerCase().replace(/^www\./, '');
}
// Does `host` fall under any user-listed site? ("reddit.com" matches
// old.reddit.com; "eddit.com" does NOT match "reddit.com".)
function siteMatches(host, sites) {
  const h = normHost(host);
  return (sites || []).some((s) => {
    const n = normHost(s);
    return !!n && (h === n || h.endsWith('.' + n));
  });
}
// ENGINE-END

const OVERLAY_ID = 'focus-gate-overlay';

// Dismiss the gate: remove overlay + restore color. Pure self-declaration —
let dismissed = false;

function injectGate(cfg) {
  if (document.getElementById(OVERLAY_ID) || dismissed) return;
  // Grayscale everything behind the gate.
  document.documentElement.style.filter = 'grayscale(1) contrast(0.96)';

  const o = document.createElement('div');
  o.id = OVERLAY_ID;
  const mins = Math.max(1, cfg.minutes || 10);
  o.innerHTML = `
    <div class="fg-card">
      <div class="fg-title">Focus gate</div>
      <div class="fg-sub">This is one of <b>your</b> gated sites.</div>
      <div class="fg-task">
        <span class="fg-ico">💪</span>
        <span>Do <b>${mins === 1 ? '1 minute' : mins + ' minutes'} of movement</b> first —
        ${cfg.exercise || '10 squats'} — then tap below to continue.</span>
      </div>
      <button class="fg-btn" id="${OVERLAY_ID}-go">I've moved — let me in</button>
      <button class="fg-link" id="${OVERLAY_ID}-edit">open the list (toolbar popup)</button>
    </div>`;
  const css = document.createElement('style');
  css.textContent = `
    #${OVERLAY_ID}{position:fixed;inset:0;z-index:2147483647;display:flex;
      align-items:center;justify-content:center;
      background:rgba(10,10,14,.82);backdrop-filter:blur(8px);}
    #${OVERLAY_ID} .fg-card{width:340px;padding:26px;border-radius:18px;
      background:rgba(22,22,30,.9);border:1px solid rgba(45,212,191,.25);
      color:#f1f5f9;font:15px/1.5 system-ui,sans-serif;text-align:center;
      box-shadow:0 12px 48px rgba(0,0,0,.6);}
    #${OVERLAY_ID} .fg-title{font-size:20px;font-weight:700;margin-bottom:4px;
      color:#2dd4bf;}
    #${OVERLAY_ID} .fg-sub{color:#94a3b8;font-size:13px;margin-bottom:16px;}
    #${OVERLAY_ID} .fg-task{display:flex;gap:10px;align-items:flex-start;text-align:left;
      background:rgba(45,212,191,.08);border:1px solid rgba(45,212,191,.2);
      border-radius:12px;padding:12px;margin-bottom:18px;}
    #${OVERLAY_ID} .fg-ico{font-size:22px;}
    #${OVERLAY_ID} .fg-btn{width:100%;padding:13px;border:none;border-radius:12px;
      background:#2dd4bf;color:#062b28;font-weight:700;font-size:15px;cursor:pointer;}
    #${OVERLAY_ID} .fg-link{display:block;margin:10px auto 0;background:none;border:none;
      color:#64748b;font-size:12px;cursor:pointer;text-decoration:underline;}`;
  document.documentElement.appendChild(css);
  document.documentElement.appendChild(o);

  document.getElementById(OVERLAY_ID + '-go').addEventListener('click', () => {
    dismissed = true;
    o.remove(); css.remove();
    document.documentElement.style.filter = '';
  });
  document.getElementById(OVERLAY_ID + '-edit').addEventListener('click', () => {
    alert('Focus Gate: open the toolbar popup to edit your gated-site list.');
  });
}

(async () => {
  try {
    const cfg = await chrome.storage.local.get({ fgSites: [], fgEnabled: true, fgMinutes: 2, fgExercise: '10 squats' });
    if (cfg.fgEnabled && siteMatches(location.hostname, cfg.fgSites)) injectGate(cfg);
  } catch (e) { /* storage unavailable — stay silent, don't break the page */ }
})();
