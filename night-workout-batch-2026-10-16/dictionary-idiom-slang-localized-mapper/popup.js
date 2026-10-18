/* Idiom Mapper — popup logic.
 * Personal idiom dictionary stored in chrome.storage.local.
 * Tabs: browse (search + tag filter + delete), add, review (flip cards).
 * Honest scope: everything shown is user-entered. No dictionary API. */

const LS_KEY = 'idiomMapperEntries';

let entries = [];      // [{id, phrase, meaning, localized, tags:[], created}]
let deckOrder = [];    // index order for review
let deckIdx = 0;
let flipped = false;
let activeTag = '';

const $ = (id) => document.getElementById(id);

/* ---------- storage ---------- */
async function loadEntries() {
  const res = await chrome.storage.local.get({ [LS_KEY]: [] });
  entries = Array.isArray(res[LS_KEY]) ? res[LS_KEY] : [];
}
async function persistEntries() {
  await chrome.storage.local.set({ [LS_KEY]: entries });
}

/* ---------- helpers ---------- */
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}
function uid() {
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function allTags() {
  const set = new Set();
  entries.forEach((e) => (e.tags || []).forEach((t) => t && set.add(t)));
  return [...set].sort((a, b) => a.localeCompare(b));
}
function filteredEntries() {
  const q = $('search').value.trim().toLowerCase();
  return entries.filter((e) => {
    const hay = [e.phrase, e.meaning, e.localized, ...(e.tags || [])]
      .join(' ').toLowerCase();
    const qOk = !q || hay.includes(q);
    const tOk = !activeTag || (e.tags || []).includes(activeTag);
    return qOk && tOk;
  });
}

/* ---------- tabs ---------- */
function wireTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tabpane').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

/* ---------- browse ---------- */
function renderTags() {
  const box = $('tagChips');
  box.innerHTML = '';
  const tags = allTags();
  const mk = (label, value, isActive) => {
    const b = document.createElement('button');
    b.className = 'chip' + (isActive ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      activeTag = isActive ? '' : value;
      renderTags();
      renderList();
    });
    return b;
  };
  if (tags.length) box.appendChild(mk('All', '', activeTag === ''));
  tags.forEach((t) => box.appendChild(mk(t, t, activeTag === t)));
}

function renderList() {
  const list = filteredEntries();
  const box = $('list');
  box.innerHTML = '';
  $('emptyMsg').classList.toggle('hidden', entries.length > 0);

  list.forEach((e) => {
    const card = document.createElement('div');
    card.className = 'entry';
    card.innerHTML = `
      <div class="entry-top">
        <span class="phrase">${esc(e.phrase)}</span>
        <button class="del" title="Delete entry">Delete</button>
      </div>
      ${e.meaning ? `<div class="meaning">${esc(e.meaning)}</div>` : ''}
      ${e.localized ? `<div class="localized">→ ${esc(e.localized)}</div>` : ''}
      ${(e.tags || []).length ? `<div class="chips">${e.tags.map((t) =>
        `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
    `;
    card.querySelector('.del').addEventListener('click', async () => {
      entries = entries.filter((x) => x.id !== e.id);
      await persistEntries();
      renderTags(); renderList(); buildDeck(false); renderCard();
    });
    box.appendChild(card);
  });

  if (entries.length && !list.length) {
    box.innerHTML = '<p class="muted">No entries match your search.</p>';
  }
}

function wireExport() {
  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'idiom-mapper-export.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

/* ---------- add ---------- */
function wireAdd() {
  $('saveBtn').addEventListener('click', async () => {
    const phrase = $('fPhrase').value.trim();
    const meaning = $('fMeaning').value.trim();
    const localized = $('fLocalized').value.trim();
    const tags = $('fTags').value.split(',')
      .map((t) => t.trim()).filter(Boolean);

    if (!phrase) {
      $('addMsg').textContent = 'Please enter the phrase / idiom first.';
      return;
    }
    entries.unshift({
      id: uid(), phrase, meaning, localized, tags, created: Date.now()
    });
    await persistEntries();
    $('fPhrase').value = $('fMeaning').value = $('fLocalized').value = $('fTags').value = '';
    $('addMsg').textContent = `Saved “${phrase}”.`;
    renderTags(); renderList(); buildDeck(false); renderCard();
    setTimeout(() => { $('addMsg').textContent = ''; }, 2500);
  });
}

/* ---------- review (flip cards) ---------- */
function buildDeck(shuffle) {
  deckOrder = entries.map((_, i) => i);
  if (shuffle) {
    for (let i = deckOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deckOrder[i], deckOrder[j]] = [deckOrder[j], deckOrder[i]];
    }
  }
  deckIdx = 0;
  flipped = false;
}

function currentEntry() {
  return deckOrder.length ? entries[deckOrder[deckIdx]] : null;
}

function renderCard() {
  const e = currentEntry();
  const front = $('cardFront');
  const back = $('cardBack');
  if (!e) {
    front.innerHTML = '<div class="big">No entries</div><div class="def">Add idioms in the Add tab to start reviewing.</div>';
    back.classList.add('hidden'); front.classList.remove('hidden');
    $('deckInfo').textContent = '';
    return;
  }
  front.innerHTML = `<div class="big">${esc(e.phrase)}</div>
    ${(e.tags || []).length ? `<div class="loc">${e.tags.map(esc).join(' · ')}</div>` : ''}`;
  back.innerHTML = `
    <div class="def">${esc(e.meaning || '—')}</div>
    ${e.localized ? `<div class="loc">→ ${esc(e.localized)}</div>` : ''}`;
  front.classList.toggle('hidden', flipped);
  back.classList.toggle('hidden', !flipped);
  $('deckInfo').textContent = `Card ${deckIdx + 1} of ${deckOrder.length}`;
}

function flip() { flipped = !flipped; renderCard(); }
function step(dir) {
  if (!deckOrder.length) return;
  deckIdx = (deckIdx + dir + deckOrder.length) % deckOrder.length;
  flipped = false;
  renderCard();
}

function wireReview() {
  $('card').addEventListener('click', flip);
  $('flipBtn').addEventListener('click', flip);
  $('nextBtn').addEventListener('click', () => step(1));
  $('prevBtn').addEventListener('click', () => step(-1));
  $('shuffleBtn').addEventListener('click', () => { buildDeck(true); renderCard(); });
  document.addEventListener('keydown', (ev) => {
    if (!$('tab-review').classList.contains('active')) return;
    if (ev.key === 'ArrowRight') step(1);
    else if (ev.key === 'ArrowLeft') step(-1);
    else if (ev.key === ' ') { ev.preventDefault(); flip(); }
  });
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  await loadEntries();
  wireTabs();
  wireAdd();
  wireReview();
  wireExport();
  $('search').addEventListener('input', renderList);
  renderTags();
  renderList();
  buildDeck(false);
  renderCard();
});
