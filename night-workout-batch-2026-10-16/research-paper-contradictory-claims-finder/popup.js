/* Claim Ledger — claims/evidence logbook grouped by topic.
 * Honest scope: user-entered notes only. The extension organizes claims
 * and shows side-by-side stance comparisons; it never analyzes papers. */

/* ---------- storage helpers ---------- */
const KEY = 'claimLedger.claims.v1';

async function loadClaims() {
  const out = await chrome.storage.local.get(KEY);
  return Array.isArray(out[KEY]) ? out[KEY] : [];
}

async function saveClaims(claims) {
  await chrome.storage.local.set({ [KEY]: claims });
}

/* ---------- state ---------- */
let claims = [];
let currentStance = 'supports';

/* ---------- DOM refs ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/* ---------- tabs ---------- */
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    $(`tab-${t.dataset.tab}`).classList.add('active');
  });
});

/* ---------- stance picker ---------- */
document.querySelectorAll('#stance-btns .stance').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#stance-btns .stance').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    currentStance = b.dataset.stance;
  });
});

/* ---------- add claim ---------- */
$('btn-add').addEventListener('click', async () => {
  const topic = $('f-topic').value.trim();
  const claim = $('f-claim').value.trim();
  const source = $('f-source').value.trim();
  const note = $('f-note').value.trim();
  if (!topic || !claim) {
    $('f-topic').focus();
    return;
  }
  claims.push({
    id: `c${Date.now()}`,
    topic,
    claim,
    source,
    note,
    stance: currentStance,
    addedAt: new Date().toISOString(),
  });
  await saveClaims(claims);
  $('f-claim').value = ''; $('f-source').value = ''; $('f-note').value = '';
  renderAll();
});

/* ---------- grouping ---------- */
function topics() {
  const map = new Map();
  for (const c of claims) {
    if (!map.has(c.topic)) map.set(c.topic, []);
    map.get(c.topic).push(c);
  }
  return map;
}

function stanceLabel(s) {
  return s === 'supports' ? 'Supports' : s === 'contradicts' ? 'Contradicts' : 'Neutral';
}

function claimCard(c) {
  const div = document.createElement('div');
  div.className = `claim-card st-${c.stance}`;
  div.innerHTML = `
    <div class="c-text">${esc(c.claim)}</div>
    ${c.source ? `<div class="c-src">Source: ${esc(c.source)}</div>` : ''}
    ${c.note ? `<div class="c-note">${esc(c.note)}</div>` : ''}
    <div class="c-foot">
      <span class="stance-tag">${stanceLabel(c.stance)}</span>
      <button class="del" title="Delete claim" aria-label="Delete claim">&times;</button>
    </div>`;
  div.querySelector('.del').addEventListener('click', async () => {
    claims = claims.filter((x) => x.id !== c.id);
    await saveClaims(claims);
    renderAll();
  });
  return div;
}

/* ---------- topics view ---------- */
function renderTopics() {
  const view = $('topic-list-view');
  view.innerHTML = '';
  const map = topics();
  $('topic-count').textContent = `${map.size} topic${map.size === 1 ? '' : 's'} · ${claims.length} claims`;
  if (!map.size) {
    view.innerHTML = '<div class="empty">No topics yet. Add your first claim.</div>';
    return;
  }
  for (const [name, list] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const n = (s) => list.filter((c) => c.stance === s).length;
    const card = document.createElement('div');
    card.className = 'topic-card';
    card.innerHTML = `
      <div class="t-title"><span>${esc(name)}</span><span>${list.length} claims</span></div>
      <div class="t-stats">
        <span style="color:#34d399">${n('supports')} supports</span>
        <span style="color:#f87171">${n('contradicts')} contradicts</span>
        <span>${n('neutral')} neutral</span>
      </div>`;
    view.appendChild(card);
  }
}

/* ---------- compare view ---------- */
function renderCompare() {
  const sel = $('cmp-topic');
  const view = $('cmp-view');
  const map = topics();
  const names = [...map.keys()].sort((a, b) => a.localeCompare(b));
  const prev = sel.value;
  sel.innerHTML = names.length
    ? names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('')
    : '<option value="">No topics yet</option>';
  if (names.includes(prev)) sel.value = prev;
  view.innerHTML = '';
  const list = map.get(sel.value) || [];
  if (!list.length) {
    view.innerHTML = '<div class="empty">Pick a topic to compare stances side by side.</div>';
    return;
  }
  const order = { supports: 0, contradicts: 1, neutral: 2 };
  list.slice().sort((a, b) => order[a.stance] - order[b.stance])
    .forEach((c) => view.appendChild(claimCard(c)));
}
$('cmp-topic').addEventListener('change', renderCompare);

/* ---------- datalist + init ---------- */
function renderAll() {
  const map = topics();
  $('topic-list').innerHTML = [...map.keys()]
    .sort().map((n) => `<option value="${esc(n)}">`).join('');
  renderTopics();
  renderCompare();
}

(async function init() {
  claims = await loadClaims();
  renderAll();
})();
