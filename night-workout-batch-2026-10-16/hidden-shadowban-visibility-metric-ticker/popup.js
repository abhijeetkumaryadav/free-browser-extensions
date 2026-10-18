/* Visibility Health Diary — popup logic.
   Honest scope: charts only what the user logs from their own analytics.
   Drop flags are speculative prompts for reflection — never diagnoses,
   and the tool cannot detect shadowbans. */
'use strict';

const KEY = 'visibilityDiary.v1';

async function loadState() {
  const d = await chrome.storage.local.get(KEY);
  return d[KEY] || { posts: [] };
}
async function saveState(s) { await chrome.storage.local.set({ [KEY]: s }); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
}

/* ---------- dashboard ---------- */
function renderDashboard(posts) {
  const sorted = [...posts].sort((a, b) => a.ts - b.ts);
  document.getElementById('stPosts').textContent = posts.length;

  const last10 = sorted.slice(-10);
  const avgReach = last10.length
    ? last10.reduce((a, p) => a + (Number(p.reach) || 0), 0) / last10.length : null;
  document.getElementById('stAvgReach').textContent = avgReach == null ? '–' : fmt(avgReach);

  const engRates = last10
    .filter(p => (Number(p.reach) || 0) > 0)
    .map(p => ((Number(p.likes) || 0) + (Number(p.comments) || 0) + (Number(p.saves) || 0)) / Number(p.reach) * 100);
  document.getElementById('stEng').textContent =
    engRates.length ? (engRates.reduce((a, b) => a + b, 0) / engRates.length).toFixed(1) + '%' : '–';

  drawChart(sorted.slice(-20));
  renderDropFlag(sorted);
}

/* SVG line chart of reach (last 20 posts) */
function drawChart(posts) {
  const svg = document.getElementById('chart');
  const W = 340, H = 140, pad = 24;
  if (!posts.length) {
    svg.innerHTML = `<text x="${W / 2}" y="${H / 2}" fill="#9aa0b4" font-size="11" text-anchor="middle">Log posts to see your reach trend</text>`;
    return;
  }
  const maxR = Math.max(...posts.map(p => Number(p.reach) || 0), 1);
  const X = i => pad + (i * (W - pad * 2)) / Math.max(posts.length - 1, 1);
  const Y = r => H - pad - ((r / maxR) * (H - pad * 2));
  const pts = posts.map((p, i) => `${X(i).toFixed(1)},${Y(Number(p.reach) || 0).toFixed(1)}`).join(' ');
  const area = `${pad},${H - pad} ${pts} ${X(posts.length - 1).toFixed(1)},${H - pad}`;
  const dots = posts.map((p, i) =>
    `<circle cx="${X(i).toFixed(1)}" cy="${Y(Number(p.reach) || 0).toFixed(1)}" r="3.2" fill="#34d399">
       <title>${escapeHtml(p.label)} — reach ${fmt(p.reach)}</title></circle>`).join('');
  svg.innerHTML = `
    <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#34d399" stop-opacity=".35"/>
      <stop offset="1" stop-color="#34d399" stop-opacity="0"/></linearGradient></defs>
    <polygon points="${area}" fill="url(#rg)"/>
    <polyline points="${pts}" fill="none" stroke="#34d399" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <text x="${pad}" y="${H - 8}" fill="#9aa0b4" font-size="9">${posts.length > 1 ? 'oldest → newest' : ''}</text>
    <text x="${W - pad}" y="${pad - 8}" fill="#9aa0b4" font-size="9" text-anchor="end">max ${fmt(maxR)}</text>`;
}

/* Speculative drop flagging — labeled as prompts, never diagnoses */
function renderDropFlag(sorted) {
  const box = document.getElementById('dropBox');
  if (sorted.length < 6) {
    box.innerHTML = sorted.length >= 2
      ? '<div class="healthy">Keep logging — drop patterns need at least 6 posts to mean anything.</div>'
      : '';
    return;
  }
  const recent = sorted.slice(-3);
  const baseline = sorted.slice(-9, -3);
  const rAvg = recent.reduce((a, p) => a + (Number(p.reach) || 0), 0) / recent.length;
  const bAvg = baseline.reduce((a, p) => a + (Number(p.reach) || 0), 0) / baseline.length;
  if (bAvg > 0 && rAvg < bAvg * 0.5) {
    const drop = ((1 - rAvg / bAvg) * 100).toFixed(0);
    box.innerHTML = `<div class="flag"><strong>Reach dip noticed (${drop}% below your recent baseline).</strong>
      This is <strong>not</strong> a shadowban diagnosis — it is a prompt to reflect. Speculative, common causes of dips:
      <ul>
        <li>Posting time, day-of-week, or frequency changed</li>
        <li>Format or topic shifted away from what your audience expects</li>
        <li>Platform-wide seasonal or algorithmic shifts</li>
        <li>Smaller sample: only 3 recent posts vs 6 baseline posts</li>
      </ul>
      Check your diary notes above for patterns, and give it a few more posts before concluding anything.</div>`;
  } else {
    box.innerHTML = '<div class="healthy">No concerning dip vs your recent baseline. Reach fluctuates — trends over weeks matter more than single posts.</div>';
  }
}

/* ---------- posts list ---------- */
function renderPosts(posts) {
  const box = document.getElementById('postList');
  const sorted = [...posts].sort((a, b) => b.ts - a.ts);
  if (!sorted.length) { box.innerHTML = '<p class="empty">No posts logged yet.</p>'; return; }
  box.innerHTML = sorted.map((p, i) => {
    const eng = (Number(p.reach) || 0) > 0
      ? (((Number(p.likes) || 0) + (Number(p.comments) || 0) + (Number(p.saves) || 0)) / Number(p.reach) * 100).toFixed(1) + '% eng.'
      : '';
    return `<div class="prow">
      <div class="top"><span class="name">${escapeHtml(p.label)}</span><span class="reach">${fmt(p.reach)} reach</span></div>
      <div class="meta">${escapeHtml(p.platform)} · ${escapeHtml(p.date)} · ${Number(p.likes) || 0} likes · ${Number(p.comments) || 0} comments · ${Number(p.saves) || 0} saves ${eng ? '· ' + eng : ''}</div>
      ${p.note ? `<div class="note">“${escapeHtml(p.note)}”</div>` : ''}
      <button class="del" data-i="${i}">delete</button>
    </div>`;
  }).join('');
  box.querySelectorAll('.del').forEach(btn => btn.addEventListener('click', async () => {
    const s = await loadState();
    const target = sorted[Number(btn.dataset.i)];
    s.posts = s.posts.filter(p => p.ts !== target.ts);
    await saveState(s);
    refresh(s.posts);
  }));
}

function refresh(posts) { renderDashboard(posts); renderPosts(posts); }

/* ---------- wiring ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('tab-' + t.dataset.tab).classList.add('active');
  }));

  const state = await loadState();
  refresh(state.posts);
  document.getElementById('fDate').valueAsDate = new Date();

  document.getElementById('addBtn').addEventListener('click', async () => {
    const label = document.getElementById('fLabel').value.trim();
    const reach = Number(document.getElementById('fReach').value);
    if (!label || !(reach >= 0) || document.getElementById('fReach').value === '') {
      (label ? document.getElementById('fReach') : document.getElementById('fLabel')).focus();
      return;
    }
    const s = await loadState();
    s.posts.push({
      label,
      platform: document.getElementById('fPlatform').value,
      date: document.getElementById('fDate').value || new Date().toISOString().slice(0, 10),
      reach,
      likes: Number(document.getElementById('fLikes').value) || 0,
      comments: Number(document.getElementById('fComments').value) || 0,
      saves: Number(document.getElementById('fSaves').value) || 0,
      note: document.getElementById('fNote').value.trim(),
      ts: Date.now()
    });
    await saveState(s);
    ['fLabel', 'fReach', 'fLikes', 'fComments', 'fSaves', 'fNote'].forEach(id => document.getElementById(id).value = '');
    refresh(s.posts);
    document.querySelector('.tab[data-tab="dash"]').click();
  });

  document.getElementById('exportBtn').addEventListener('click', async () => {
    const s = await loadState();
    const blob = new Blob([JSON.stringify(s.posts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'visibility-diary.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  document.getElementById('clearBtn').addEventListener('click', async () => {
    if (confirm('Delete all logged posts?')) {
      await saveState({ posts: [] });
      refresh([]);
    }
  });
});
