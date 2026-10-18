/* FlashGuard content script.
 * Heuristic detection of rapid-flashing animations + suppression.
 * NOT a medical device — detection is best-effort and heuristic. */
(() => {
  if (window.__flashguardLoaded) return;
  window.__flashguardLoaded = true;

  const STYLE_ID = 'flashguard-suppress-style';
  const KILL_CSS = `* { animation: none !important; transition: none !important; scroll-behavior: auto !important; }`;

  /** Parse a CSS time value ("0.3s", "200ms") into milliseconds. */
  function parseCssTime(str) {
    const m = String(str || '').trim().match(/^([\d.]+)(m?s)$/);
    if (!m) return 0;
    return m[2] === 's' ? parseFloat(m[1]) * 1000 : parseFloat(m[1]);
  }

  /** Short human description of an element, e.g. "div#hero.banner". */
  function describe(el) {
    let d = el.tagName.toLowerCase();
    if (el.id) d += '#' + el.id;
    else if (el.className && typeof el.className === 'string') {
      const c = el.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (c) d += '.' + c;
    }
    return d.slice(0, 60);
  }

  /** Find elements whose CSS animation cycles faster than thresholdMs. */
  function findRisky(thresholdMs) {
    const risky = [];
    const els = document.querySelectorAll('*');
    for (const el of els) {
      let cs;
      try { cs = getComputedStyle(el); } catch { continue; }
      if (!cs.animationName || cs.animationName === 'none') continue;
      const durs = cs.animationDuration.split(',').map(parseCssTime).filter((d) => d > 0);
      if (!durs.length) continue;
      const minDur = Math.min(...durs);
      if (minDur < thresholdMs) risky.push({ el, durMs: minDur });
    }
    return risky;
  }

  /** Sample computed opacity to confirm actual flashing (hard on/off toggles). */
  function sampleOpacity(el, totalMs) {
    return new Promise((resolve) => {
      let toggles = 0;
      let last = null;
      const iv = setInterval(() => {
        let op = 1;
        try { op = parseFloat(getComputedStyle(el).opacity); } catch { /* detached */ }
        const state = op < 0.5 ? 0 : 1;
        if (last !== null && state !== last) toggles++;
        last = state;
      }, 40);
      setTimeout(() => { clearInterval(iv); resolve(toggles); }, totalMs);
    });
  }

  /** Inject or remove the global animation-suppression stylesheet. */
  function setKillAll(on) {
    let style = document.getElementById(STYLE_ID);
    if (on && !style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = KILL_CSS;
      (document.head || document.documentElement).appendChild(style);
    } else if (!on && style) {
      style.remove();
    }
  }

  /** Pause animations on currently-risky elements only. */
  function pauseRisky(thresholdMs) {
    const risky = findRisky(thresholdMs);
    for (const { el } of risky) {
      try { el.style.setProperty('animation-play-state', 'paused', 'important'); } catch { /* ignore */ }
    }
    return risky.length;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'fg-ping') { sendResponse({ ok: true }); return true; }

    if (msg.type === 'fg-kill') {
      setKillAll(!!msg.on);
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'fg-pause-risky') {
      const count = pauseRisky(msg.thresholdMs || 500);
      sendResponse({ ok: true, count });
      return true;
    }

    if (msg.type === 'fg-scan') {
      (async () => {
        const thresholdMs = msg.thresholdMs || 500;
        const risky = findRisky(thresholdMs);
        const out = [];
        // Confirm flashing via opacity sampling, capped for performance.
        for (const r of risky.slice(0, 25)) {
          const toggles = await sampleOpacity(r.el, Math.min(r.durMs * 2, 1200));
          out.push({ tag: describe(r.el), durMs: Math.round(r.durMs), flashing: toggles >= 3 });
        }
        sendResponse({ ok: true, risky: out, scanned: risky.length });
      })();
      return true; // async response
    }

    return false;
  });
})();
