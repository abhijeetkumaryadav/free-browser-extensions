/* Feed Diversity Companion — popup logic.
   Honest scope: all stats are computed from sightings the user logs manually.
   Nothing here reads feeds, platforms, or algorithms. */
'use strict';

const KEY = 'feedDiversity.v1';

/* ---------- storage ---------- */
async function loadState() {
  const d = await chrome.storage.local.get(KEY);
  return d[KEY] || { sightings: [], lastReflected: null };
}
async function saveState(s) { await chrome.storage.local.set({ [KEY]: s }); }

/* ---------- stats ---------- */
// Herfindahl-Hirschman Index of source shares, scaled 0–100.
function computeStats(sightings) {
  const n = sightings.length;
  const bySource = {};
  const byCat = {};
  for (const s of sightings) {
    const k = (s.source || 'Unknown').toLowerCase();
    bySource[k] = bySource[k] || { name: s.source || 'Unknown', count: 0 };
    bySource[k].count++;
    byCat[s.category || 'Other'] = (byCat[s.category || 'Other'] || 0) + 1;
  }
  const sources = Object.values(bySource).sort((a, b) => b.count - a.count);
  let hhi = 0;
  if (n > 0) {
    hhi = sources.reduce((acc, s) => acc + Math.pow((s.count / n) * 100, 2), 0) / 100; // 0..100
  }
  const topShare = n > 0 ? (sources[0].count / n) * 100 : 0;
  return { n, sources, byCat, hhi, topShare };
}

/* ---------- render ---------- */
function renderStats(stats) {
  const ring = document.getElementById('concentrationRing');
  const deg = Math.round((stats.hhi / 100) * 360);
  ring.style.background = `conic-gradient(var(--accent) ${deg}deg, #2a2c3a ${deg}deg)`;
  document.getElementById('hhiNum').textContent = stats.n ? stats.hhi.toFixed(0) : '–';
  document.getElementById('stSightings').textContent = stats.n;
  document.getElementById('stSources').textContent = stats.sources.length;
  document.getElementById('stTopShare').textContent = stats.n ? stats.topShare.toFixed(0) + '%' : '–';

  // top sources
  const list = document.getElementById('sourceList');
  if (!stats.sources.length) {
    list.innerHTML = '<p class="empty">No sightings logged yet. Log what your feed shows you.</p>';
  } else {
    list.innerHTML = stats.sources.slice(0, 6).map(s => {
      const pct = ((s.count / stats.n) * 100).toFixed(0);
      return `<div class="row"><span class="name">${escapeHtml(s.name)}</span>
        <span class="bar"><i style="width:${pct}%"></i></span>
        <span class="pct">${pct}%</span></div>`;
    }).join('');
  }

  // category mix
  const catBox = document.getElementById('catMix');
  const cats = Object.entries(stats.byCat).sort((a, b) => b[1] - a[1]);
  catBox.innerHTML = cats.length
    ? cats.map(([c, v]) => {
        const pct = ((v / stats.n) * 100).toFixed(0);
        return `<div class="row"><span class="name">${escapeHtml(c)}</span>
          <span class="bar"><i style="width:${pct}%"></i></span>
          <span class="pct">${pct}%</span></div>`;
      }).join('')
    : '<p class="empty">Categories appear after you log sightings.</p>';

  // nudge
  const nudge = document.getElementById('nudgeBox');
  if (stats.n >= 10 && stats.topShare >= 40) {
    nudge.hidden = false;
    const top = stats.sources[0];
    nudge.innerHTML = `<strong>Diversity nudge:</strong> ${escapeHtml(top.name)} accounts for <strong>${stats.topShare.toFixed(0)}%</strong> of your logged sightings. Try following one new source outside your usual mix this week — variety is how a diet stays healthy.`;
  } else if (stats.n >= 10 && stats.hhi <= 20) {
    nudge.hidden = false;
    nudge.innerHTML = `<strong>Looking balanced:</strong> your logged sightings are spread across many sources. Keep it up — and remember this only reflects what you chose to log.`;
  } else {
    nudge.hidden = true;
  }
}

function renderReflection(stats, lastReflected) {
  const box = document.getElementById('reflection');
  if (stats.n < 5) {
    box.innerHTML = '<p class="empty">Log sightings for a few days, then come back for your weekly reflection.</p>';
    return;
  }
  const week = stats.sources.slice(0, 3).map(s => escapeHtml(s.name)).join(', ');
  const refl = lastReflected
    ? `<p>Last reflected: <strong>${new Date(lastReflected).toLocaleDateString()}</strong></p>`
    : '<p>You have not marked a reflection yet.</p>';
  box.innerHTML = `
    ${refl}
    <ul>
      <li>Top sources in your log: <strong>${week}</strong>.</li>
      <li>Concentration score: <strong>${stats.hhi.toFixed(0)}</strong> — lower is more varied.</li>
      <li>Ask yourself: is there a perspective missing from this list? One new follow can shift next week's score.</li>
      <li>Reminder: these numbers come only from <strong>your own logged sightings</strong> — they describe your attention, not any platform's algorithm.</li>
    </ul>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- wiring ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  // tabs
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('tab-' + t.dataset.tab).classList.add('active');
  }));

  const state = await loadState();
  const stats = computeStats(state.sightings);
  renderStats(stats);
  renderReflection(stats, state.lastReflected);

  // default date = today
  document.getElementById('fDate').valueAsDate = new Date();

  // add sighting
  document.getElementById('addBtn').addEventListener('click', async () => {
    const source = document.getElementById('fSource').value.trim();
    if (!source) { document.getElementById('fSource').focus(); return; }
    const s = await loadState();
    s.sightings.push({
      source,
      platform: document.getElementById('fPlatform').value,
      category: document.getElementById('fCat').value,
      date: document.getElementById('fDate').value || new Date().toISOString().slice(0, 10),
      ts: Date.now()
    });
    await saveState(s);
    document.getElementById('fSource').value = '';
    const stats2 = computeStats(s.sightings);
    renderStats(stats2);
    renderReflection(stats2, s.lastReflected);
    // jump to dashboard
    document.querySelector('.tab[data-tab="dash"]').click();
  });

  // mark reflected
  document.getElementById('markReflectBtn').addEventListener('click', async () => {
    const s = await loadState();
    s.lastReflected = Date.now();
    await saveState(s);
    renderReflection(computeStats(s.sightings), s.lastReflected);
  });

  // export
  document.getElementById('exportBtn').addEventListener('click', async () => {
    const s = await loadState();
    const blob = new Blob([JSON.stringify(s.sightings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'feed-diversity-log.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // clear
  document.getElementById('clearBtn').addEventListener('click', async () => {
    if (confirm('Delete all logged sightings?')) {
      await saveState({ sightings: [], lastReflected: null });
      renderStats(computeStats([]));
      renderReflection(computeStats([]), null);
    }
  });
});
