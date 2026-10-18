/* Flashcard Deck Compiler — decks, cards, flip review, Anki TSV export.
 * 100% local. The "Anki" part is an exported .tsv file the user imports in
 * Anki (File → Import); there is no AnkiConnect or any external connection.
 */
'use strict';

const $ = (id) => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ----- Module: state ------------------------------------------------------
let state = { decks: [], activeDeck: null };   // deck: {id, name, cards:[{id,front,back}]}
let review = { order: [], idx: 0, showingFront: true };

async function load() {
  try {
    const d = await chrome.storage.local.get('decks');
    state = d.decks || { decks: [], activeDeck: null };
  } catch (e) { /* private mode etc. — run session-only */ }
}
async function save() {
  try { await chrome.storage.local.set({ decks: state }); } catch (e) {}
}
function activeDeck() { return state.decks.find(d => d.id === state.activeDeck) || null; }
function esc(s) {
  const el = document.createElement('div');
  el.textContent = s || '';
  return el.innerHTML;
}

// ----- Module: decks -------------------------------------------------------
function renderDecks() {
  const ul = $('deck-list');
  ul.innerHTML = '';
  if (!state.decks.length) {
    ul.innerHTML = '<li class="hint">No decks yet — create one above.</li>';
    return;
  }
  state.decks.forEach(deck => {
    const li = document.createElement('li');
    li.className = 'deck-item' + (deck.id === state.activeDeck ? ' selected' : '');
    li.innerHTML = `<span class="name">${esc(deck.name)}</span><span class="badge">${deck.cards.length} cards</span>`;
    li.addEventListener('click', () => { state.activeDeck = deck.id; save(); renderAll(); });
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm(`Delete deck "${deck.name}" and its ${deck.cards.length} cards?`)) return;
      state.decks = state.decks.filter(d => d.id !== deck.id);
      if (state.activeDeck === deck.id) state.activeDeck = state.decks[0]?.id || null;
      save(); renderAll();
    });
    li.appendChild(del);
    ul.appendChild(li);
  });
}

$('add-deck').addEventListener('click', () => {
  const name = $('deck-name').value.trim();
  if (!name) return;
  const deck = { id: uid(), name, cards: [] };
  state.decks.push(deck);
  state.activeDeck = deck.id;
  $('deck-name').value = '';
  save(); renderAll();
});

// ----- Module: cards -------------------------------------------------------
function renderCards() {
  const deck = activeDeck();
  $('cards-deck-label').textContent = deck ? `Editing: ${deck.name}` : 'Select or create a deck first.';
  const ul = $('card-list');
  ul.innerHTML = '';
  if (!deck) return;
  deck.cards.forEach(card => {
    const li = document.createElement('li');
    li.className = 'card-item';
    li.innerHTML = `<div class="faces">
      <div class="face"><b>Front</b>${esc(card.front)}</div>
      <div class="face"><b>Back</b>${esc(card.back)}</div>
    </div>`;
    const del = document.createElement('button');
    del.textContent = 'Delete card';
    del.addEventListener('click', () => {
      deck.cards = deck.cards.filter(c => c.id !== card.id);
      save(); renderAll();
    });
    li.appendChild(del);
    ul.appendChild(li);
  });
}

$('add-card').addEventListener('click', () => {
  const deck = activeDeck();
  const front = $('card-front').value.trim(), back = $('card-back').value.trim();
  if (!deck || !front) return;
  deck.cards.push({ id: uid(), front, back });
  $('card-front').value = ''; $('card-back').value = '';
  save(); renderAll();
});

$('bulk-add').addEventListener('click', () => {
  const deck = activeDeck();
  const text = $('bulk').value.trim();
  if (!deck || !text) return;
  let n = 0;
  text.split(/\r?\n/).forEach(line => {
    const parts = line.split(/\t| {2,}|;/);
    if (parts[0] && parts[0].trim()) {
      deck.cards.push({ id: uid(), front: parts[0].trim(), back: (parts[1] || '').trim() });
      n++;
    }
  });
  $('bulk').value = '';
  $('bulk-add').textContent = `${n} imported!`;
  setTimeout(() => { $('bulk-add').textContent = 'Import bulk'; }, 1500);
  save(); renderAll();
});

// ----- Module: review ------------------------------------------------------
function startReview(shuffle) {
  const deck = activeDeck();
  if (!deck || !deck.cards.length) {
    $('review-text').textContent = 'No cards in this deck.';
    $('review-side').textContent = '';
    return;
  }
  review.order = [...deck.cards];
  if (shuffle) {
    for (let i = review.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [review.order[i], review.order[j]] = [review.order[j], review.order[i]];
    }
  }
  review.idx = 0; review.showingFront = true;
  showCard();
}
function showCard() {
  const card = review.order[review.idx];
  if (!card) { $('review-text').textContent = 'Press Start to review'; $('review-side').textContent = ''; return; }
  $('review-text').textContent = review.showingFront ? card.front : card.back;
  $('review-side').textContent = review.showingFront ? 'front — click to flip' : 'back — click to flip';
}
$('flip').addEventListener('click', () => { review.showingFront = !review.showingFront; showCard(); });
$('review-card').addEventListener('click', () => { review.showingFront = !review.showingFront; showCard(); });
$('next-card').addEventListener('click', () => {
  if (!review.order.length) { startReview(false); return; }
  review.idx = (review.idx + 1) % review.order.length;
  review.showingFront = true; showCard();
});
$('shuffle').addEventListener('click', () => startReview(true));

// ----- Module: Anki TSV export ----------------------------------------------
$('export-tsv').addEventListener('click', () => {
  const deck = activeDeck();
  if (!deck || !deck.cards.length) return;
  const lines = deck.cards.map(c =>
    `${c.front.replace(/\t/g, ' ').replace(/\n/g, '<br>')}\t${c.back.replace(/\t/g, ' ').replace(/\n/g, '<br>')}`
  );
  const blob = new Blob([lines.join('\n')], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${deck.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'deck'}_anki.tsv`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
});

// ----- Module: tabs ---------------------------------------------------------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tabpage').forEach(p => p.hidden = true);
    $('tab-' + btn.dataset.tab).hidden = false;
    if (btn.dataset.tab === 'review' && !review.order.length) startReview(false);
  });
});

function renderAll() { renderDecks(); renderCards(); review.order = []; review.idx = 0; review.showingFront = true; $('review-text').textContent = 'Press Start to review'; $('review-side').textContent = ''; }

(async () => { await load(); renderAll(); })();
