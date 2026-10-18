/* Competitor Pricing Tier Change Alert — popup logic.
   Manual pricing logbook: competitors -> timestamped snapshots of tiers/prices.
   On each new snapshot, diffs against the previous one (per tier):
   price up / price down / new tier / removed tier. All data is local only. */

/* ---------- storage helpers ---------- */
const store = {
  async get() {
    const r = await chrome.storage.local.get(['competitors', 'snapshots']);
    return {
      competitors: r.competitors || [],   // [{id, name}]
      snapshots: r.snapshots || []        // [{id, compId, date, tiers:[{tier, price, note}]}]
    };
  },
  async set(data) { await chrome.storage.local.set(data); }
};
const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------- tabs ---------- */
document.querySelectorAll('.tab').forEach(t =>
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('tab-' + t.dataset.tab).classList.add('active');
  }));

/* ---------- tier rows (log form) ---------- */
function addTierRow(tier = '', price = '', note = '') {
  const row = document.createElement('div');
  row.className = 'tier-row';
  row.innerHTML = `
    <input type="text" class="t-tier" placeholder="Tier name (e.g. Pro)" value="${esc(tier)}">
    <input type="text" class="t-price" placeholder="Price" value="${esc(price)}">
    <button class="rm" title="Remove tier">×</button>`;
  row.querySelector('.rm').addEventListener('click', () => row.remove());
  document.getElementById('tier-rows').appendChild(row);
}
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

document.getElementById('add-tier').addEventListener('click', () => addTierRow());
document.getElementById('log-date').valueAsDate = new Date();

/* ---------- save snapshot + diff ---------- */
document.getElementById('save-snap').addEventListener('click', async () => {
  const { competitors, snapshots } = await store.get();
  const compId = document.getElementById('log-comp').value;
  if (!compId) return;
  const date = document.getElementById('log-date').value || new Date().toISOString().slice(0, 10);

  const tiers = [...document.querySelectorAll('.tier-row')]
    .map(r => ({
      tier: r.querySelector('.t-tier').value.trim(),
      price: r.querySelector('.t-price').value.trim()
    }))
    .filter(t => t.tier || t.price);
  if (!tiers.length) return;

  // previous snapshot = most recent earlier log for this competitor
  const prior = snapshots
    .filter(s => s.compId === compId)
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;

  const snap = { id: uid(), compId, date, tiers };
  snapshots.push(snap);
  await store.set({ snapshots });

  renderDiff(prior, snap);
  await refresh(); // keep lists current
});

/* Compute tier-level diffs between two snapshots. */
function diffSnapshots(prior, cur) {
  const changes = [];
  const prevMap = new Map((prior?.tiers || []).map(t => [t.tier.toLowerCase(), t]));
  const curMap = new Map(cur.tiers.map(t => [t.tier.toLowerCase(), t]));
  for (const [key, t] of curMap) {
    const p = prevMap.get(key);
    if (!p) { changes.push({ kind: 'new', tier: t.tier, detail: `New tier — price ${t.price || '—'}` }); continue; }
    if ((p.price || '').trim() !== (t.price || '').trim()) {
      changes.push({
        kind: 'up', // refined below
        tier: t.tier,
        detail: `${p.price || '—'} → ${t.price || '—'}`
      });
    }
  }
  // removed tiers
  for (const [key, p] of prevMap) {
    if (!curMap.has(key)) changes.push({ kind: 'new', tier: p.tier, detail: 'Tier removed from latest log' });
  }
  // refine up/down by numeric comparison when both sides are numeric
  for (const c of changes) {
    const m = c.detail.match(/^(.+?) → (.+)$/);
    if (m) {
      const a = parseFloat(m[1].replace(/[^0-9.\-]/g, ''));
      const b = parseFloat(m[2].replace(/[^0-9.\-]/g, ''));
      if (!Number.isNaN(a) && !Number.isNaN(b) && a !== b) c.kind = b > a ? 'up' : 'down';
      else c.kind = 'new';
    }
  }
  return changes;
}

function renderDiff(prior, cur) {
  const box = document.getElementById('diff-box');
  const list = document.getElementById('diff-list');
  list.innerHTML = '';
  if (!prior) {
    list.innerHTML = `<li><span class="pill new">FIRST</span><span>First snapshot for this competitor — future logs will be compared against it.</span></li>`;
  } else {
    const changes = diffSnapshots(prior, cur);
    if (!changes.length) {
      list.innerHTML = `<li><span class="pill down">SAME</span><span>No tier or price changes vs ${prior.date}.</span></li>`;
    } else {
      for (const c of changes) {
        const label = c.kind === 'up' ? 'UP' : c.kind === 'down' ? 'DOWN' : 'CHANGED';
        const li = document.createElement('li');
        li.innerHTML = `<span class="pill ${c.kind}">${label}</span><span><b>${esc(c.tier)}</b> — ${esc(c.detail)}</span>`;
        list.appendChild(li);
      }
    }
  }
  box.classList.remove('hidden');
}

/* ---------- competitors tab ---------- */
document.getElementById('add-comp').addEventListener('click', async () => {
  const name = document.getElementById('comp-name').value.trim();
  if (!name) return;
  const { competitors, snapshots } = await store.get();
  competitors.push({ id: uid(), name });
  await store.set({ competitors });
  document.getElementById('comp-name').value = '';
  await refresh();
});

async function deleteCompetitor(id) {
  const { competitors, snapshots } = await store.get();
  await store.set({
    competitors: competitors.filter(c => c.id !== id),
    snapshots: snapshots.filter(s => s.compId !== id)
  });
  await refresh();
}

async function deleteSnapshot(id) {
  const { snapshots } = await store.get();
  await store.set({ snapshots: snapshots.filter(s => s.id !== id) });
  await refresh();
}

/* ---------- render everything ---------- */
async function refresh() {
  const { competitors, snapshots } = await store.get();

  // competitor dropdowns
  const opts = competitors.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')
    || '<option value="">— add a competitor first —</option>';
  document.getElementById('log-comp').innerHTML = opts;
  document.getElementById('hist-comp').innerHTML = opts;

  // competitor list
  const cl = document.getElementById('comp-list');
  cl.innerHTML = competitors.length
    ? '' : '<li class="empty">No competitors yet. Add one above.</li>';
  for (const c of competitors) {
    const n = snapshots.filter(s => s.compId === c.id).length;
    const li = document.createElement('li');
    li.innerHTML = `<span>${esc(c.name)} <small style="color:var(--dim)">(${n} snapshot${n === 1 ? '' : 's'})</small></span>
      <button class="del" title="Delete">✕</button>`;
    li.querySelector('.del').addEventListener('click', () => deleteCompetitor(c.id));
    cl.appendChild(li);
  }

  renderHistory(competitors, snapshots);
}

function renderHistory(competitors, snapshots) {
  const compId = document.getElementById('hist-comp').value;
  const comp = competitors.find(c => c.id === compId);
  const list = document.getElementById('snap-list');
  const stats = document.getElementById('hist-stats');
  const snaps = snapshots.filter(s => s.compId === compId).sort((a, b) => b.date.localeCompare(a.date));

  if (!comp || !snaps.length) {
    stats.innerHTML = '';
    list.innerHTML = '<div class="empty">No snapshots yet. Log one in the Log tab.</div>';
    return;
  }

  // stats: snapshots count, tiers tracked, price changes found across consecutive logs
  let changes = 0;
  for (let i = snaps.length - 1; i > 0; i--) changes += diffSnapshots(snaps[i - 1], snaps[i]).length;
  const latest = snaps[0];
  stats.innerHTML = `
    <div class="stat"><b>${snaps.length}</b><span>snapshots</span></div>
    <div class="stat"><b>${latest.tiers.length}</b><span>tiers now</span></div>
    <div class="stat"><b>${changes}</b><span>changes logged</span></div>`;

  list.innerHTML = '';
  for (const s of snaps) {
    const div = document.createElement('div');
    div.className = 'snap';
    div.innerHTML = `<div class="snap-head"><b>${esc(s.date)}</b>
      <button class="del" title="Delete snapshot">✕</button></div>
      <table><tr><th>Tier</th><th>Price</th></tr>
      ${s.tiers.map(t => `<tr><td>${esc(t.tier)}</td><td>${esc(t.price)}</td></tr>`).join('')}</table>`;
    div.querySelector('.del').addEventListener('click', () => deleteSnapshot(s.id));
    list.appendChild(div);
  }
}

document.getElementById('hist-comp').addEventListener('change', refresh);

addTierRow(); // start with one empty tier row
refresh();
