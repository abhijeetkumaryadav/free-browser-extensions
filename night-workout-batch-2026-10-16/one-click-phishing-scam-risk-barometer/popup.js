/* PhishBarometer popup logic — on-demand scan, local scoring, gauge rendering. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const scanBtn = $('scanBtn');
  const resultsEl = $('results');

  const WEIGHTS = { high: 25, medium: 12, low: 5 };
  const ARC_LEN = 251.3; // length of the semicircle path in the SVG

  // Show the active tab's URL as context
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url) {
      try {
        const u = new URL(tab.url);
        $('pageUrl').textContent = u.hostname + (u.pathname !== '/' ? u.pathname : '');
      } catch (e) { $('pageUrl').textContent = tab.url; }
    }
  });

  scanBtn.addEventListener('click', async () => {
    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning…';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) throw new Error('no-tab');
      const injected = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      const signals = (injected && injected[0] && injected[0].result) || [];
      render(signals);
    } catch (err) {
      // Scripting can fail on protected pages (chrome://, web store, etc.)
      render([{
        id: 'scan-blocked', severity: 'low',
        title: 'Could not scan this page',
        detail: 'Browser-protected pages (new tab, settings, web store) cannot be scanned by extensions. This is normal.'
      }]);
    } finally {
      scanBtn.disabled = false;
      scanBtn.textContent = 'Scan this page';
    }
  });

  function scoreOf(signals) {
    // Ignore the "scan-blocked" pseudo-signal in scoring
    const real = signals.filter((s) => s.id !== 'scan-blocked');
    return Math.min(100, real.reduce((sum, s) => sum + (WEIGHTS[s.severity] || 0), 0));
  }

  function verdictFor(score) {
    if (score >= 71) return ['critical', 'Critical risk'];
    if (score >= 46) return ['high', 'High risk'];
    if (score >= 21) return ['moderate', 'Moderate risk'];
    return ['low', 'Low risk'];
  }

  function render(signals) {
    const score = scoreOf(signals);
    const [cls, label] = verdictFor(score);

    // Gauge: rotate needle + reveal colored arc proportionally
    const angle = 180 - (score / 100) * 180; // 180 (left) -> 0 (right)
    const needle = $('needle');
    needle.setAttribute('transform', `rotate(${angle - 90} 100 105)`);
    // arc draws from left (0) to right; dashoffset shrinks as score grows
    $('gaugeArc').setAttribute('stroke-dashoffset', String(ARC_LEN * (1 - score / 100)));

    // Animate the number counting up
    const numEl = $('scoreNum');
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 600);
      numEl.textContent = String(Math.round(score * p));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    const v = $('verdict');
    v.className = 'verdict ' + cls;
    v.textContent = label;

    // Signal list
    const list = $('signals');
    list.innerHTML = '';
    const real = signals.filter((s) => s.id !== 'scan-blocked');
    const blocked = signals.find((s) => s.id === 'scan-blocked');
    $('sigCount').textContent = real.length ? `(${real.length})` : '';
    $('allClear').hidden = real.length !== 0 || blocked != null;

    const order = { high: 0, medium: 1, low: 2 };
    real.sort((a, b) => order[a.severity] - order[b.severity]);
    for (const s of real) {
      const li = document.createElement('li');
      li.className = 'signal';
      const sev = document.createElement('span');
      sev.className = 'sev ' + s.severity;
      sev.textContent = s.severity;
      const h = document.createElement('h3');
      h.textContent = s.title;
      const p = document.createElement('p');
      p.textContent = s.detail;
      li.append(sev, h, p);
      list.appendChild(li);
    }
    if (blocked) {
      const li = document.createElement('li');
      li.className = 'signal';
      const h = document.createElement('h3');
      h.textContent = blocked.title;
      const p = document.createElement('p');
      p.textContent = blocked.detail;
      li.append(h, p);
      list.appendChild(li);
    }

    resultsEl.hidden = false;
  }
})();
