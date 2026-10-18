// Break Enforcer — break overlay content script.
// Boot-once guard: re-injection just refreshes the panel. ESC or the skip
// button dismisses it. Page DOM is never otherwise modified.
// Reminders only — not medical advice.

'use strict';

(() => {
  if (window.__breakEnforcerBooted) return;
  window.__breakEnforcerBooted = true;

  const STYLE_ID = '__break-enforcer-style';
  const ROOT_ID = '__break-enforcer-root';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      #${ROOT_ID} { position: fixed; inset: 0; z-index: 2147483647;
        display: none; align-items: center; justify-content: center;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
      #${ROOT_ID}.show { display: flex; }
      #${ROOT_ID} .be-veil { position: absolute; inset: 0;
        background: rgba(8, 8, 14, 0.86); backdrop-filter: blur(10px); }
      #${ROOT_ID}.enforce .be-veil { background: rgba(8, 8, 14, 0.97); }
      #${ROOT_ID} .be-card { position: relative; width: min(420px, 92vw);
        padding: 28px; border-radius: 20px; text-align: center; color: #f2f2f7;
        background: rgba(20, 20, 28, 0.85); border: 1px solid rgba(255,255,255,.1);
        box-shadow: 0 24px 64px rgba(0,0,0,.6); }
      #${ROOT_ID} .be-ring { width: 120px; height: 120px; margin: 0 auto 16px; }
      #${ROOT_ID} h2 { margin: 0 0 8px; font-size: 20px; }
      #${ROOT_ID} .be-sugg { font-size: 14px; line-height: 1.55; color: #c9c9d4;
        background: rgba(96,165,250,.1); border: 1px solid rgba(96,165,250,.3);
        border-radius: 12px; padding: 12px 14px; margin: 14px 0; }
      #${ROOT_ID} .be-time { font-size: 30px; font-weight: 700; color: #60a5fa;
        font-variant-numeric: tabular-nums; }
      #${ROOT_ID} .be-btns { display: flex; gap: 8px; margin-top: 16px; }
      #${ROOT_ID} button { flex: 1; padding: 11px; border-radius: 12px; cursor: pointer;
        border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06);
        color: #f2f2f7; font-size: 13px; }
      #${ROOT_ID} .be-skip { background: rgba(96,165,250,.18);
        border-color: rgba(96,165,250,.4); }
      #${ROOT_ID} .be-note { margin: 14px 0 0; font-size: 11px; color: #8a8a96; }
    `;
    document.documentElement.appendChild(st);
  }

  let root = null;
  let endsAt = 0;
  let rafId = 0;

  function ringSVG(frac) {
    // Progress ring: frac 1 -> 0 as the break counts down.
    const r = 52, c = 2 * Math.PI * r;
    const off = c * (1 - frac);
    return `<svg class="be-ring" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="10"/>
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="#60a5fa" stroke-width="10"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
        transform="rotate(-90 60 60)"/>
    </svg>`;
  }

  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function tick(totalMs) {
    const remain = endsAt - Date.now();
    if (remain <= 0) { hide(); return; }
    const timeEl = root.querySelector('.be-time');
    const ringWrap = root.querySelector('.be-ringwrap');
    if (timeEl) timeEl.textContent = fmt(remain);
    if (ringWrap) ringWrap.innerHTML = ringSVG(remain / totalMs);
    rafId = requestAnimationFrame(() => tick(totalMs));
  }

  function show(msg) {
    ensureStyles();
    endsAt = Date.now() + msg.breakMinutes * 60 * 1000;
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      root.innerHTML = `
        <div class="be-veil"></div>
        <div class="be-card" role="dialog" aria-label="Break time">
          <div class="be-ringwrap"></div>
          <h2>Break time</h2>
          <div class="be-time"></div>
          <div class="be-sugg"></div>
          <div class="be-btns">
            <button class="be-skip">Skip break</button>
            <button class="be-done">Done early</button>
          </div>
          <p class="be-note">Reminders only — not medical advice. Press ESC to dismiss.</p>
        </div>`;
      root.querySelector('.be-skip').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'SKIP_BREAK' });
        hide();
      });
      root.querySelector('.be-done').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'END_BREAK_EARLY' });
        hide();
      });
      document.documentElement.appendChild(root);
    }
    root.classList.toggle('enforce', !!msg.enforceMode);
    root.querySelector('.be-sugg').textContent = msg.suggestion || '';
    root.classList.add('show');
    cancelAnimationFrame(rafId);
    tick(msg.breakMinutes * 60 * 1000);
  }

  function hide() {
    cancelAnimationFrame(rafId);
    if (root) root.classList.remove('show');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root && root.classList.contains('show')) {
      chrome.runtime.sendMessage({ type: 'END_BREAK_EARLY' });
      hide();
    }
  }, true);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SHOW_BREAK') show(msg);
    else if (msg.type === 'HIDE_BREAK') hide();
  });
})();
