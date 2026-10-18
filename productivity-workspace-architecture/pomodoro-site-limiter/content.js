/* Pomodoro Site Limiter — content script
   Runs at document_start on http/https pages. Asks the service worker
   whether this host is blocked during an active focus session; if so,
   replaces the page with a non-destructive interstitial overlay.
   Fully reversible: leaving the site or ending the session restores it. */

(function () {
  const host = location.hostname;
  let overlay = null;

  chrome.runtime.sendMessage({ type: 'shouldBlock', host }, (res) => {
    if (chrome.runtime.lastError || !res || !res.blocked) return;
    showInterstitial(res.remainingMs);
  });

  function showInterstitial(remainingMs) {
    // Hide the underlying page immediately.
    document.documentElement.style.visibility = 'hidden';

    overlay = document.createElement('div');
    overlay.id = 'psl-interstitial';
    overlay.innerHTML = `
      <div class="psl-card">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/></svg>
        <h1>Back to focus</h1>
        <p class="psl-host">${escapeHtml(host)} is on your blocklist.</p>
        <div class="psl-time" id="pslTime">--:--</div>
        <p class="psl-sub">Focus session ends in</p>
        <button class="psl-btn" id="pslLeave">Take me somewhere productive</button>
        <p class="psl-note">Breaks unlock all sites. Nothing was deleted — this is just a pause.</p>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #psl-interstitial { position: fixed; inset: 0; z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
        background: rgba(11,11,16,0.92); backdrop-filter: blur(14px);
        font-family: -apple-system, "Segoe UI", Inter, Roboto, sans-serif; }
      #psl-interstitial .psl-card { text-align: center; padding: 32px; max-width: 360px;
        background: rgba(20,20,26,0.72); border: 1px solid rgba(255,255,255,0.08);
        border-radius: 18px; }
      #psl-interstitial h1 { color: #e8e8ee; font-size: 22px; margin: 14px 0 6px; }
      #psl-interstitial .psl-host { color: #8b8b98; font-size: 13px; }
      #psl-interstitial .psl-time { color: #ef4444; font-size: 46px; font-weight: 700;
        font-variant-numeric: tabular-nums; margin: 12px 0 2px; }
      #psl-interstitial .psl-sub { color: #8b8b98; font-size: 12px; text-transform: uppercase;
        letter-spacing: 1.5px; margin-bottom: 18px; }
      #psl-interstitial .psl-btn { background: #ef4444; color: #fff; border: none;
        border-radius: 10px; padding: 11px 22px; font-size: 14px; font-weight: 650;
        cursor: pointer; }
      #psl-interstitial .psl-btn:hover { filter: brightness(1.12); }
      #psl-interstitial .psl-note { color: #8b8b98; font-size: 11.5px; margin-top: 14px; opacity: 0.8; }`;

    document.documentElement.appendChild(style);
    document.documentElement.appendChild(overlay);
    document.documentElement.style.visibility = '';

    const endAt = Date.now() + remainingMs;
    const tick = () => {
      const left = Math.max(0, endAt - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      const el = document.getElementById('pslTime');
      if (el) el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      if (left <= 0) {
        // Session ended → remove the overlay and reveal the page.
        overlay.remove();
        document.documentElement.style.visibility = '';
      }
    };
    tick();
    const iv = setInterval(() => {
      if (!document.getElementById('psl-interstitial')) { clearInterval(iv); return; }
      tick();
    }, 1000);

    document.getElementById('pslLeave').addEventListener('click', () => {
      location.href = 'about:blank';
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
})();
