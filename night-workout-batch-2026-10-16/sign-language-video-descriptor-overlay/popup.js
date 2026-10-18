/* Sign Practice Cards — personal sign-language flashcard deck.
 * Honest scope: the user writes every card; there is NO sign recognition,
 * no video analysis, no camera access. All state in chrome.storage.local. */

const $ = (id) => document.getElementById(id);
const store = {
  async get(keys) { try { return await chrome.storage.local.get(keys); } catch { return {}; } },
  async set(obj) { try { await chrome.storage.local.set(obj); } catch {} },
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let cards = [];       // {id,name,cat,motion,notes,link,known}
let order = [];       // indices into filtered list for review
let pos = 0;
let flipped = false;

/* ---------- Data ---------- */
async function load() {
  ({ cards = [] } = await store.get(['cards']));
  buildCatOptions();
  renderDeck();
  applyFilter();
}
function save() { return store.set({ cards }); }

function categories() {
  const set = new Set(cards.map((c) => c.cat).filter(Boolean));
  return ['All', ...[...set].sort()];
}
function buildCatOptions() {
  const cats = categories().filter((c) => c !== 'All');
  $('catFilter').innerHTML = '<option>All</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
  $('aCat').innerHTML = cats.map((c) => `<option>${esc(c)}</option>`).join('') || '<option>General</option>';
}

/* ---------- Tabs ---------- */
document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    document.querySelectorAll('.panel').forEach((p) => p.classList.add('hidden'));
    $('tab-' + t.dataset.tab).classList.remove('hidden');
  })
);

/* ---------- Review ---------- */
function filtered() {
  const f = $('catFilter').value || 'All';
  const q = '';
  return cards
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => (f === 'All' || c.cat === f));
}
function applyFilter() {
  order = filtered().map((x) => x.i);
  pos = 0;
  flipped = false;
  $('flashInner').classList.remove('flipped');
  renderFlash();
}
function renderFlash() {
  if (!order.length) {
    $('fFront').textContent = '—';
    $('fCat').textContent = '';
    $('fMotion').textContent = 'No cards in this filter yet.';
    $('fNotes').textContent = '';
    $('fLink').classList.add('hidden');
    $('progress').textContent = '0 / 0';
    renderMastery();
    return;
  }
  const c = cards[order[pos]];
  $('fFront').textContent = c.name;
  $('fCat').textContent = c.cat || '';
  $('fMotion').textContent = c.motion || '(no motion description)';
  $('fNotes').textContent = c.notes || '(no notes)';
  const link = $('fLink');
  if (c.link) { link.href = c.link; link.classList.remove('hidden'); }
  else link.classList.add('hidden');
  $('progress').textContent = `${pos + 1} / ${order.length}`;
  renderMastery();
}
function renderMastery() {
  const total = order.length;
  const known = order.filter((i) => cards[i].known).length;
  const pct = total ? Math.round((known / total) * 100) : 0;
  $('mastery').innerHTML = `Mastery (this filter): <strong>${known}/${total}</strong> — ${pct}%` +
    `<div class="bar"><div class="fill" style="width:${pct}%"></div></div>`;
}
function step(d) {
  if (!order.length) return;
  pos = (pos + d + order.length) % order.length;
  flipped = false;
  $('flashInner').classList.remove('flipped');
  renderFlash();
}
$('flashInner').addEventListener('click', (e) => {
  if (e.target.closest('a')) return; // let reference link work
  flipped = !flipped;
  $('flashInner').classList.toggle('flipped', flipped);
});
$('nextBtn').addEventListener('click', () => step(1));
$('prevBtn').addEventListener('click', () => step(-1));
$('shuffleBtn').addEventListener('click', () => {
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  pos = 0; flipped = false; $('flashInner').classList.remove('flipped'); renderFlash();
});
$('catFilter').addEventListener('change', applyFilter);
$('knownBtn').addEventListener('click', () => {
  if (!order.length) return;
  const c = cards[order[pos]];
  c.known = !c.known;
  save().then(() => { renderFlash(); renderDeck(); });
});
$('resetKnownBtn').addEventListener('click', () => {
  cards.forEach((c) => (c.known = false));
  save().then(() => { renderFlash(); renderDeck(); });
});
document.addEventListener('keydown', (e) => {
  if ($('tab-review').classList.contains('hidden')) return;
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === ' ') { e.preventDefault(); $('flashInner').click(); }
});

/* ---------- Deck ---------- */
function renderDeck() {
  const q = $('deckSearch').value.trim().toLowerCase();
  const box = $('deckList');
  const list = cards.filter((c) =>
    !q || c.name.toLowerCase().includes(q) || (c.cat || '').toLowerCase().includes(q) || (c.motion || '').toLowerCase().includes(q)
  );
  if (!list.length) { box.innerHTML = '<p class="empty">No matching cards.</p>'; return; }
  box.innerHTML = '';
  list.forEach((c) => {
    const el = document.createElement('div');
    el.className = 'dcard';
    const head = document.createElement('div'); head.className = 'dhead';
    const nm = document.createElement('span'); nm.className = 'dname'; nm.textContent = c.name;
    const ct = document.createElement('span'); ct.className = 'dcat'; ct.textContent = c.cat || '';
    const kn = document.createElement('span'); kn.className = 'known'; kn.textContent = c.known ? '✓ known' : '';
    const del = document.createElement('button'); del.className = 'ndel'; del.textContent = '×'; del.title = 'Delete card';
    del.addEventListener('click', () => {
      cards = cards.filter((x) => x.id !== c.id);
      save().then(() => { buildCatOptions(); renderDeck(); applyFilter(); });
    });
    head.append(nm, ct, kn, del);
    el.appendChild(head);
    if (c.motion) { const m = document.createElement('div'); m.className = 'dmotion'; m.textContent = c.motion; el.appendChild(m); }
    if (c.link) {
      const a = document.createElement('a'); a.className = 'dlink'; a.href = c.link;
      a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Watch reference video ↗';
      el.appendChild(a);
    }
    box.appendChild(el);
  });
}
$('deckSearch').addEventListener('input', renderDeck);

/* ---------- Add ---------- */
$('saveBtn').addEventListener('click', () => {
  const name = $('aName').value.trim();
  const motion = $('aMotion').value.trim();
  if (!name || !motion) { $('saveMsg').textContent = 'Sign name and motion description are required.'; return; }
  let cat = $('aCat').value;
  const newCat = $('aNewCat').value.trim();
  if (newCat) cat = newCat;
  let link = $('aLink').value.trim();
  if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;
  cards.unshift({ id: uid(), name, cat: cat || 'General', motion,
    notes: $('aNotes').value.trim(), link, known: false });
  save().then(() => {
    ['aName', 'aMotion', 'aNotes', 'aLink', 'aNewCat'].forEach((id) => ($(id).value = ''));
    $('saveMsg').textContent = 'Card saved ✓';
    setTimeout(() => ($('saveMsg').textContent = ''), 2000);
    buildCatOptions(); renderDeck(); applyFilter();
  });
});

load();
