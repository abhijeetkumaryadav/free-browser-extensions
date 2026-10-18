/* Reach Half-Life Clock — your engagement snapshots, local half-life estimate. */
// ENGINE-START
const STORAGE_KEYS = { posts: 'rhl_posts', notes: 'rhl_notes' };

// --- time helpers ---
function toMs(v) { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
function hoursBetween(a, b) { return (b - a) / 36e5; }
function fmtHours(h) {
  if (h < 1) return Math.round(h * 60) + ' min';
  if (h < 48) return (Math.round(h * 10) / 10) + ' h';
  return (Math.round(h / 24 * 10) / 10) + ' days';
}

// --- posts ---
function makePost(title, platform, publishedMs) {
  title = String(title || '').trim();
  if (!title) return null;
  return {
    id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4),
    title: title.slice(0, 80),
    platform: String(platform || 'Other').slice(0, 20),
    published: Number.isFinite(publishedMs) ? publishedMs : null,
    snapshots: [], // {at: ms, value: number}
    created: Date.now()
  };
}
function makeSnapshot(atMs, value) {
  if (!Number.isFinite(atMs) || !Number.isFinite(value) || value < 0) return null;
  return { at: atMs, value: Math.round(Math.min(value, 1e8)) };
}
function sortedSnaps(post) {
  return [...post.snapshots].sort((a, b) => a.at - b.at);
}
// Estimate half-life (hours) from the first snapshot (peak anchor) and a later one.
// Exponential model: N(t) = N0 * (1/2)^(t / halfLife). Returns null if unusable.
function estimateHalfLife(post) {
  const snaps = sortedSnaps(post).filter(s => s.value > 0);
  if (snaps.length < 2) return null;
  const first = snaps[0], last = snaps[snaps.length - 1];
  const dt = hoursBetween(first.at, last.at);
  if (dt <= 0 || last.value >= first.value || last.value <= 0) return null;
  const hl = dt * Math.LN2 / Math.log(first.value / last.value);
  return Number.isFinite(hl) && hl > 0 ? hl : null;
}
function decayCurvePoints(post, n) {
  const snaps = sortedSnaps(post);
  if (snaps.length === 0) return [];
  const t0 = snaps[0].at, t1 = snaps[snaps.length - 1].at;
  const span = Math.max(t1 - t0, 1);
  const vmax = Math.max(...snaps.map(s => s.value), 1);
  return snaps.slice(0, Math.max(n || snaps.length, 1)).map(s => ({
    x: (s.at - t0) / span, y: s.value / vmax
  }));
}
function filterPosts(posts, q) {
  q = String(q || '').trim().toLowerCase();
  if (!q) return posts;
  return posts.filter(p => (p.title + ' ' + p.platform).toLowerCase().includes(q));
}

// --- notes ---
function makeNote(title, body) {
  title = String(title || '').trim();
  if (!title) return null;
  return {
    id: 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1e4),
    title: title.slice(0, 80), body: String(body || '').slice(0, 2000),
    created: Date.now()
  };
}
function sortNotes(notes) { return [...notes].sort((a, b) => b.created - a.created); }
function filterNotes(notes, q) {
  q = String(q || '').trim().toLowerCase();
  if (!q) return notes;
  return notes.filter(n => (n.title + ' ' + n.body).toLowerCase().includes(q));
}
// ENGINE-END

const $ = id => document.getElementById(id);
const state = { posts: [], notes: [], activePostId: null };

async function loadAll() {
  const r = await chrome.storage.local.get(STORAGE_KEYS);
  state.posts = r[STORAGE_KEYS.posts] || [];
  state.notes = r[STORAGE_KEYS.notes] || [];
  renderPosts();
  renderNotes();
}
async function savePosts() { await chrome.storage.local.set({ [STORAGE_KEYS.posts]: state.posts }); }
async function saveNotes() { await chrome.storage.local.set({ [STORAGE_KEYS.notes]: state.notes }); }

// tabs
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  $('tab-posts').classList.toggle('hidden', t.dataset.tab !== 'posts');
  $('tab-notes').classList.toggle('hidden', t.dataset.tab !== 'notes');
}));

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// posts
$('post-form').addEventListener('submit', async e => {
  e.preventDefault();
  const post = makePost($('post-title').value, $('post-platform').value, toMs($('post-published').value));
  if (!post) return;
  const v = parseFloat($('snap-value').value);
  const first = makeSnapshot(post.published || Date.now(), v);
  if (first) post.snapshots.push(first);
  state.posts.push(post);
  await savePosts(); renderPosts();
  $('post-form').reset();
});
$('post-search').addEventListener('input', renderPosts);

function renderPosts() {
  const ul = $('post-list'); ul.innerHTML = '';
  const items = filterPosts(state.posts, $('post-search').value);
  if (!items.length) { ul.innerHTML = '<li><span class="m">No posts yet — add one above.</span></li>'; return; }
  for (const p of [...items].reverse()) {
    const li = document.createElement('li');
    const hl = estimateHalfLife(p);
    li.innerHTML = `<div><div class="t">${esc(p.title)}</div>
      <div class="m">${esc(p.platform)} · ${p.snapshots.length} snapshot${p.snapshots.length === 1 ? '' : 's'}${hl ? ' · half-life ≈ ' + esc(fmtHours(hl)) : ''}</div></div>`;
    const b = document.createElement('button');
    b.className = 'mini'; b.textContent = 'Open';
    b.addEventListener('click', () => openPost(p.id));
    li.appendChild(b); ul.appendChild(li);
  }
}

function openPost(id) {
  state.activePostId = id;
  const p = state.posts.find(x => x.id === id);
  if (!p) return;
  $('post-list-card').classList.add('hidden');
  $('post-detail').classList.remove('hidden');
  $('detail-title').textContent = p.title;
  $('detail-platform').textContent = p.platform;
  $('detail-published').textContent = p.published ? new Date(p.published).toLocaleString() : 'no publish time';
  renderDetail();
}
function renderDetail() {
  const p = state.posts.find(x => x.id === state.activePostId);
  if (!p) return;
  const hl = estimateHalfLife(p);
  $('half-life').textContent = hl
    ? 'Estimated half-life ≈ ' + fmtHours(hl) + ' (from your snapshots — rough and approximate)'
    : 'Add at least 2 snapshots with falling engagement to estimate a half-life.';
  drawCurve(p);
  const ul = $('snap-list'); ul.innerHTML = '';
  for (const s of sortedSnaps(p).reverse()) {
    const li = document.createElement('li');
    li.innerHTML = `<div><div class="t">${esc(s.value.toLocaleString())} engagements</div>
      <div class="m">${new Date(s.at).toLocaleString()}</div></div>`;
    const del = document.createElement('button');
    del.className = 'mini'; del.textContent = 'Remove';
    del.addEventListener('click', async () => {
      p.snapshots = p.snapshots.filter(x => !(x.at === s.at && x.value === s.value));
      await savePosts(); renderDetail(); renderPosts();
    });
    li.appendChild(del); ul.appendChild(li);
  }
}
function drawCurve(post) {
  const c = $('decay-canvas'), ctx = c.getContext('2d');
  const W = c.width, H = c.height, pad = 12;
  ctx.clearRect(0, 0, W, H);
  const pts = decayCurvePoints(post);
  if (pts.length === 0) {
    ctx.fillStyle = '#a7a7b3'; ctx.font = '11px sans-serif';
    ctx.fillText('No snapshots yet', pad, H / 2); return;
  }
  ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.beginPath();
  ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad);
  ctx.moveTo(pad, pad); ctx.lineTo(pad, H - pad); ctx.stroke();
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.beginPath();
  pts.forEach((pt, i) => {
    const x = pad + pt.x * (W - 2 * pad);
    const y = H - pad - pt.y * (H - 2 * pad);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  pts.forEach(pt => {
    const x = pad + pt.x * (W - 2 * pad);
    const y = H - pad - pt.y * (H - 2 * pad);
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill();
  });
}
$('snap-form').addEventListener('submit', async e => {
  e.preventDefault();
  const p = state.posts.find(x => x.id === state.activePostId);
  if (!p) return;
  const s = makeSnapshot(toMs($('snap-at').value) || Date.now(), parseFloat($('snap-eng').value));
  if (!s) return;
  p.snapshots.push(s);
  await savePosts(); renderDetail(); renderPosts();
  $('snap-form').reset();
});
$('back-btn').addEventListener('click', () => {
  state.activePostId = null;
  $('post-detail').classList.add('hidden');
  $('post-list-card').classList.remove('hidden');
});
$('delete-post').addEventListener('click', async () => {
  if (!confirm('Delete this post and its snapshots?')) return;
  state.posts = state.posts.filter(x => x.id !== state.activePostId);
  await savePosts();
  state.activePostId = null;
  $('post-detail').classList.add('hidden');
  $('post-list-card').classList.remove('hidden');
  renderPosts();
});

// notes
$('note-form').addEventListener('submit', async e => {
  e.preventDefault();
  const n = makeNote($('note-title').value, $('note-body').value);
  if (!n) return;
  state.notes.push(n); await saveNotes(); renderNotes();
  $('note-form').reset();
});
$('note-search').addEventListener('input', renderNotes);
function renderNotes() {
  const ul = $('note-list'); ul.innerHTML = '';
  const items = sortNotes(filterNotes(state.notes, $('note-search').value));
  if (!items.length) { ul.innerHTML = '<li><span class="m">No notes yet.</span></li>'; return; }
  for (const n of items) {
    const li = document.createElement('li');
    li.innerHTML = `<div><div class="t">${esc(n.title)}</div><div class="m">${esc(n.body)}</div></div>`;
    const del = document.createElement('button');
    del.className = 'mini'; del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      state.notes = state.notes.filter(x => x.id !== n.id);
      await saveNotes(); renderNotes();
    });
    li.appendChild(del); ul.appendChild(li);
  }
}

loadAll();
