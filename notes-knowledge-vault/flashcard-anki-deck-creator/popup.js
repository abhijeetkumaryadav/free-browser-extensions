/* CardForge — flashcards with SM-2-style spaced repetition. Storage: chrome.storage.local. */
'use strict';

const $ = (id) => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const DAY = 86400000;

/* ---------- Store ---------- */
const store = {
  async load() {
    const { decks = [] } = await chrome.storage.local.get('decks');
    return decks;
  },
  save(decks) { return chrome.storage.local.set({ decks }); }
};

let decks = [];
let activeDeckId = null;   // deck selected in Cards tab
let modalDeckId = null;    // deck being renamed/deleted
let session = null;        // study session state

/* ---------- Helpers ---------- */
const getDeck = (id) => decks.find((d) => d.id === id);
const esc = (s) => s; // we use textContent everywhere, no HTML injection

function dueInfo(deck) {
  const now = Date.now();
  const due = deck.cards.filter((c) => c.due <= now).length;
  return { total: deck.cards.length, due };
}

function nextDueLabel(card) {
  const diff = card.due - Date.now();
  if (diff <= 0) return 'Due now';
  if (diff < 3600000) return `Due in ${Math.max(1, Math.round(diff / 60000))} min`;
  if (diff < DAY) return `Due in ${Math.round(diff / 3600000)} h`;
  return `Due in ${Math.round(diff / DAY)} d`;
}

/* ---------- SM-2-lite scheduling ---------- */
// card: { ease, interval (days), reps }
// Grades: again -> re-learn soon; hard/good/easy -> SM-2-ish intervals.
function gradeCard(card, grade) {
  const now = Date.now();
  if (grade === 'again') {
    card.reps = 0;
    card.interval = 0;
    card.ease = Math.max(1.3, card.ease - 0.2);
    card.due = now + 60000; // 1 minute — re-learn in this session soon
  } else {
    if (grade === 'hard') {
      card.interval = card.reps === 0 ? 1 : Math.max(1, Math.round(card.interval * 1.2));
      card.ease = Math.max(1.3, card.ease - 0.15);
    } else if (grade === 'good') {
      card.interval = card.reps === 0 ? 1 : Math.max(1, Math.round(card.interval * card.ease));
    } else { // easy
      card.interval = card.reps === 0 ? 4 : Math.max(1, Math.round(card.interval * card.ease * 1.3));
      card.ease = card.ease + 0.15;
    }
    card.reps += 1;
    card.due = now + card.interval * DAY;
  }
}

function newCard(front, back) {
  return { id: uid(), front, back, ease: 2.5, interval: 0, reps: 0, due: 0, createdAt: Date.now() };
}

/* ---------- Tabs ---------- */
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.tabpanel').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    $(`tab-${t.dataset.tab}`).classList.add('active');
  });
});
function gotoTab(name) {
  document.querySelector(`.tab[data-tab="${name}"]`).click();
}

/* ---------- Decks tab ---------- */
$('addDeckBtn').addEventListener('click', addDeck);
$('deckName').addEventListener('keydown', (e) => { if (e.key === 'Enter') addDeck(); });

async function addDeck() {
  const name = $('deckName').value.trim();
  if (!name) return;
  decks.push({ id: uid(), name, cards: [], createdAt: Date.now() });
  $('deckName').value = '';
  await store.save(decks);
  renderAll();
}

function renderDecks() {
  const list = $('deckList');
  list.innerHTML = '';
  if (!decks.length) {
    list.innerHTML = '<p class="empty-msg">No decks yet. Create your first deck above.</p>';
    return;
  }
  for (const deck of decks) {
    const { total, due } = dueInfo(deck);
    const card = document.createElement('div');
    card.className = 'deck-card';
    const left = document.createElement('div');
    const h = document.createElement('h4'); h.textContent = deck.name;
    const meta = document.createElement('div'); meta.className = 'deck-meta';
    const totalSpan = document.createElement('span'); totalSpan.textContent = `${total} card${total === 1 ? '' : 's'}`;
    meta.appendChild(totalSpan);
    if (due > 0) {
      meta.appendChild(document.createTextNode(' · '));
      const dueSpan = document.createElement('span'); dueSpan.className = 'due';
      dueSpan.textContent = `${due} due`;
      meta.appendChild(dueSpan);
    }
    left.append(h, meta);
    const actions = document.createElement('div'); actions.className = 'deck-actions';
    if (total > 0) {
      const study = document.createElement('button'); study.className = 'study-btn'; study.textContent = 'Study';
      study.addEventListener('click', (ev) => { ev.stopPropagation(); startStudy(deck.id); });
      actions.appendChild(study);
    }
    const opt = document.createElement('button'); opt.className = 'icon-btn'; opt.title = 'Rename / delete';
    opt.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>';
    opt.addEventListener('click', (ev) => { ev.stopPropagation(); openDeckModal(deck.id); });
    actions.appendChild(opt);
    card.append(left, actions);
    card.addEventListener('click', () => { activeDeckId = deck.id; syncDeckSelects(); renderCards(); gotoTab('cards'); });
    list.appendChild(card);
  }
}

/* Deck modal (rename / delete) */
function openDeckModal(id) {
  modalDeckId = id;
  const deck = getDeck(id);
  $('deckModalTitle').textContent = deck.name;
  $('deckRename').value = deck.name;
  $('deckModal').classList.remove('hidden');
}
function closeDeckModal() { $('deckModal').classList.add('hidden'); modalDeckId = null; }
$('deckModalClose').addEventListener('click', closeDeckModal);
$('deckModal').addEventListener('click', (e) => { if (e.target === $('deckModal')) closeDeckModal(); });

$('deckRenameBtn').addEventListener('click', async () => {
  const deck = getDeck(modalDeckId);
  const name = $('deckRename').value.trim();
  if (deck && name) { deck.name = name; await store.save(decks); }
  closeDeckModal(); renderAll();
});
$('deckDeleteBtn').addEventListener('click', async () => {
  const deck = getDeck(modalDeckId);
  if (deck && confirm(`Delete deck "${deck.name}" and all its cards?`)) {
    decks = decks.filter((d) => d.id !== deck.id);
    if (activeDeckId === deck.id) activeDeckId = decks[0] ? decks[0].id : null;
    await store.save(decks);
  }
  closeDeckModal(); renderAll();
});

/* ---------- Cards tab ---------- */
function syncDeckSelects() {
  for (const selId of ['cardDeckSelect', 'studyDeckSelect']) {
    const sel = $(selId);
    sel.innerHTML = '';
    for (const deck of decks) {
      const o = document.createElement('option');
      o.value = deck.id; o.textContent = `${deck.name} (${deck.cards.length})`;
      sel.appendChild(o);
    }
  }
  if (activeDeckId && getDeck(activeDeckId)) {
    $('cardDeckSelect').value = activeDeckId;
    $('studyDeckSelect').value = activeDeckId;
  } else if (decks.length) {
    activeDeckId = decks[0].id;
    $('cardDeckSelect').value = activeDeckId;
    $('studyDeckSelect').value = activeDeckId;
  }
}
$('cardDeckSelect').addEventListener('change', (e) => { activeDeckId = e.target.value; renderCards(); });
$('studyDeckSelect').addEventListener('change', () => { /* applied on Start */ });

async function addCard() {
  const deck = getDeck($('cardDeckSelect').value);
  if (!deck) { flashCardStatus('Create a deck first.', true); return; }
  const front = $('cardFront').value.trim();
  const back = $('cardBack').value.trim();
  if (!front || !back) { flashCardStatus('Both front and back are required.', true); return; }
  deck.cards.push(newCard(front, back));
  $('cardFront').value = ''; $('cardBack').value = '';
  await store.save(decks);
  flashCardStatus(`Card added to "${deck.name}".`);
  renderAll();
}
$('addCardBtn').addEventListener('click', addCard);

function flashCardStatus(msg, isErr = false) {
  const el = $('cardStatus');
  el.textContent = msg;
  el.style.color = isErr ? '#f87171' : '#34d399';
  setTimeout(() => { el.textContent = ''; }, 2500);
}

function renderCards() {
  const list = $('cardList');
  list.innerHTML = '';
  const deck = getDeck($('cardDeckSelect').value);
  if (!deck) { list.innerHTML = '<p class="empty-msg">Create a deck to add cards.</p>'; return; }
  if (!deck.cards.length) { list.innerHTML = '<p class="empty-msg">No cards in this deck yet.</p>'; return; }
  for (const card of deck.cards) {
    const el = document.createElement('div');
    el.className = 'mini-card';
    const row = document.createElement('div'); row.className = 'rowline';
    const txt = document.createElement('div');
    const q = document.createElement('div'); q.className = 'q'; q.textContent = card.front;
    const a = document.createElement('div'); a.className = 'a'; a.textContent = card.back;
    txt.append(q, a);
    const del = document.createElement('button'); del.className = 'del-btn'; del.title = 'Delete card';
    del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    del.addEventListener('click', async () => {
      deck.cards = deck.cards.filter((c) => c.id !== card.id);
      await store.save(decks);
      renderAll();
    });
    row.append(txt, del);
    const due = document.createElement('div'); due.className = 'next-due'; due.textContent = nextDueLabel(card);
    el.append(row, due);
    list.appendChild(el);
  }
}

/* Anki TSV export: front<TAB>back, one card per line. */
$('exportTsvBtn').addEventListener('click', () => {
  const deck = getDeck($('cardDeckSelect').value);
  if (!deck || !deck.cards.length) { flashCardStatus('Nothing to export — deck is empty.', true); return; }
  const tsv = deck.cards
    .map((c) => `${c.front.replace(/\t|\n/g, ' ')}${'\t'}${c.back.replace(/\t|\n/g, ' ')}`)
    .join('\n');
  const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${deck.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'deck'}.tsv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  flashCardStatus('TSV exported — in Anki: File → Import, choose the .tsv, set type to Tab.');
});

/* ---------- Study mode ---------- */
$('flipBtn').addEventListener('click', flipCard);
$('flashcard').addEventListener('click', flipCard);
document.querySelectorAll('.grade').forEach((b) => {
  b.addEventListener('click', () => gradeCurrent(b.dataset.grade));
});
$('stopStudyBtn').addEventListener('click', endStudy);
$('studyAgainBtn').addEventListener('click', () => startStudy($('studyDeckSelect').value));

function startStudy(deckId) {
  const deck = getDeck(deckId);
  if (!deck || !deck.cards.length) return;
  gotoTab('study');
  const now = Date.now();
  // Due cards first (oldest due first), then new cards.
  const queue = [...deck.cards].sort((a, b) => {
    const ad = a.due <= now ? 0 : 1, bd = b.due <= now ? 0 : 1;
    if (ad !== bd) return ad - bd;
    return a.due - b.due;
  });
  session = { deckId, queue, index: 0, again: 0, total: queue.length };
  $('studyEmpty').classList.add('hidden');
  $('studyDone').classList.add('hidden');
  $('studyBox').classList.remove('hidden');
  showCard();
}

function showCard() {
  const card = session.queue[session.index];
  $('flashFront').textContent = card.front;
  $('flashBack').textContent = card.back;
  $('flashcard').classList.remove('flipped');
  $('flipBtn').classList.remove('hidden');
  $('gradeRow').classList.add('hidden');
  $('studyProgress').textContent = `Card ${session.index + 1} of ${session.queue.length}`;
}

function flipCard() {
  if (!session || !$('flashcard').classList) return;
  $('flashcard').classList.add('flipped');
  $('flipBtn').classList.add('hidden');
  $('gradeRow').classList.remove('hidden');
}

async function gradeCurrent(grade) {
  const card = session.queue[session.index];
  if (grade === 'again') {
    session.again++;
    gradeCard(card, 'again');
    // Re-queue at the end so it comes back this session.
    session.queue.push(card);
  } else {
    gradeCard(card, grade);
  }
  await store.save(decks);
  session.index++;
  if (session.index >= session.queue.length) endStudy(true);
  else showCard();
}

function endStudy(finished = false) {
  if (!session) return;
  const done = finished || session.index >= session.queue.length;
  $('studyBox').classList.add('hidden');
  if (done) {
    const reviewed = session.index;
    $('studySummary').textContent =
      `Reviewed ${reviewed} card${reviewed === 1 ? '' : 's'}` +
      (session.again ? ` · ${session.again} marked "Again" and re-queued` : '') + '.';
    $('studyDone').classList.remove('hidden');
  } else {
    $('studyEmpty').classList.remove('hidden');
  }
  session = null;
  renderDecks(); // refresh due counts
}

/* ---------- Render all / init ---------- */
function renderAll() {
  syncDeckSelects();
  renderDecks();
  renderCards();
}

(async function init() {
  decks = await store.load();
  if (decks.length) activeDeckId = decks[0].id;
  renderAll();
})();
