/* Content script: measures real Core Web Vitals on the page using
   PerformanceObserver (LCP via largest-contentful-paint, INP approximation
   via event timing, CLS via layout-shift). Injected on demand only.
   Draws a dismissible graded overlay + reports results to the popup.
   Read-only w.r.t. the page's own content — overlay is a single injected
   layer that can be removed. */
(() => {
  'use strict';

  const OVERLAY_ID = '__cwv_overlay__';

  function describe(el) {
    if (!el || !el.tagName) return '(unknown element)';
    const t = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const cls = (typeof el.className === 'string' ? el.className : '')
      .split(/\s+/).filter(Boolean).slice(0, 2).map((c) => '.' + c).join('');
    return t + id + cls;
  }

  function removeOverlay() {
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function grade(value, goodMax, poorMin) {
    if (value == null) return 'unknown';
    if (value <= goodMax) return 'good';
    if (value <= poorMin) return 'needs';
    return 'poor';
  }

  (async () => {
    removeOverlay();

    const supported = typeof PerformanceObserver === 'function';
    if (!supported) {
      chrome.runtime.sendMessage({ type: 'CWV_RESULT', result: { ok: false, error: 'PerformanceObserver is not available in this page.' } });
      return;
    }

    let lcp = null, lcpEl = null, inp = null, cls = 0;
    const shifters = new Map(); // desc -> total value

    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.entryType === 'largest-contentful-paint') { lcp = e.startTime; lcpEl = e.element || null; }
          else if (e.entryType === 'event') {
            const dur = e.duration || 0;
            if (dur > (inp || 0)) inp = dur;
          }
          else if (e.entryType === 'layout-shift' && !e.hadRecentInput) {
            cls += e.value;
            for (const s of e.sources || []) {
              const d = describe(s.node);
              shifters.set(d, (shifters.get(d) || 0) + e.value * (s.previousRect && s.currentRect ? 1 : 1));
            }
          }
        }
      });
      // buffered:true picks up entries from the initial page load
      try { po.observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
      try { po.observe({ type: 'event', buffered: true }); } catch {}
      try { po.observe({ type: 'layout-shift', buffered: true }); } catch {}

      // Observe for a few seconds more to catch late shifts / paints
      await new Promise((r) => setTimeout(r, 6000));
      po.disconnect();
    } catch (e) {
      chrome.runtime.sendMessage({ type: 'CWV_RESULT', result: { ok: false, error: String(e && e.message || e) } });
      return;
    }

    const gLcp = grade(lcp, 2500, 4000);
    const gInp = inp == null ? 'unknown' : grade(inp, 200, 500);
    const gCls = grade(cls, 0.1, 0.25);

    const topShifters = [...shifters.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([el, v]) => ({ el, value: Math.round(v * 1000) / 1000 }));

    // --- overlay ---
    const box = document.createElement('div');
    box.id = OVERLAY_ID;
    const badge = (g) => ({ good: 'GOOD', needs: 'NEEDS WORK', poor: 'POOR', unknown: 'N/A' }[g]);
    const color = (g) => ({ good: '#34d399', needs: '#fbbf24', poor: '#f87171', unknown: '#94a3b8' }[g]);
    const row = (name, val, g) =>
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08)">' +
      '<span style="font-weight:700;font-size:13px">' + name + '</span>' +
      '<span style="font-size:13px;font-weight:700;color:' + color(g) + '">' + val + ' · ' + badge(g) + '</span></div>';

    box.innerHTML =
      '<div style="font-size:14px;font-weight:800;margin-bottom:8px;color:#34d399">⚡ Core Web Vitals — measured on this visit</div>' +
      row('LCP (largest paint)', lcp == null ? '—' : (lcp / 1000).toFixed(2) + ' s', gLcp) +
      row('INP (worst interaction)', inp == null ? 'no input yet' : Math.round(inp) + ' ms', gInp) +
      row('CLS (layout shift)', cls.toFixed(3), gCls) +
      '<div style="font-size:11px;color:#94a3b8;margin-top:8px;line-height:1.5">Measured locally on this page load via PerformanceObserver. Values vary by device & network.</div>' +
      '<button id="__cwv_close__" style="margin-top:10px;background:#34d399;border:none;border-radius:8px;color:#06281e;font-weight:700;padding:8px 14px;cursor:pointer;font-size:12px">Dismiss</button>';

    box.style.cssText =
      'position:fixed;top:16px;right:16px;z-index:2147483647;width:320px;' +
      'background:rgba(15,18,24,.94);color:#f1f5f9;border:1px solid rgba(255,255,255,.14);' +
      'border-radius:14px;padding:14px 16px;font-family:-apple-system,"Segoe UI",Inter,sans-serif;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.5);backdrop-filter:blur(8px)';
    document.documentElement.appendChild(box);
    box.querySelector('#__cwv_close__').addEventListener('click', removeOverlay);

    chrome.runtime.sendMessage({
      type: 'CWV_RESULT',
      result: {
        ok: true, url: location.href,
        lcp: lcp == null ? null : Math.round(lcp),
        inp: inp == null ? null : Math.round(inp),
        cls: Math.round(cls * 1000) / 1000,
        grades: { lcp: gLcp, inp: gInp, cls: gCls },
        lcpElement: describe(lcpEl),
        topShifters,
      },
    });
  })();
})();
