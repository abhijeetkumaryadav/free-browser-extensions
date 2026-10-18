/* Popup controller: triggers measurement, renders grades + shift contributors. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const measureBtn = $('measureBtn'), clearBtn = $('clearBtn'), statusEl = $('status');

  // Thresholds per web.dev (good max / poor min)
  const DEFS = {
    lcp: { label: 'LCP', full: 'Largest Contentful Paint', goodMax: 2500, poorMin: 4000, unit: 'ms',
      desc: 'Time until the largest content element is painted. <b>Good ≤ 2.5 s</b> · Poor > 4.0 s' },
    inp: { label: 'INP', full: 'Interaction to Next Paint', goodMax: 200, poorMin: 500, unit: 'ms',
      desc: 'Worst observed interaction latency. <b>Good ≤ 200 ms</b> · Poor > 500 ms' },
    cls: { label: 'CLS', full: 'Cumulative Layout Shift', goodMax: 0.1, poorMin: 0.25, unit: '',
      desc: 'Total unexpected layout movement. <b>Good ≤ 0.10</b> · Poor > 0.25' },
  };
  const GRADE_WORD = { good: '✓', needs: '!', poor: '✕', unknown: '–' };
  const GRADE_CLASS = { good: 'good', needs: 'needs', poor: 'poor', unknown: '' };

  function fmt(key, v) {
    if (v == null) return '—';
    if (key === 'lcp') return (v / 1000).toFixed(2) + ' s';
    if (key === 'inp') return v + ' ms';
    return v.toFixed(3);
  }

  function barWidth(key, v) {
    if (v == null) return 0;
    const d = DEFS[key];
    const span = d.poorMin * 1.5;
    return Math.max(4, Math.min(100, (v / span) * 100));
  }

  function render(result) {
    $('results').classList.remove('hidden');
    clearBtn.classList.remove('hidden');
    const box = $('metrics');
    box.innerHTML = '';

    const grades = ['lcp', 'inp', 'cls'].map((k) => result.grades[k]);
    const worst = grades.includes('poor') ? 'poor' : grades.includes('needs') ? 'needs' : grades.includes('good') ? 'good' : 'unknown';
    $('overallGrade').textContent = GRADE_WORD[worst];
    $('overallGrade').className = 'overall-grade ' + GRADE_CLASS[worst];
    $('overallLabel').textContent =
      worst === 'good' ? 'Solid experience — all measured vitals are in the good range.' :
      worst === 'needs' ? 'Room to improve — at least one vital needs work.' :
      worst === 'poor' ? 'Needs attention — at least one vital is in the poor range.' :
      'Not enough data — interact with the page, then measure again.';

    for (const key of ['lcp', 'inp', 'cls']) {
      const d = DEFS[key], g = result.grades[key], v = result[key];
      const el = document.createElement('div');
      el.className = 'metric';
      el.innerHTML =
        '<div class="metric-head"><span class="metric-name"><span class="abbr">' + d.label + '</span>' + d.full + '</span>' +
        '<span class="metric-value ' + GRADE_CLASS[g] + '">' + fmt(key, v) + '</span></div>' +
        '<div class="bar"><div class="bar-fill ' + GRADE_CLASS[g] + '" style="width:' + barWidth(key, v) + '%"></div></div>' +
        '<div class="thresholds">' + d.desc + '</div>';
      box.appendChild(el);
    }

    if (keyDetail(result, 'lcpElement')) {
      const el = document.createElement('div');
      el.className = 'shifter';
      el.innerHTML = '<div class="shifter-el">Largest paint: ' + escapeHtml(result.lcpElement) + '</div>' +
        '<div class="shifter-meta">The element that painted last — optimise this to improve LCP.</div>';
      box.appendChild(el);
    }

    const sbox = $('shifters');
    sbox.innerHTML = '';
    if (!result.topShifters.length) {
      sbox.innerHTML = '<div class="shifter"><div class="shifter-meta">No unexpected layout shifts detected on this visit. 🎉</div></div>';
    } else {
      for (const s of result.topShifters) {
        const el = document.createElement('div');
        el.className = 'shifter';
        el.innerHTML = '<div class="shifter-el">' + escapeHtml(s.el) + '</div>' +
          '<div class="shifter-meta">Shift score contribution: ' + s.value + ' — give moving elements fixed sizes.</div>';
        sbox.appendChild(el);
      }
    }
  }

  function keyDetail() { return true; }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function measure() {
    measureBtn.disabled = true;
    statusEl.className = 'status';
    statusEl.textContent = 'Measuring… recording real performance entries (up to ~6 s)…';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found.');
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Measurement timed out.')), 25000);
        const listener = (msg) => {
          if (msg?.type === 'CWV_RESULT') {
            clearTimeout(timer);
            chrome.runtime.onMessage.removeListener(listener);
            resolve(msg.result);
          }
        };
        chrome.runtime.onMessage.addListener(listener);
        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }).catch((e) => {
          clearTimeout(timer);
          chrome.runtime.onMessage.removeListener(listener);
          reject(e);
        });
      });
      if (!result?.ok) throw new Error(result?.error || 'Measurement failed.');
      await chrome.storage.local.set({ cwvLast: { when: Date.now(), result } });
      render(result);
      statusEl.className = 'status';
      statusEl.textContent = 'Measured on this visit — values are real, from this device and network.';
    } catch (e) {
      statusEl.className = 'status error';
      statusEl.textContent = 'Measurement failed: ' + (e?.message || e);
    } finally {
      measureBtn.disabled = false;
    }
  }

  async function clearOverlay() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.getElementById('__cwv_overlay__')?.remove(),
      });
      statusEl.textContent = 'Overlay removed.';
    } catch (e) { /* page may not allow injection */ }
  }

  measureBtn.addEventListener('click', measure);
  clearBtn.addEventListener('click', clearOverlay);

  // Restore last measurement on open
  (async () => {
    const { cwvLast } = await chrome.storage.local.get('cwvLast');
    if (cwvLast?.result?.ok) {
      render(cwvLast.result);
      statusEl.textContent = 'Restored the last measurement from this browser. Values reflect that visit.';
    }
  })();
})();
