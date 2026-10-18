/* ============================================================================
 * HookPace — on-page timeline overlay (injected on explicit user click only)
 * Draws a floating, dismissible timeline bar via an isolated shadow DOM.
 * ========================================================================== */
(function () {
  'use strict';

  if (window.__hookpaceLoaded) return; // guard against double injection
  window.__hookpaceLoaded = true;

  const OVERLAY_ID = 'hookpace-timeline-overlay';

  function remove() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
  }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function draw(beats, duration, title, colors) {
    remove();
    const host = document.createElement('div');
    host.id = OVERLAY_ID;
    const shadow = host.attachShadow({ mode: 'open' });

    const markers = beats.map((b) => {
      const pct = Math.min(100, Math.max(0, (b.t / duration) * 100));
      const color = colors[b.type] || '#a78bfa';
      return `
        <div class="m" style="left:${pct}%;--c:${color}" title="${esc(b.label)} @ ${fmt(b.t)}">
          <span class="flag">${esc(b.label)}</span>
        </div>`;
    }).join('');

    shadow.innerHTML = `
      <style>
        .bar{
          position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;
          width:min(640px,92vw);background:rgba(11,11,16,.92);backdrop-filter:blur(10px);
          border:1px solid rgba(244,114,182,.4);border-radius:14px;padding:10px 14px 14px;
          font-family:"Segoe UI",system-ui,sans-serif;color:#f4f4f6;box-shadow:0 8px 32px rgba(0,0,0,.5);
        }
        .head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
        .t{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80%}
        .t b{color:#f472b6}
        .x{background:none;border:none;color:#9a9aa6;cursor:pointer;font-size:16px;line-height:1}
        .x:hover{color:#f87171}
        .track{position:relative;height:34px;background:rgba(255,255,255,.07);border-radius:8px}
        .m{position:absolute;top:4px;transform:translateX(-50%)}
        .m::before{content:"";display:block;width:10px;height:10px;border-radius:50%;background:var(--c);margin:0 auto}
        .m::after{content:"";display:block;width:2px;height:14px;background:var(--c);margin:0 auto;opacity:.8}
        .flag{position:absolute;top:26px;left:50%;transform:translateX(-50%);font-size:9px;color:#c9c9d4;
              background:rgba(0,0,0,.6);padding:1px 5px;border-radius:4px;white-space:nowrap}
        .note{margin-top:6px;font-size:10px;color:#9a9aa6}
      </style>
      <div class="bar">
        <div class="head">
          <div class="t"><b>HookPace</b> · ${esc(title || 'Session')} · ${beats.length} beats</div>
          <button class="x" title="Dismiss">×</button>
        </div>
        <div class="track">${markers}</div>
        <div class="note">Your logged beats — manual analysis, not a platform signal.</div>
      </div>`;

    shadow.querySelector('.x').addEventListener('click', remove);
    document.documentElement.appendChild(host);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'hookpace-draw') {
      draw(msg.beats || [], msg.duration || 60, msg.title || '', msg.colors || {});
    } else if (msg.action === 'hookpace-clear') {
      remove();
    }
  });
})();
