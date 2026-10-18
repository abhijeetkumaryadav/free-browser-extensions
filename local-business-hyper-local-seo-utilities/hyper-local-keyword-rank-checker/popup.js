/* Hyper-Local Keyword Rank Tracker — manual rank logging, 100% on-device.
 * This extension NEVER scrapes Google or any search engine. You check
 * rankings yourself and log the positions here; it renders trends. */
'use strict';

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'rankTracker.keywords';

/* ------------------------------------------------------------------ */
/* Storage                                                              */
/* ------------------------------------------------------------------ */

async function loadKeywords() {
  const d = await chrome.storage.local.get(STORE_KEY);
  return Array.isArray(d[STORE_KEY]) ? d[STORE_KEY] : [];
}

async function saveKeywords(kws) {
  await chrome.storage.local.set({ [STORE_KEY]: kws });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Entries sorted oldest -> newest by date.
function sortedEntries(kw) {
  return [...(kw.entries || [])].sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------------------------------------------ */
/* Movement                                                             */
/* ------------------------------------------------------------------ */

// Returns { dir: 'up'|'down'|'flat'|null, delta } comparing last two entries.
function movement(kw) {
  const e = sortedEntries(kw);
  if (e.length < 2) return { dir: null, delta: 0 };
  const delta = e[e.length - 2].pos - e[e.length - 1].pos; // lower pos = better
  if (delta > 0) return { dir: 'up', delta };
  if (delta < 0) return { dir: 'down', delta: -delta };
  return { dir: 'flat', delta: 0 };
}

function moveBadge(m) {
  if (!m.dir) return '<span class="move flat">new</span>';
  if (m.dir === 'up') return `<span class="move up">▲ ${m.delta}</span>`;
  if (m.dir === 'down') return `<span class="move down">▼ ${m.delta}</span>`;
  return '<span class="move flat">— 0</span>';
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* List view                                                            */
/* ------------------------------------------------------------------ */

async function renderList() {
  const kws = await loadKeywords();
  const ul = $('kwList');
  ul.innerHTML = '';
  if (!kws.length) {
    ul.innerHTML = '<li class="empty">No keywords yet — add your first one above.</li>';
    return;
  }
  // Sort: most recently updated first.
  const ordered = [...kws].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  ordered.forEach((kw) => {
    const e = sortedEntries(kw);
    const latest = e.length ? e[e.length - 1].pos : null;
    const li = document.createElement('li');
    li.className = 'kw';
    li.innerHTML =
      `<div class="meta"><div class="k">${escapeHtml(kw.keyword)}</div>` +
      `<div class="l">${escapeHtml(kw.location)} · ${e.length} check${e.length === 1 ? '' : 's'}</div></div>` +
      (latest === null
        ? '<span class="pos na">no data</span>'
        : `<span class="pos">#${latest}</span>${moveBadge(movement(kw))}`);
    li.addEventListener('click', () => openDetail(kw.id));
    ul.appendChild(li);
  });
}

$('addKw').addEventListener('click', async () => {
  const keyword = $('kw').value.trim();
  const location = $('loc').value.trim();
  if (!keyword || !location) {
    $('kw').focus();
    return;
  }
  const kws = await loadKeywords();
  kws.push({ id: uid(), keyword, location, entries: [], createdAt: Date.now(), updatedAt: Date.now() });
  await saveKeywords(kws);
  $('kw').value = '';
  $('loc').value = '';
  renderList();
});

/* ------------------------------------------------------------------ */
/* Detail view                                                          */
/* ------------------------------------------------------------------ */

let currentId = null;

async function getCurrent() {
  const kws = await loadKeywords();
  return { kws, kw: kws.find((k) => k.id === currentId) };
}

async function openDetail(id) {
  currentId = id;
  $('listView').classList.add('hidden');
  $('detailView').classList.remove('hidden');
  $('eDate').value = todayISO();
  await renderDetail();
}

$('back').addEventListener('click', async () => {
  currentId = null;
  $('detailView').classList.add('hidden');
  $('listView').classList.remove('hidden');
  renderList();
});

async function renderDetail() {
  const { kw } = await getCurrent();
  if (!kw) { $('back').click(); return; }
  $('dTitle').textContent = kw.keyword;
  $('dSub').textContent = `${kw.location} — log positions you check manually; this tool never scrapes search engines.`;

  const e = sortedEntries(kw);
  if (!e.length) {
    $('dLatest').textContent = '—';
    $('dBest').textContent = '—';
    $('dMove').innerHTML = '—';
  } else {
    const latest = e[e.length - 1].pos;
    const best = Math.min(...e.map((x) => x.pos));
    $('dLatest').textContent = `#${latest}`;
    $('dBest').textContent = `#${best}`;
    $('dBest').className = 'v good';
    const m = movement(kw);
    $('dMove').innerHTML = m.dir === 'up' ? `<span style="color:var(--up)">▲ ${m.delta}</span>`
      : m.dir === 'down' ? `<span style="color:var(--down)">▼ ${m.delta}</span>`
      : m.dir === 'flat' ? '— 0' : 'new';
  }

  drawChart(e);
  renderEntries(kw);
}

function drawChart(entries) {
  const canvas = $('chart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const pad = { l: 30, r: 10, t: 12, b: 22 };
  ctx.font = '10px -apple-system, Segoe UI, sans-serif';
  ctx.fillStyle = '#9aa3b5';

  if (!entries.length) {
    ctx.textAlign = 'center';
    ctx.fillText('Log your first position to see the trend.', W / 2, H / 2);
    return;
  }

  const pos = entries.map((x) => x.pos);
  const max = Math.max(...pos, 10);
  const min = 1;
  const X = (i) => pad.l + (i / Math.max(entries.length - 1, 1)) * (W - pad.l - pad.r);
  // Inverted: position 1 (best) at top.
  const Y = (p) => pad.t + ((p - min) / Math.max(max - min, 1)) * (H - pad.t - pad.b);

  // Gridlines + labels (positions 1, max).
  ctx.textAlign = 'right';
  [1, Math.round(max)].forEach((p) => {
    ctx.fillText(`#${p}`, pad.l - 6, Y(p) + 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.moveTo(pad.l, Y(p)); ctx.lineTo(W - pad.r, Y(p)); ctx.stroke();
  });

  // Area + line.
  const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
  grad.addColorStop(0, 'rgba(245,158,11,0.35)');
  grad.addColorStop(1, 'rgba(245,158,11,0.02)');
  ctx.beginPath();
  entries.forEach((en, i) => (i ? ctx.lineTo(X(i), Y(en.pos)) : ctx.moveTo(X(0), Y(en.pos))));
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  if (entries.length > 1) {
    ctx.lineTo(X(entries.length - 1), H - pad.b);
    ctx.lineTo(X(0), H - pad.b);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Points + date labels (first/last).
  entries.forEach((en, i) => {
    ctx.beginPath();
    ctx.arc(X(i), Y(en.pos), 3, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
  });
  ctx.textAlign = 'left';
  ctx.fillText(entries[0].date.slice(5), pad.l, H - 6);
  if (entries.length > 1) {
    ctx.textAlign = 'right';
    ctx.fillText(entries[entries.length - 1].date.slice(5), W - pad.r, H - 6);
  }
}

function renderEntries(kw) {
  const ul = $('entries');
  ul.innerHTML = '';
  const e = sortedEntries(kw).reverse(); // newest first
  if (!e.length) {
    ul.innerHTML = '<li class="empty">No checks logged yet.</li>';
    return;
  }
  e.forEach((en) => {
    const li = document.createElement('li');
    li.className = 'entry';
    li.innerHTML =
      `<span class="p">#${en.pos}</span>` +
      `<div class="m"><b>${escapeHtml(en.date)}</b>` +
      `${en.url ? escapeHtml(en.url) : ''}${en.url && en.note ? ' · ' : ''}${en.note ? escapeHtml(en.note) : ''}</div>` +
      `<button class="x" title="Delete entry">✕</button>`;
    li.querySelector('.x').addEventListener('click', async () => {
      const { kws, kw: cur } = await getCurrent();
      cur.entries = cur.entries.filter((x) => x.id !== en.id);
      cur.updatedAt = Date.now();
      await saveKeywords(kws);
      renderDetail();
    });
    ul.appendChild(li);
  });
}

$('addEntry').addEventListener('click', async () => {
  const pos = parseInt($('ePos').value, 10);
  const date = $('eDate').value || todayISO();
  if (!Number.isFinite(pos) || pos < 1) { $('ePos').focus(); return; }
  const { kws, kw } = await getCurrent();
  if (!kw) return;
  kw.entries.push({
    id: uid(), date, pos,
    url: $('eUrl').value.trim(), note: $('eNote').value.trim()
  });
  kw.updatedAt = Date.now();
  await saveKeywords(kws);
  $('ePos').value = '';
  $('eUrl').value = '';
  $('eNote').value = '';
  renderDetail();
});

$('delKw').addEventListener('click', async () => {
  if ($('delKw').dataset.arm !== '1') {
    $('delKw').dataset.arm = '1';
    $('delKw').textContent = 'Confirm?';
    setTimeout(() => { $('delKw').dataset.arm = ''; $('delKw').textContent = 'Delete'; }, 4000);
    return;
  }
  const { kws } = await getCurrent();
  await saveKeywords(kws.filter((k) => k.id !== currentId));
  $('back').click();
});

/* ------------------------------------------------------------------ */
/* CSV export                                                           */
/* ------------------------------------------------------------------ */

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

$('export').addEventListener('click', async () => {
  const kws = await loadKeywords();
  const rows = [['keyword', 'location', 'date', 'position', 'url', 'note']];
  kws.forEach((kw) => {
    sortedEntries(kw).forEach((en) => {
      rows.push([kw.keyword, kw.location, en.date, en.pos, en.url || '', en.note || '']);
    });
  });
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'keyword-ranks.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  $('export').textContent = 'Exported ✓';
  setTimeout(() => { $('export').textContent = 'Export CSV'; }, 1500);
});

/* ------------------------------------------------------------------ */
/* Init                                                                 */
/* ------------------------------------------------------------------ */

renderList();
