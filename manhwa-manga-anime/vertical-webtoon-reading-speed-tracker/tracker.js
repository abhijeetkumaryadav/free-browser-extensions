/* StripStats content script — injected on demand. Measures scroll-based panel passes.
   A "panel" = a large image scrolled fully past the viewport top. Estimates only. */
(() => {
  if (window.__stripstats) return; // idempotent re-injection
  window.__stripstats = true;

  const S = {
    tracking: false, startT: 0, panels: new Set(), passTimes: [],
    wpp: 25, minH: 200, hudOn: true, hud: null, tick: null, scanT: 0,
  };

  const candidates = () =>
    [...document.images].filter(img => (img.naturalHeight || img.height || 0) >= S.minH * 0.7);

  function ensureHud() {
    if (S.hud || !S.hudOn) return;
    const d = document.createElement('div');
    d.id = '__stripstats_hud';
    d.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;' +
      'background:rgba(16,16,20,.88);backdrop-filter:blur(12px);color:#f2f2f5;' +
      'border:1px solid rgba(163,230,53,.35);border-radius:12px;padding:10px 12px;' +
      'font:12px/1.4 -apple-system,Segoe UI,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4)';
    d.innerHTML = '<div style="font-weight:700;color:#a3e635" data-h>0 panels/min</div>' +
      '<div data-s style="color:#a3a3ad;font-size:11px">0 panels · 0:00</div>' +
      '<button data-x style="position:absolute;top:2px;right:8px;background:none;border:none;' +
      'color:#a3a3ad;cursor:pointer;font-size:14px">×</button>';
    d.querySelector('[data-x]').addEventListener('click', () => stop(true));
    document.documentElement.appendChild(d);
    S.hud = d;
  }
  function removeHud() { S.hud?.remove(); S.hud = null; }
  function paintHud() {
    if (!S.hud) return;
    const st = stats();
    S.hud.querySelector('[data-h]').textContent = `${st.ppm} panels/min · ${st.wpm} wpm`;
    S.hud.querySelector('[data-s]').textContent = `${st.count} panels · ${fmt(st.elapsed)}`;
  }

  function onScroll() {
    if (!S.tracking) return;
    const now = Date.now();
    if (now - S.scanT < 250) return; // throttle
    S.scanT = now;
    for (const img of candidates()) {
      if (S.panels.has(img)) continue;
      if (img.getBoundingClientRect().bottom < 0) {
        S.panels.add(img);
        S.passTimes.push(now);
      }
    }
    S.passTimes = S.passTimes.filter(t => now - t < 60000);
    paintHud();
  }

  function stats() {
    const elapsed = S.tracking ? Math.floor((Date.now() - S.startT) / 1000) : 0;
    const ppm = S.passTimes.length; // passes in last 60s
    return {count: S.panels.size, ppm, wpm: ppm * S.wpp, elapsed};
  }

  function start(wpp, minH, hud) {
    S.tracking = true; S.startT = Date.now();
    S.panels = new Set(); S.passTimes = [];
    S.wpp = wpp; S.minH = minH; S.hudOn = hud;
    ensureHud();
    window.addEventListener('scroll', onScroll, {passive: true});
    S.tick = setInterval(paintHud, 1000);
    onScroll();
  }

  async function stop(fromHud) {
    if (!S.tracking) return null;
    S.tracking = false;
    window.removeEventListener('scroll', onScroll);
    clearInterval(S.tick); removeHud();
    const st = { ...stats(), elapsed: Math.floor((Date.now() - S.startT) / 1000) };
    if (st.elapsed >= 5 && st.count > 0) { // only keep meaningful sessions
      const d = await chrome.storage.local.get(['history']);
      const h = d.history || [];
      h.unshift({ts: Date.now(), url: location.hostname, ...st});
      await chrome.storage.local.set({history: h.slice(0, 30)});
    }
    return st;
  }

  chrome.runtime.onMessage.addListener((msg, _s, send) => {
    (async () => {
      if (msg.cmd === 'start') { start(msg.wpp, msg.minH, msg.hud); send({ok: true}); }
      else if (msg.cmd === 'stop') send({ok: true, stats: await stop(false)});
      else if (msg.cmd === 'status') send({ok: true, tracking: S.tracking, hud: S.hudOn, ...stats()});
      else if (msg.cmd === 'hud') {
        S.hudOn = msg.on;
        if (S.tracking) { msg.on ? ensureHud() : removeHud(); }
        send({ok: true});
      }
    })();
    return true;
  });
})();
const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
