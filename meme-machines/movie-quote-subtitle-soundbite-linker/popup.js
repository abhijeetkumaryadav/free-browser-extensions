/* QuoteVault popup logic.
 * QUOTES: "original" entries are lines written for this extension in a classic
 * movie style — they are NOT actual film quotes. "classic" entries are genuine
 * public-domain works (Shakespeare, etc.). No copyrighted material included.
 * Favorites persist in chrome.storage.local. Click a card to copy it.
 */
'use strict';

/* id, text, author, cat ('original' | 'classic') */
const QUOTES = [
  // --- Original cinematic-style lines (written for this extension) ---
  { id: 'o1',  text: 'The city never sleeps, so neither do its secrets.', author: 'Original line', cat: 'original' },
  { id: 'o2',  text: 'You can outrun the storm, but you cannot outrun the silence after.', author: 'Original line', cat: 'original' },
  { id: 'o3',  text: 'Every legend was once just a rumor with good timing.', author: 'Original line', cat: 'original' },
  { id: 'o4',  text: 'I did not come this far to only come this far.', author: 'Original line', cat: 'original' },
  { id: 'o5',  text: 'The map is not the territory, but the compass is still mine.', author: 'Original line', cat: 'original' },
  { id: 'o6',  text: 'Heroes are just ordinary people who refused to leave early.', author: 'Original line', cat: 'original' },
  { id: 'o7',  text: 'In the end, the lighthouse was the only one who stayed.', author: 'Original line', cat: 'original' },
  { id: 'o8',  text: 'Trust the plan, fear the shortcut.', author: 'Original line', cat: 'original' },
  { id: 'o9',  text: 'Some doors only open from the inside.', author: 'Original line', cat: 'original' },
  { id: 'o10', text: 'The quietest room holds the loudest truth.', author: 'Original line', cat: 'original' },
  { id: 'o11', text: 'We chase horizons because standing still feels like surrender.', author: 'Original line', cat: 'original' },
  { id: 'o12', text: 'A promise kept in the dark still shines at dawn.', author: 'Original line', cat: 'original' },
  { id: 'o13', text: 'The last train leaves on time, with or without you.', author: 'Original line', cat: 'original' },
  { id: 'o14', text: 'Courage is fear that packed a bag anyway.', author: 'Original line', cat: 'original' },

  // --- Genuine public-domain classics ---
  { id: 'c1', text: 'To be, or not to be: that is the question.', author: 'William Shakespeare, Hamlet', cat: 'classic' },
  { id: 'c2', text: 'All the world’s a stage, and all the men and women merely players.', author: 'William Shakespeare, As You Like It', cat: 'classic' },
  { id: 'c3', text: 'The course of true love never did run smooth.', author: 'William Shakespeare, A Midsummer Night’s Dream', cat: 'classic' },
  { id: 'c4', text: 'Parting is such sweet sorrow.', author: 'William Shakespeare, Romeo and Juliet', cat: 'classic' },
  { id: 'c5', text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.', author: 'Jane Austen, Pride and Prejudice', cat: 'classic' },
  { id: 'c6', text: 'Call me Ishmael.', author: 'Herman Melville, Moby-Dick', cat: 'classic' },
  { id: 'c7', text: 'It was the best of times, it was the worst of times.', author: 'Charles Dickens, A Tale of Two Cities', cat: 'classic' },
  { id: 'c8', text: 'Whatever our souls are made of, his and mine are the same.', author: 'Emily Brontë, Wuthering Heights', cat: 'classic' },
  { id: 'c9', text: 'I am no bird; and no net ensnares me.', author: 'Charlotte Brontë, Jane Eyre', cat: 'classic' },
  { id: 'c10', text: 'All happy families are alike; each unhappy family is unhappy in its own way.', author: 'Leo Tolstoy, Anna Karenina', cat: 'classic' },
  { id: 'c11', text: 'In the middle of difficulty lies opportunity.', author: 'Attributed to Albert Einstein', cat: 'classic' },
  { id: 'c12', text: 'The only thing we have to fear is fear itself.', author: 'Franklin D. Roosevelt', cat: 'classic' },
  { id: 'c13', text: 'That’s one small step for man, one giant leap for mankind.', author: 'Neil Armstrong', cat: 'classic' },
  { id: 'c14', text: 'I have a dream.', author: 'Martin Luther King Jr.', cat: 'classic' },
];

const FAV_KEY = 'qv:favorites';
const list = document.getElementById('list');
const empty = document.getElementById('empty');
const search = document.getElementById('search');
const toast = document.getElementById('toast');
const chips = document.querySelectorAll('.chip');

let favorites = new Set();
let activeCat = 'all';
let query = '';
let toastTimer = null;

const HEART_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3.4 1-4.5 2.5C10.9 4 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/></svg>';
const COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
}

async function loadFavorites() {
  try {
    const data = await chrome.storage.local.get(FAV_KEY);
    if (Array.isArray(data[FAV_KEY])) favorites = new Set(data[FAV_KEY]);
  } catch (e) { /* storage unavailable — favorites just won't persist */ }
}

async function saveFavorites() {
  try {
    await chrome.storage.local.set({ [FAV_KEY]: [...favorites] });
  } catch (e) { /* non-fatal */ }
}

function matches(q) {
  if (activeCat === 'favorites' && !favorites.has(q.id)) return false;
  if (activeCat !== 'all' && activeCat !== 'favorites' && q.cat !== activeCat) return false;
  if (query) {
    const hay = (q.text + ' ' + q.author).toLowerCase();
    if (!hay.includes(query)) return false;
  }
  return true;
}

function render() {
  list.textContent = '';
  const shown = QUOTES.filter(matches);
  empty.hidden = shown.length > 0;

  shown.forEach((q) => {
    const card = document.createElement('article');
    card.className = 'card';

    const star = document.createElement('button');
    star.className = 'star' + (favorites.has(q.id) ? ' faved' : '');
    star.type = 'button';
    star.innerHTML = HEART_SVG;
    star.setAttribute('aria-label', favorites.has(q.id) ? 'Remove from favorites' : 'Add to favorites');
    star.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (favorites.has(q.id)) favorites.delete(q.id);
      else favorites.add(q.id);
      await saveFavorites();
      render();
    });

    const quote = document.createElement('blockquote');
    quote.textContent = '\u201C' + q.text + '\u201D';

    const meta = document.createElement('div');
    meta.className = 'meta';
    const author = document.createElement('span');
    author.className = 'author';
    author.textContent = q.author;
    const tag = document.createElement('span');
    tag.className = 'tag ' + q.cat;
    tag.textContent = q.cat === 'original' ? 'Original' : 'Public domain';
    meta.append(author, tag);

    const hint = document.createElement('p');
    hint.className = 'copy-hint';
    hint.innerHTML = COPY_SVG + '<span>Click card to copy</span>';

    card.append(star, quote, meta, hint);
    card.addEventListener('click', async () => {
      const text = '\u201C' + q.text + '\u201D — ' + q.author;
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard.');
      } catch (e) {
        showToast('Copy failed — your browser blocked clipboard access.');
      }
    });
    list.appendChild(card);
  });
}

search.addEventListener('input', () => {
  query = search.value.trim().toLowerCase();
  render();
});

chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    chips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    activeCat = chip.dataset.cat;
    render();
  });
});

(async function init() {
  await loadFavorites();
  render();
})();
