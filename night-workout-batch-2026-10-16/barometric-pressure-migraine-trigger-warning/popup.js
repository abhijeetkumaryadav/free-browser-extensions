/* Pressure & Migraine Journal — pure engine between ENGINE markers; UI glue outside. */
'use strict';

/* // ENGINE-START */
function makeEntry(pressure, migraine, note, ts) {
  const p = parseFloat(pressure);
  if (!(p >= 800 && p <= 1100)) return null;               // plausible hPa range
  if (!['none','mild','moderate','severe'].includes(migraine)) return null;
  return { pressure: Math.round(p * 10) / 10, migraine, note: String(note || '').slice(0,120), ts: ts || Date.now() };
}

// Simple pattern summary over the last 30 days:
// average pressure on migraine days vs non-migraine days, and episode rate on falling/rising/steady pressure.
function summarize(entries) {
  const cutoff = Date.now() - 30 * 864e5;
  const recent = entries.filter(e => e.ts >= cutoff).sort((a, b) => a.ts - b.ts);
  const mig = recent.filter(e => e.migraine !== 'none');
  const nomig = recent.filter(e => e.migraine === 'none');
  const avg = arr => arr.length ? arr.reduce((s, e) => s + e.pressure, 0) / arr.length : null;

  // pressure trend buckets from consecutive readings
  const buckets = { falling: 0, fallingMig: 0, rising: 0, risingMig: 0, steady: 0, steadyMig: 0 };
  for (let i = 1; i < recent.length; i++) {
    const d = recent[i].pressure - recent[i - 1].pressure;
    const k = d < -1.5 ? 'falling' : d > 1.5 ? 'rising' : 'steady';
    buckets[k]++;
    if (recent[i].migraine !== 'none') buckets[k + 'Mig']++;
  }
  return {
    count: recent.length, migCount: mig.length,
    avgMig: avg(mig), avgNoMig: avg(nomig), buckets
  };
}

function fmtWhen(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
/* // ENGINE-END */

const MIG_LABEL = { none: 'No episode', mild: 'Mild', moderate: 'Moderate', severe: 'Severe' };

document.addEventListener('DOMContentLoaded', () => {
  const pressure = document.getElementById('pressure');
  const migraine = document.getElementById('migraine');
  const note = document.getElementById('note');
  const corr = document.getElementById('corr');
  const history = document.getElementById('history');

  chrome.storage.local.get(['entries'], (d) => render(d.entries || []));

  document.getElementById('logBtn').addEventListener('click', () => {
    const e = makeEntry(pressure.value, migraine.value, note.value);
    if (!e) { alert('Enter a pressure between 800 and 1100 hPa.'); return; }
    chrome.storage.local.get(['entries'], (d) => {
      const entries = [e, ...(d.entries || [])].slice(0, 500);
      chrome.storage.local.set({ entries }, () => {
        render(entries);
        pressure.value = ''; note.value = ''; migraine.value = 'none';
      });
    });
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Delete all logged readings?')) chrome.storage.local.set({ entries: [] }, () => render([]));
  });

  function render(entries) {
    // Correlation view
    const s = summarize(entries);
    if (s.count < 3) {
      corr.textContent = `No data yet — log at least 3 readings to see a pattern. (${s.count}/3)`;
    } else {
      const r = (n) => n == null ? '—' : n.toFixed(1) + ' hPa';
      let txt = `${s.migCount} of ${s.count} readings had episodes. ` +
        `Avg pressure on episode days: ${r(s.avgMig)}; on non-episode days: ${r(s.avgNoMig)}.`;
      const b = s.buckets;
      const rate = (k) => b[k] ? ` · ${k}: ${Math.round(b[k + 'Mig'] / b[k] * 100)}% of ${b[k]} readings` : '';
      txt += rate('falling') + rate('rising') + rate('steady');
      corr.textContent = txt + ' — discuss patterns with your clinician.';
    }

    // History
    history.innerHTML = '';
    entries.slice(0, 50).forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'entry';
      row.innerHTML = `<span><b>${e.pressure} hPa</b> <span class="mig ${e.migraine}">${MIG_LABEL[e.migraine]}</span><br><span class="when">${fmtWhen(e.ts)}${e.note ? ' · ' + escapeHtml(e.note) : ''}</span></span>`;
      const del = document.createElement('button');
      del.className = 'del'; del.textContent = '×'; del.title = 'Delete';
      del.addEventListener('click', () => {
        entries.splice(i, 1);
        chrome.storage.local.set({ entries }, () => render(entries));
      });
      row.appendChild(del);
      history.appendChild(row);
    });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
});
